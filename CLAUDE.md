# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platita is a personal finance app for tracking expenses, income, investments, a trading book and net worth (patrimonio). Built for the Argentine market with multi-currency support (ARS, USD, EUR, BTC, ETH) and live exchange rates. Used almost only on the phone: everything is mobile-first.

**The entire UI is in Spanish (es-AR)** — labels, headings, empty states, error copy. Code, comments, and identifiers are in English. New user-facing strings must be written in Spanish.

The visual language is the **COSRX AR UI Kit** (Innovate, `~/Desktop/Innovate/cosrx-theme`: `snippets/ui-kit-tokens.liquid`, `docs/theme-plan/ui-kit.md`, handoff in `docs/design/handoff/2026-10-20-completo`). The full rationale of the 2026-11 rewrite is in `docs/plans/2026-11-20-refactor-cosrx-design.md`.

## Commands

```bash
npm run dev      # Dev server on localhost:3000 (Turbopack)
npm run build    # Production build — also the only full TypeScript check
npm start        # Production server
npm run lint     # ESLint (flat config, next/core-web-vitals + next/typescript + React Compiler rules)
npm test         # Every scripts/*.test.ts through tsx (pure logic only)
```

Tests are plain `tsx` scripts with a tiny `check()` helper, not a framework. Run one with `npx tsx scripts/<name>.test.ts`. Anything with arithmetic (conversion, positions, patrimony, backup) lives in a pure module so it can be tested this way.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** with React Compiler (`reactCompiler: true`)
- **Supabase** (Auth + PostgreSQL with Row Level Security)
- **CSS Modules + design tokens**. There is no UI library and no CSS-in-JS: Chakra and Emotion were removed on purpose, because they were the biggest JS cost on phones.
- **Charts are hand-written SVG** (`src/components/charts`), rendered on the server. Recharts was removed.
- **next-themes** for dark mode (`attribute="class"`, light default)
- **TypeScript 5** strict, path alias `@/*` → `./src/*`

## Architecture

### Route Groups

- `src/app/(auth)/` — Login, register, OAuth callback (public). `AuthForm` honours `?redirectTo=` (only `/dashboard…` paths).
- `src/app/(dashboard)/` — All protected pages under `/dashboard/*`: Inicio, Gastos, Ingresos, Patrimonio, Inversiones (Cartera + `/trading`), Ajustes.

Route protection lives in `src/proxy.ts` (Next 16's renamed middleware entry — it exports `proxy()`), which delegates to `src/lib/supabase/middleware.ts`.

**Auth is checked with `getClaims()`, never `getUser()`, on the server.** The project signs JWTs with ES256, so `getClaims()` verifies locally against a JWKS cached for 10 minutes, while `getUser()` is a ~300 ms round-trip to the Auth server. A session revoked before `exp` still passes until it expires; RLS has the same blind spot.

### Supabase clients — never mix them

- **Server**: `src/lib/supabase/server.ts` — `createClient()` (async, cookies) and `getUser()` (`React.cache`d, reads the verified claims).
- **Browser**: `src/lib/supabase/client.ts` — `createClient()` is **async** and imports `@supabase/ssr` on first use, keeping ~185 KB out of every page. `getSessionUser()` reads the local session for stamping `user_id`.

The env var for the anon key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `..._ANON_KEY`). The proxy builds a Supabase client on every request, so **no route renders without both env vars** — not even `/login`.

### Read path: `src/lib/data` + `src/lib/compute`

