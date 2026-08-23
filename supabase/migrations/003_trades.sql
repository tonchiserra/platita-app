-- Trading book: one row per closed operation, with its result.
--
-- The profits are *not* mirrored into `incomes`. They are read from here and
-- summed as synthetic income rows at render time, so deleting an operation
-- takes its income with it and there is no pair to keep in sync — which matters
-- because every write in this app leaves the browser through PostgREST, with no
-- multi-statement transaction to lean on.
--
-- Losses are never expenses. They only ever reduce the estimated patrimony.

create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  -- The traded market: BTC, ETH, SOL. Free text on purpose, like
  -- `expenses.category` — no closed list can cover what a person may trade, and
  -- renaming or dropping one must never rewrite history.
  asset text not null,
  direction text not null check (direction in ('long', 'short')),
  -- Signed, and never zero: a zero-result operation is not a fact this book has
  -- to record, and allowing it would force every consumer to pick a side for it.
  pnl_usd numeric not null check (pnl_usd <> 0),
  -- Signed, over the margin used. Not derivable — the margin is not captured —
  -- so it is typed or absent.
  pnl_pct numeric,
  leverage numeric check (leverage is null or leverage > 0),
  platform_id uuid references platforms(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table trades enable row level security;

create policy "Users can view own trades"
  on trades for select using (auth.uid() = user_id);
create policy "Users can insert own trades"
  on trades for insert with check (auth.uid() = user_id);
create policy "Users can update own trades"
  on trades for update using (auth.uid() = user_id);
create policy "Users can delete own trades"
  on trades for delete using (auth.uid() = user_id);

create index idx_trades_user_date on trades(user_id, date desc);
