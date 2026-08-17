# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platita is a personal finance app for tracking expenses, income, investments, and net worth (patrimonio). Built for the Argentine market with multi-currency support (ARS, USD, EUR, BTC, ETH) and real-time exchange rates.

**The entire UI is in Spanish (es-AR)** — labels, headings, empty states, error copy. Code, comments, and identifiers are in English. New user-facing strings must be written in Spanish.

## Commands

```bash
npm run dev      # Dev server on localhost:3000 (Turbopack, default in Next 16)
npm run build    # Production build — also the only full TypeScript check
npm start        # Production server
npm run lint     # ESLint (flat config, next/core-web-vitals + next/typescript)
```

No test framework is configured. `npm run lint` does not type-check; use `npx tsc --noEmit` or `npm run build` for that.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** with React Compiler enabled (`reactCompiler: true` in `next.config.ts`)
- **Supabase** (Auth + PostgreSQL with Row Level Security)
- **Chakra UI v3** for components, **next-themes** for dark mode
- **Recharts** for charts
- **TypeScript 5** with strict mode, path alias `@/*` → `./src/*`

## Architecture

### Route Groups

- `src/app/(auth)/` — Login, register, OAuth callback (public)
- `src/app/(dashboard)/` — All protected pages under `/dashboard/*`

Route protection lives in `src/proxy.ts` (Next 16's renamed middleware entry — it exports `proxy()`, not `middleware()`), which delegates to `src/lib/supabase/middleware.ts`. That refreshes the Supabase session on every request, redirects unauthenticated users off `/dashboard/*` to `/login?redirectTo=…`, and redirects authenticated users away from `/login` and `/register`.

### Supabase Client Pattern

Two separate clients — never mix them:
- **Server**: `src/lib/supabase/server.ts` — `createClient()` (async, uses `cookies()`) and `getUser()` (wrapped in `React.cache` so layout + page share one auth round-trip)
- **Browser**: `src/lib/supabase/client.ts` — `createClient()` (module-level singleton, for `"use client"` components)

The env var for the anon key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `..._ANON_KEY`).

### Read Path (Server Components)

Pages are `async` Server Components. The canonical shape:

```tsx
const [user, supabase] = await Promise.all([getUser(), createClient()]);
const [{ data: a }, { data: b }, rate] = await Promise.all([
  supabase.from("expenses").select("...").eq("user_id", user!.id),
  ...
]);
```

Every query filters `.eq("user_id", user!.id)` explicitly even though RLS already enforces it. All aggregation (monthly grouping, category breakdowns, trend series, percentage changes) happens in the page body and is passed to presentational Client Components as plain props.

### Write Path (Client Components) — no Server Actions

There are **zero Server Actions and zero API routes for mutations**. Every insert/update/delete runs in a `"use client"` component using the browser Supabase client, then calls `router.refresh()` to re-run the Server Component and pull fresh data. Forms read values via `new FormData(e.currentTarget)`, not controlled state.

```tsx
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
const { error } = await supabase.from("expenses").insert({ user_id: user!.id, ... });
router.refresh();
```

Consequences to respect when adding features:
- **RLS is the only authorization layer.** Any new table needs its own policies in a migration or writes will silently fail.
- `user_id` must be set explicitly on every insert — there is no DB default.
- Destructive actions go through `ConfirmDialog` (`src/components/shared/ConfirmDialog.tsx`) driven by a `deleteId` state field.

### Chart Loading Pattern

Every Recharts chart is (a) imported with `next/dynamic` at the top of the page and (b) wrapped in `<LazySection>` in the JSX. `LazySection` (`src/components/shared/LazySection.tsx`) is an IntersectionObserver gate that renders a sized placeholder card until scrolled near. Follow both halves when adding a chart — Recharts is heavy and this keeps it off the initial bundle.

### Currency Conversion

Exchange rates come from server-side fetches with 5-minute ISR revalidation (`next: { revalidate: 300 }`): dolarapi.com for USD/EUR (`venta` side of *blue*, not oficial) and CoinGecko for BTC/ETH. Every fetcher returns `null` on failure rather than throwing, and callers fall back to `0` — so a dead upstream degrades to zeroed totals rather than a crashed page.

`convertToArs(amount, currency, rates)` in `src/lib/utils/currency-conversion.ts` is the canonical converter (crypto converts through USD: `units × usdPrice × usdRate`). Note the dashboard page currently inlines its own copy of this logic as a closure over local rate variables — prefer the shared util in new code.

