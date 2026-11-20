-- 004 · Performance and investments
--
-- Run once in the Supabase SQL editor. It rewrites no data.
--
-- 1. Every RLS policy is recreated with `(select auth.uid())` instead of a bare
--    `auth.uid()`. Bare, Postgres calls the function once per row; wrapped in a
--    sub-select it becomes an initPlan evaluated once per statement. Policies are
--    also scoped `to authenticated`, so anonymous requests skip them entirely.
-- 2. Snapshot items no longer check ownership with a correlated `exists` per row:
--    `snapshot_id in (<the user's snapshot ids>)` is planned once and hashed.
-- 3. Indexes for every foreign key that had none. `patrimony_snapshot_items`
--    had no index on `snapshot_id`, so each nested read scanned the table.
-- 4. Investments learn to sell, and assets without a market quote get a
--    user-entered price.

begin;

-- ---------------------------------------------------------------------------
-- 1. RLS policies
-- ---------------------------------------------------------------------------

-- Tables owned directly through `user_id`.
do $$
declare
  t text;
begin
  foreach t in array array[
    'platforms', 'expenses', 'incomes', 'patrimony_snapshots',
    'investments', 'expense_categories', 'trades'
  ]
  loop
    execute format('drop policy if exists "own rows: select" on %I', t);
    execute format('drop policy if exists "own rows: insert" on %I', t);
    execute format('drop policy if exists "own rows: update" on %I', t);
    execute format('drop policy if exists "own rows: delete" on %I', t);

    execute format(
      'create policy "own rows: select" on %I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: insert" on %I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: update" on %I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: delete" on %I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- The old per-table policy names, from migrations 001–003.
drop policy if exists "Users can view own platforms" on platforms;
drop policy if exists "Users can insert own platforms" on platforms;
drop policy if exists "Users can update own platforms" on platforms;
drop policy if exists "Users can delete own platforms" on platforms;

drop policy if exists "Users can view own expenses" on expenses;
drop policy if exists "Users can insert own expenses" on expenses;
drop policy if exists "Users can update own expenses" on expenses;
drop policy if exists "Users can delete own expenses" on expenses;

drop policy if exists "Users can view own incomes" on incomes;
drop policy if exists "Users can insert own incomes" on incomes;
drop policy if exists "Users can update own incomes" on incomes;
drop policy if exists "Users can delete own incomes" on incomes;

drop policy if exists "Users can view own snapshots" on patrimony_snapshots;
drop policy if exists "Users can insert own snapshots" on patrimony_snapshots;
drop policy if exists "Users can update own snapshots" on patrimony_snapshots;
drop policy if exists "Users can delete own snapshots" on patrimony_snapshots;

drop policy if exists "Users can view own investments" on investments;
drop policy if exists "Users can insert own investments" on investments;
drop policy if exists "Users can update own investments" on investments;
drop policy if exists "Users can delete own investments" on investments;

drop policy if exists "Users can view own categories" on expense_categories;
drop policy if exists "Users can insert own categories" on expense_categories;
drop policy if exists "Users can update own categories" on expense_categories;
drop policy if exists "Users can delete own categories" on expense_categories;

drop policy if exists "Users can view own trades" on trades;
drop policy if exists "Users can insert own trades" on trades;
drop policy if exists "Users can update own trades" on trades;
drop policy if exists "Users can delete own trades" on trades;

-- Snapshot items carry no `user_id`; ownership goes through the parent.
drop policy if exists "Users can view own snapshot items" on patrimony_snapshot_items;
drop policy if exists "Users can insert own snapshot items" on patrimony_snapshot_items;
drop policy if exists "Users can update own snapshot items" on patrimony_snapshot_items;
drop policy if exists "Users can delete own snapshot items" on patrimony_snapshot_items;
drop policy if exists "own rows: select" on patrimony_snapshot_items;
drop policy if exists "own rows: insert" on patrimony_snapshot_items;
drop policy if exists "own rows: update" on patrimony_snapshot_items;
drop policy if exists "own rows: delete" on patrimony_snapshot_items;

create policy "own rows: select" on patrimony_snapshot_items for select to authenticated
  using (snapshot_id in (
    select id from patrimony_snapshots where user_id = (select auth.uid())
  ));
create policy "own rows: insert" on patrimony_snapshot_items for insert to authenticated
  with check (snapshot_id in (
    select id from patrimony_snapshots where user_id = (select auth.uid())
  ));
create policy "own rows: update" on patrimony_snapshot_items for update to authenticated
  using (snapshot_id in (
    select id from patrimony_snapshots where user_id = (select auth.uid())
  ))
  with check (snapshot_id in (
    select id from patrimony_snapshots where user_id = (select auth.uid())
  ));
create policy "own rows: delete" on patrimony_snapshot_items for delete to authenticated
  using (snapshot_id in (
    select id from patrimony_snapshots where user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_snapshot_items_snapshot on patrimony_snapshot_items(snapshot_id);
create index if not exists idx_snapshot_items_platform on patrimony_snapshot_items(platform_id);
create index if not exists idx_expenses_platform on expenses(platform_id) where platform_id is not null;
create index if not exists idx_incomes_platform on incomes(platform_id) where platform_id is not null;
create index if not exists idx_investments_platform on investments(platform_id) where platform_id is not null;
create index if not exists idx_trades_platform on trades(platform_id) where platform_id is not null;
create index if not exists idx_investments_user_asset on investments(user_id, asset);

-- ---------------------------------------------------------------------------
-- 3. Investments: buys and sells
-- ---------------------------------------------------------------------------

-- Every existing row is a purchase, which is what the default records.
-- `units`, `price_per_unit` and `total_amount` stay positive on both sides:
-- the side carries the sign, so no consumer has to guess one from the other.
alter table investments
  add column if not exists side text not null default 'buy';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'investments_side_check'
  ) then
    alter table investments
      add constraint investments_side_check check (side in ('buy', 'sell'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Manual prices for assets with no market quote
-- ---------------------------------------------------------------------------

-- One current price per user and asset. A row here overrides the automatic
-- quote, so it also fixes an asset whose ticker the quote sources misread.
create table if not exists asset_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  asset text not null,
  price numeric not null check (price > 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD')),
  updated_at timestamptz not null default now(),
  unique (user_id, asset)
);

alter table asset_prices enable row level security;

drop policy if exists "own rows: select" on asset_prices;
drop policy if exists "own rows: insert" on asset_prices;
drop policy if exists "own rows: update" on asset_prices;
drop policy if exists "own rows: delete" on asset_prices;

create policy "own rows: select" on asset_prices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on asset_prices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on asset_prices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on asset_prices for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- Fresh statistics, so the planner uses the new indexes straight away.
analyze platforms;
analyze expenses;
analyze incomes;
analyze patrimony_snapshots;
analyze patrimony_snapshot_items;
analyze investments;
analyze expense_categories;
analyze trades;
analyze asset_prices;