- `src/lib/data/index.ts` (`server-only`) holds every query as a `React.cache`d loader: `getSession`, `getRates`, `getConverter`, `getExpenses`, `getIncomes`, `getTrades`, `getSnapshots`, `getInvestments`, `getAssetPrices`, `getPlatforms`, `getCategories`… Each names its columns and filters `.eq("user_id", user.id)` even though RLS does too: the explicit filter lets Postgres use the `(user_id, date)` indexes. Because they are cached per request, sections of one page (and the layout) share a single round trip.
- `src/lib/compute/index.ts` holds aggregations shared by more than one page: `monthlySums` (every series in ARS **and** USD), `allIncomes` (manual incomes + trading profits), `windowMonths`, `estimatePatrimony`, `buildGrowth`. `src/lib/compute/portfolio.ts` builds the portfolio (`getPortfolio`, `getPerformance`).
- Pages are thin: they `await` loaders inside `<Suspense>` sections so the headline figure renders before slow blocks (blue history, market history). Every route has a `loading.tsx` (`PageSkeleton`) for instant feedback on navigation.

### Write path — no Server Actions

Every insert/update/delete runs in a `"use client"` component through **`useWrite()`** (`src/lib/supabase/use-write.ts`). It gets the browser client and the session user, runs the write, maps PostgREST errors to Spanish (`explainError`), and refreshes the Server Components inside a transition.

```tsx
const { run, saving, error } = useWrite();
const ok = await run((supabase, userId) => supabase.from("expenses").insert({ ...row, user_id: userId }));
```

- Forms read values with `new FormData(e.currentTarget)` **before** the first `await`; React clears `currentTarget` once the handler yields. Forms that need live arithmetic (patrimony close, investment operation) use controlled state instead.
- **RLS is the only authorization layer.** A new table needs its own policies, written as `(select auth.uid()) = user_id … to authenticated` (see migration 004).
- `user_id` must be set explicitly on every insert. There is no DB default.
- Destructive actions go through `ConfirmDialog`. Editing happens in a `Sheet` (native `<dialog>`: a bottom sheet on the phone, a modal from 760 px up). A field marked `data-autofocus` gets focus when a sheet opens.

### UI kit (`src/components/ui`)