**Not everything is ARS**: dashboard, patrimony, expenses, and income normalize to ARS. The investments page normalizes to **USD** instead (ARS purchases are divided by the blue rate), because asset prices come from CoinGecko in USD. Don't mix the two bases.

For crypto investments, `getCryptoPriceMap()` resolves user-typed asset names through a hardcoded ticker→CoinGecko-ID map (`COINGECKO_MAP`). Unmapped assets get no current price, and the UI surfaces them via `assetsWithoutPrice`.

### Database Schema

Seven tables, all with RLS policies enforcing user isolation:
- **platforms** — Financial accounts (bank, crypto_exchange, investment_broker, cash, other)
- **expense_categories** — The user's editable category list (`name`, `icon`, `is_fixed`, `sort_order`). Deliberately **not** a foreign key: `expenses.category` stays free text so renaming or deleting a category never rewrites history. Read it through `resolveCategories()` in `src/lib/utils/expense-categories.ts`, which falls back to the built-in `EXPENSE_CATEGORIES` when the user has no rows — so every read path works before they customise, and before migration `002` is applied. `is_fixed` marks monthly-fixed charges that the month-end spending projection holds flat instead of scaling.
- **expenses** — Transactions with category, currency, optional platform
- **incomes** — Transactions with source, currency, optional platform
- **investments** — Asset purchases (crypto, stock, bond, cedear, other)
- **patrimony_snapshots** — Monthly net worth headers with `total_ars`
- **patrimony_snapshot_items** — Breakdown per platform and currency (belongs to snapshot; its RLS policies check ownership via an `exists` subquery on the parent snapshot)

Types in `src/types/database.ts` mirror these tables. Joined types (`ExpenseWithPlatform`, `PatrimonySnapshotFull`, etc.) are used for queries that include platform data. Numeric columns come back as strings from PostgREST in some paths — existing code wraps them in `Number(...)` defensively.

Migrations live in `supabase/migrations/`. `supabase/seed.sql` and `seed_demo_user.sql` are manual SQL-editor scripts that look up a user by a hardcoded email, so they require registering that account first.

### Component Organization

- `src/components/{feature}/` — Feature-specific components (expenses, income, investments, patrimony, settings)
- `src/components/dashboard/` — Shell (Sidebar, TopBar, BottomNav) plus the dashboard's own blocks: `PatrimonyHero` → `PatrimonyEquation` (the net-worth arithmetic, the app's signature element) and `MonthFlow`
- `src/components/shared/` — Reusable generics (ConfirmDialog, EmptyState, LazySection, Select)
- `src/components/ui/provider.tsx` — Root provider stack: `ThemeProvider` (next-themes, `attribute="class"`, light default) → `ChakraProvider` → `MoneyVisibilityProvider`

Pages and layouts are Server Components; forms, lists, and charts are Client Components.

### Styling

Chakra UI v3 with semantic tokens defined in `src/lib/theme/index.ts` (merged into `defaultConfig` via `createSystem`). Use token names, never raw colors — they resolve per color mode automatically. Responsive props use `base`/`md`/`lg`.

- **Surfaces**: `bg.page`, `bg.card`, `bg.sunk` (recessed panels), `bg.input`, `bg.hover`
- **Rules**: `border.card`, `border.input`, `border.strong`
- **Text**: `fg.heading`, `fg.body`, `fg.muted`
- **Direction**: `trend.up` / `trend.down` — for gains and losses only. Do not use Chakra's `green.400` / `red.400`.
- **Currency**: `cur.ars`, `cur.usd`, `cur.eur`, `cur.btc`, `cur.eth` — colour *encodes the currency*, it is not decoration. A currency hue never doubles as a semantic state.

Cards are styled inline and repeatedly as `bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card"` — match that when adding one.

**Typography** — three faces from Omnibus-Type, a Buenos Aires foundry, wired as CSS variables in `src/app/layout.tsx`:
- `fontFamily="heading"` (Archivo) — section titles and display figures. Big figures add `css={{ fontVariationSettings: '"wdth" 110' }}` for the expanded width.
- body default (Chivo) — everything else.
- `fontFamily="mono"` (Chivo Mono) — **every money figure, percentage, and rate**. Always pair with the `data-num` attribute, which applies `tabular-nums` (see `globals.css`) so columns of digits don't reflow.

