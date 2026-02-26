# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platita is a personal finance app for tracking expenses, income, investments, and net worth (patrimonio). Built for the Argentine market with multi-currency support (ARS, USD, EUR, BTC, ETH) and real-time exchange rates.

## Commands

```bash
npm run dev      # Dev server on localhost:3000 (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

No test framework is configured.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** with React Compiler enabled
- **Supabase** (Auth + PostgreSQL with Row Level Security)
- **Chakra UI v3** for components, **next-themes** for dark mode
- **Recharts** for charts
- **TypeScript 5** with strict mode, path alias `@/*` → `./src/*`

## Architecture

### Route Groups

- `src/app/(auth)/` — Login, register, OAuth callback (public)
- `src/app/(dashboard)/` — All protected pages under `/dashboard/*`

Middleware (`src/proxy.ts` → `src/lib/supabase/middleware.ts`) refreshes Supabase sessions on every request and enforces route protection: unauthenticated users are redirected to `/login`, authenticated users on auth pages are redirected to `/dashboard`.

### Supabase Client Pattern

Two separate clients — never mix them:
- **Server**: `src/lib/supabase/server.ts` — `createClient()` (async, uses `cookies()`) and `getUser()` (cached with `React.cache` to deduplicate across layout + page)
- **Browser**: `src/lib/supabase/client.ts` — `createClient()` (singleton, for `"use client"` components)

### Data Fetching

Server Components fetch data directly from Supabase using `Promise.all()` for parallel requests. Exchange rates (dolarapi.com) and crypto prices (CoinGecko) are fetched server-side with 5-minute ISR revalidation. All amounts are normalized to ARS for dashboard display.

### Component Organization

- `src/components/{feature}/` — Feature-specific components (expenses, income, investments, patrimony, settings)
- `src/components/dashboard/` — Layout components (Sidebar, TopBar, BottomNav, SummaryCards)
- `src/components/shared/` — Reusable generic components
- `src/components/ui/provider.tsx` — Root Chakra + Theme provider

Forms are Client Components using the FormData API. Charts are Client Components using Recharts. Pages and layouts are Server Components.

### Database Schema

Six tables, all with RLS policies enforcing user isolation:
- **platforms** — Financial accounts (bank, crypto_exchange, investment_broker, cash, other)
- **expenses** — Transactions with category, currency, optional platform
- **incomes** — Transactions with source, currency, optional platform
- **investments** — Asset purchases (crypto, stock, bond, cedear, other)
- **patrimony_snapshots** — Monthly net worth headers with `total_ars`
- **patrimony_snapshot_items** — Breakdown per platform and currency (belongs to snapshot)

Types in `src/types/database.ts` mirror these tables. Joined types (`ExpenseWithPlatform`, etc.) are used for queries that include platform data.

Schema migrations live in `supabase/migrations/`.

### Styling

Chakra UI with semantic tokens defined in `src/lib/theme/index.ts`. Use token names like `bg.page`, `bg.card`, `fg.heading`, `fg.muted`, `border.card` — not raw colors. Responsive breakpoints use `base`/`md`/`lg` props.

### Key Patterns

- **Money visibility toggle**: `MoneyVisibilityContext` (`src/lib/context/money-visibility.tsx`) provides `showMoney` and `mask()`. Persisted in localStorage key `platita-show-money`.
- **Currency formatting**: Use `formatCurrency()`, `formatDate()`, `formatPercentage()` from `src/lib/utils/format.ts`. Locale is `es-AR`.
- **Constants**: Categories (`src/lib/constants/categories.ts`), income sources (`sources.ts`), currencies (`currencies.ts`), navigation (`navigation.tsx`).

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```