- `index.tsx` (server-safe): `Button`/`ButtonLink` (variants `primary` and `accent` both solid blue, `secondary`, `ghost`, `danger`, `text`), `Badge`, `LineLabel` (the eyebrow above a figure or section: small caps with a blue dot — the user rejected the kit's `[/ … /]` format), `Money`, `Delta`, `Box` (info box: white/grey/blue/up/down/black), `Section`, `Field`/`Input`/`Select`/`Textarea`, `SegmentedRadio`, `EmptyState`, `Skeleton`.
- `CountUp.tsx`: the hero figure counts up when it appears after a navigation (never over the first server-rendered paint — see `hydration.ts`). `Logo.tsx`: the original Platita logo (`/platita-logo.svg`), lifted by a CSS filter in dark mode.
- Every segmented control has a sliding thumb (`.segThumb`, positioned by `--seg-n` / `--seg-i`). Radio groups set the index with `:has()`, with no JS.
- `client.tsx`: `Sheet`, `ConfirmDialog`, `MoneyToggle`, `ThemeSwitch`.
- `Icon.tsx`: inline SVG icons on the kit's spec (24 grid, 1.6 stroke, round ends). No icon library.

### Money visibility is a CSS switch on `<html>`

An inline script in `src/app/layout.tsx` runs before first paint and sets the attribute from localStorage:

- `data-money="hidden"` (`platita-show-money`): `Money` always renders the value **and** a mask, and CSS shows one of them. Amounts therefore render in Server Components, with no context and no flash. **Every displayed amount goes through `<Money>`.**
- **Charts are in pesos only.** The user asked to drop the ARS/USD switch. The compute layer still returns both series, but the charts draw `ars`. Key figures keep their dollar value as a secondary line. The investments page leads in pesos too, at today's blue. Position cards stay in USD, because unit costs and prices are dollar quotes. **Trading is always in USD and never shows pesos** (user rule): its hero, summary and running-result chart use `currency="USD"` on `LineChart` / `ChartTable`. The running result is coloured by sign: the hero (`Hero bySign`) is green with + or red with −, and the chart line and wash (`LineSeries.bySign`) are green above zero and red below. A hard-stop gradient splits them exactly at the zero line, and the wash fills to zero.

### Charts (`src/components/charts`)

- `Charts.tsx`: `ChartCard` (title, legend, optional extra controls and toggle chip, footnote, "Ver tabla"), `BarChart` (one series, or two grouped), `LineChart`, `ChartTable`, `ToggleView`.
  - X coordinates are **percentages**, so a chart fits any width with no measuring. Line paths live in a stretched `viewBox` with `vector-effect: non-scaling-stroke`, and end dots sit in a percentage overlay so they stay round.
  - Hover and tap readouts are CSS (`:hover` / `:focus`) on one focusable column per month, each with an `aria-label` summary.
  - Bars have a rounded data end and a square foot (taller rect clipped at the baseline). The open month is drawn lighter.
- `MonthlyDonut.tsx` and `GrowthChart.tsx` are the client charts (month stepper; time range). Category colour is fixed over the whole window, so a category keeps its colour between months.
- The "vs. dolarizado" chip is a checkbox. The card renders both variants and `:has(input:checked)` swaps them, because the toggle changes the y-scale.
- **Capital growth has a time range** (3M, 6M, 1A, 3A, 5A, Todo; default 1A; ranges longer than the history are hidden). `GrowthChart.tsx` is a client component for that state. The range crops the patrimony line and **restarts the dollarized line at its first month** (`rebaseDollarized`): from the net worth of that month, plus each later month's savings. A range that opens before the first movement keeps the whole-history line, anchored there (user request, 2026-11-21).
- Charts draw on arrival (bars grow from the baseline staggered, lines reveal left to right with a `clip-path`, end dots pop, the donut spins in). A view hidden with `display: none` restarts its animations when shown, so the toggle redraws the chart; a new range or donut month redraws it through a key.
- Bars start at zero (`zeroScale`). Lines hug the data (`axisScale` in `src/lib/utils/chart-scale.ts`). Ticks are compact with a decimal when needed (22,5 M).
- Chart colours are tokens (`--chart-*` in `tokens.css`), validated with the dataviz skill's `validate_palette.js` in both modes:
  - **Ingresos are green and gastos are red**, as the user asked. The pair is kept CVD-safe by separating lightness (dark green and light red; inverted in dark mode).
  - The patrimony and portfolio-value line is brand blue. The dollarized line is amber, and so is invested capital on the portfolio chart (both are the "second line").
  - The donut takes six categorical hues from the dataviz reference palette, with no green or red so they don't read as gain or loss, plus a neutral step for the rest.

The six product charts and where they live: ingresos (Ingresos), gastos and the monthly donut (Gastos), ingresos vs. gastos (Inicio), capital growth with "vs. dolarizado" (Inicio, Patrimonio). Inversiones adds the portfolio performance chart; Trading has its running result.

### Currency conversion

- Today's rates: dolarapi (blue `venta` for USD, euro) and Binance for BTC/ETH (CoinGecko as fallback). All fetched server-side with 5-minute revalidation.
- **History**: the blue series from argentinadatos (~500 KB, 6 h revalidate). `makeBlueLookup` binary-searches it. `makeHistoricalConverter(fx, lookup)` (`src/lib/utils/currency-conversion.ts`) gives `toArs`/`toUsd` for a dated movement **at the blue of its own date**. EUR and crypto have no history and cross through today's prices.
- Charts use the historical converter. **The patrimony estimate uses today's rates** for the movements since the close, like the close it revalues: a dollar received after the close is a dollar still held. `estimatePatrimony` is the single implementation, so Inicio and Patrimonio always agree.
- Every fetcher returns `null` on failure instead of throwing. Callers degrade to zero or to "Sin precio".

### Estimated net worth

It is the last close revalued at today's rates, plus every movement since that close (`flowsSinceClose` in `src/lib/utils/patrimony-estimate.ts`), minus trading losses since then. It is not "this month's movements": months left unclosed must still count. The equation names the window after the month in the usual case and after the close date otherwise ("desde el cierre del 31 jul").

The dollarized counterfactual is `buildAlternatives` (`patrimony-alternatives.ts`), fed by `buildTimeline` (`patrimony-timeline.ts`). Both are pure and tested, and they still compute the mattress and real-value lines. Only `dollarized` is drawn. Returns on money already held (`RETURN_SOURCES`, trading profits included) stay out of it.

### Investments

- `investments.side` is `buy` | `sell` (migration 004). Rows without it are purchases. `getInvestments` selects `*` so the page still works before the migration, and `hasSidesColumn()` hides sales until it is applied.
- `src/lib/utils/portfolio.ts` (pure, tested): `buildPositions` uses average cost in USD (each operation converted at the blue of its date). A sale realizes `proceeds − avg × units` and leaves the average unchanged. `buildPerformance` produces the monthly invested-vs-value series; a month with no price carries the holding at cost.
- Current prices, in priority order:
  1. `asset_prices` (manual, per user, migration 004).
  2. data912 (`src/lib/api/market.ts`) for CEDEARs, stocks and bonds. ARS ÷ today's blue; `D`/`C` tickers are USD; fixed income quotes per 100 face value.
  3. Binance (`src/lib/api/crypto-prices.ts`, any `<ASSET>USDT` pair).
- History: Binance monthly klines and data912 `/historical/*`.

### Trading

The `trades` table records closed operations with a signed `pnl_usd`. Profits become income rows (`tradeIncomes`), are listed read-only under Ingresos, and stay out of the dollarized line. Losses are never expenses: they only reduce the estimated patrimony. All of it lives in `src/lib/utils/trading.ts`.

### Database Schema

Eight tables, all under RLS:

- **platforms** — accounts (`bank`, `crypto_exchange`, `investment_broker`, `cash`, `other`). Archive with `is_active`.
- **expense_categories** — the editable list. Deliberately **not** a foreign key: `expenses.category` is free text so renames never rewrite history. Read through `resolveCategories()`, which falls back to `EXPENSE_CATEGORIES`.
- **expenses**, **incomes** — movements with currency and optional platform.
- **investments** — buys and sells (`side`).
- **asset_prices** — manual price per user and asset (`unique(user_id, asset)`, asset stored upper-case).
- **trades** — the trading book.
- **patrimony_snapshots** + **patrimony_snapshot_items** — monthly closes. Items have no `user_id`; their policies go through the parent.

Built-in categories and income sources are **stored in English** ("Supermarket", "Salary") and translated only at render time (`src/lib/constants/labels.ts`).

The project lives in **São Paulo (`sa-east-1`)**, and the Vercel functions are pinned next to it with `vercel.json` (`regions: ["gru1"]`). Until 2026-11-20 it was in us-west-2, where every query from Argentina took ~250 ms; keep the database and the functions in the same region.

Migrations live in `supabase/migrations/` and are applied with `psql` (or the SQL editor); there is no CLI migration history. `004_performance_and_investments.sql` (applied):

- recreates every policy with `(select auth.uid())` and `to authenticated`;
- adds the missing FK indexes (`snapshot_id` had none);
- adds `investments.side` and `asset_prices`.

The export/import (`src/components/settings/DataTransfer.tsx` + `src/lib/utils/backup-schema.ts`) carries `side` as an optional last column (`compra`/`venta`), so older files still import.

### Styling

Tokens are in `src/styles/tokens.css`. The kit's brand names are kept (`--color-negro`, `--color-gris-producto`…), with **Platita's blue `--color-azul` #275396 (from the logo) in the place the kit gives to yellow**, at the user's request. Components read the semantic layer (`--bg`, `--surface`, `--block`, `--text`, `--text-2`, `--border`, `--primary`, `--accent`, `--up`/`--down`, `--chart-*`). Dark mode redefines only that layer under `html.dark`. **Never hard-code a colour in a component.**

Kit rules to keep:

- Red (`--error`) is for errors only. Gains and losses use `--up`/`--down` and always carry ▲/▼.
- **Light UI, no black blocks** (the user found them ugly in light mode). `--primary` is the blue, so solid buttons are blue. Segmented controls are a light track with a white thumb, tooltips are white cards, the rate tiles are grey blocks, and rules are `--border-strong`, never `--text`. Black (`--color-negro`) is for text only.
- Blue is the highlighted action (the "+" button, the main submit, the active tab and nav item on `--accent-soft`), never a large block background. There is no yellow anywhere.
- Green (`--up`, `--up-soft`) is money in or a gain, and red (`--down`, `--down-soft`) is money out or a loss: list amounts, deltas, the "Quedó" and result boxes, the bars.
- Shape: straight for structure, rounded for what you touch or what floats. Buttons, chips, inputs and segmented controls are pills; cards are 10 px; badges are 4 px.
- **Motion is part of every component** (`src/styles/motion.css` + each module). Every state change animates. Durations and curves come from the tokens (`--ease-out`, `--ease-spring`, `--t-*`), and everything stops under `prefers-reduced-motion`.
  - **Page transitions** use the View Transitions API through React's `<ViewTransition>` (`experimental.viewTransition` in `next.config.ts`; types from `react/canary`, referenced in `src/types/react-canary.d.ts`). The dashboard layout wraps the content in `<ViewTransition default="page">`.
  - **Shared elements:** the nav indicators (`nav-indicator`, `side-indicator`) and the hero figure (`hero-figure`, Inicio ↔ Patrimonio) morph between pages. Each name must be unique on the page.
  - **Theme and "ocultar montos"** switch inside `document.startViewTransition` (`withViewTransition`).
  - **Entry:** the blocks of a page rise in, staggered (`.content > *`).
  - **Accordions:** native `<details>` animate with `::details-content` + `interpolate-size`, and the React ones with `grid-template-rows: 0fr ↔ 1fr`. Their rows mount on first open and stay, so they can animate closed.
  - **Rows:** a deleted row collapses while the delete is in flight, and a new row flashes in.
  - **Sheets** keep their content mounted through the closing animation.

**Typography** — free stand-ins for the kit's licensed faces (Maison Neue, Maison Neue Extended and Piek are the client's licence and must not be used here), wired with `next/font` in `src/app/layout.tsx`:

- `--font-texto` **Hanken Grotesk** (Maison Neue): body and UI. Digits are tabular by default.
- `--font-display` **Mona Sans** at `font-stretch: 125%` (Maison Neue Extended): `.h1`/`.h2`/`.h3`, card titles.
- `--font-cifra` / `--fw-cifra`: **important figures in bold** (user request) — Mona Sans 700 at normal width for the hero, the stat values, the positions, the rates, the donut total and the amount fields. The kit's Piek-style light numerals (Aleo) were dropped.

### Key Patterns & Gotchas

- **Dates**: `YYYY-MM-DD` must be parsed with `parseLocalDate` / `new Date(s + "T00:00:00")`; a bare `new Date("2026-01-01")` is UTC and lands on the previous day here. "Today" and the current month come from `todayKey()` / `currentMonthKey()`, which use Buenos Aires time because the server runs in UTC.
- **Month keys**: monthly grouping uses `date.slice(0, 7)` strings. `monthRange`, `addMonths` and `endOfMonth` are in `format.ts`.
- **Formatting**: `formatMoney`, `formatPercent`, `formatMonthKey`, `formatMonthTick`, `formatDayMonth`, `parseArgentineNumber` (accepts `1.234,5` and `1234.5`) in `src/lib/utils/format.ts`.
- **React Compiler lint**: don't mutate `document` or reassign outer variables inside components. Put such helpers at module level (see `setMoneyHidden`, `setChartCurrency`).
- **Design docs** go in Spanish under `docs/plans/` before implementation.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```