Use `Select` from `@/components/shared/Select` (a `chakra("select")` primitive), **not** Chakra v3's `Select` composite — the codebase uses plain native selects with `name` attributes so FormData picks them up.

### Alerts

`src/lib/utils/alerts.ts` holds the dashboard's "Para tener en cuenta" panel. `buildAlerts()` is a **pure function** — every input, including `today`, is passed in, so each rule is testable without mocking time or the network. Rules are small functions collected in `RULES`; add a rule by writing one and appending it there.

Two design constraints worth keeping:
- **Thresholds live in the `T` object** and are deliberately loose. An alert that fires every month is noise, so each rule must stay silent in an ordinary month.
- **Never state something arithmetic guarantees.** With two categories one must exceed 40 %, so `dominantCategory` requires four; likewise `platformConcentration` requires three platforms. Guards like these are the difference between an alert and a truism.

Monthly CPI comes from argentinadatos (`getMonthlyInflation`), fetched server-side on a long revalidate and returning `null` on failure — so the rule that depends on it simply doesn't fire when the upstream is down.

### Charts

`src/lib/constants/colors.ts` is the single source of chart colour. Recharts fills reference Chakra's emitted CSS variables (`CHART.grid`, `CHART.axis`, `CURRENCY_COLOR.ARS`, …), so charts follow the colour mode with **no `useTheme()` / `isDark` branching** — don't reintroduce it.

`AlternativesChart` compares net worth against four counterfactuals built from the same contributions.

The two inflation-adjusted lines are deliberately **not** symmetric, because they answer different questions: `mattressReal` restates the pesos in money of the anchor month, while `dollarizedReal` keeps the nominal peso value the dollars fetch today and removes only what US inflation took from the dollar itself. US CPI comes from the BLS (`getUsCpiIndex`) as **index levels, not monthly percentages** — that series has real holes (October 2025 was never published), and a level lets any month be measured straight against the anchor, so a hole costs one point instead of ending the line. The keyless BLS v1 API serves three years and caps at 25 requests/day/IP; a longer history simply has no index for its early months and the line does not draw there.
 The maths lives in `src/lib/utils/patrimony-alternatives.ts` as a pure isomorphic function with **no imports**, because the range selector re-bases the whole calculation client-side — a different anchor produces different counterfactuals rather than a shifted line, and keeping the module import-free stops `src/lib/api/*` from reaching the client bundle. `src/lib/utils/patrimony-timeline.ts` holds the server-side half. Its y-axis deliberately does not start at zero: the gaps between the lines are the point.

Breakdowns are always sorted by amount, so they use a single-hue ramp (`RAMP_EXPENSE`, `RAMP_INCOME`, `RAMP_PLATFORM` via `rampColor(ramp, i)`) where colour encodes rank. Reach for a ranked bar list when the data is a ranking, and a stacked bar when it is a composition of one whole — the multi-hue donut this replaced encoded nothing.

### Key Patterns & Gotchas

- **Money visibility toggle**: `MoneyVisibilityContext` (`src/lib/context/money-visibility.tsx`) provides `showMoney` and `mask()`. Wrap every displayed amount in `mask(...)`. Persisted in localStorage key `platita-show-money`.
- **Formatting**: Use `formatCurrency()`, `formatDate()`, `formatDateShort()`, `formatMonthYear()`, `formatPercentage()`, `parseArgentineNumber()` from `src/lib/utils/format.ts`. Locale is `es-AR`.
- **Date parsing**: `YYYY-MM-DD` strings must be parsed as `new Date(s + "T00:00:00")` — bare `new Date("2026-01-01")` is UTC and shifts back a day in Argentina. The `format.ts` helpers already handle this; replicate it in ad-hoc parsing.
- **Month keys**: monthly grouping uses `date.slice(0, 7)` string keys throughout, sorted lexicographically.
- **Constants**: Categories (`src/lib/constants/categories.ts`), income sources (`sources.ts`), currencies/platform types/asset types (`currencies.ts`), navigation (`navigation.tsx`, with inline SVG icon components — no icon library is installed).
- **Design docs**: feature design notes are written in Spanish under `docs/plans/` before implementation (see `docs/plans/2026-04-30-investments-avg-price-design.md`).

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```
