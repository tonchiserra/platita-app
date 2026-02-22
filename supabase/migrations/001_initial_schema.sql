-- Platforms: user-configurable financial platforms
create table platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('bank', 'crypto_exchange', 'investment_broker', 'cash', 'other')),
  default_currency text not null default 'ARS',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table platforms enable row level security;

create policy "Users can view own platforms"
  on platforms for select using (auth.uid() = user_id);
create policy "Users can insert own platforms"
  on platforms for insert with check (auth.uid() = user_id);
create policy "Users can update own platforms"
  on platforms for update using (auth.uid() = user_id);
create policy "Users can delete own platforms"
  on platforms for delete using (auth.uid() = user_id);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'ARS',
  category text not null,
  description text not null default '',
  date date not null,
  platform_id uuid references platforms(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create policy "Users can view own expenses"
  on expenses for select using (auth.uid() = user_id);
create policy "Users can insert own expenses"
  on expenses for insert with check (auth.uid() = user_id);
create policy "Users can update own expenses"
  on expenses for update using (auth.uid() = user_id);
create policy "Users can delete own expenses"
  on expenses for delete using (auth.uid() = user_id);

-- Incomes
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'ARS',
  source text not null,
  description text not null default '',
  date date not null,
  platform_id uuid references platforms(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table incomes enable row level security;

create policy "Users can view own incomes"
  on incomes for select using (auth.uid() = user_id);
create policy "Users can insert own incomes"
  on incomes for insert with check (auth.uid() = user_id);
create policy "Users can update own incomes"
  on incomes for update using (auth.uid() = user_id);
create policy "Users can delete own incomes"
  on incomes for delete using (auth.uid() = user_id);

-- Patrimony snapshots (monthly balance header)
create table patrimony_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  total_ars numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table patrimony_snapshots enable row level security;

create policy "Users can view own snapshots"
  on patrimony_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert own snapshots"
  on patrimony_snapshots for insert with check (auth.uid() = user_id);
create policy "Users can update own snapshots"
  on patrimony_snapshots for update using (auth.uid() = user_id);
create policy "Users can delete own snapshots"
  on patrimony_snapshots for delete using (auth.uid() = user_id);

-- Patrimony snapshot items (individual platform/currency balances)
create table patrimony_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references patrimony_snapshots(id) on delete cascade not null,
  platform_id uuid references platforms(id) on delete cascade not null,
  currency text not null,
  amount numeric not null default 0
);

alter table patrimony_snapshot_items enable row level security;

create policy "Users can view own snapshot items"
  on patrimony_snapshot_items for select
  using (
    exists (
      select 1 from patrimony_snapshots
      where patrimony_snapshots.id = patrimony_snapshot_items.snapshot_id
      and patrimony_snapshots.user_id = auth.uid()
    )
  );

create policy "Users can insert own snapshot items"
  on patrimony_snapshot_items for insert
  with check (
    exists (
      select 1 from patrimony_snapshots
      where patrimony_snapshots.id = patrimony_snapshot_items.snapshot_id
      and patrimony_snapshots.user_id = auth.uid()
    )
  );

create policy "Users can update own snapshot items"
  on patrimony_snapshot_items for update
  using (
    exists (
      select 1 from patrimony_snapshots
      where patrimony_snapshots.id = patrimony_snapshot_items.snapshot_id
      and patrimony_snapshots.user_id = auth.uid()
    )
  );

create policy "Users can delete own snapshot items"
  on patrimony_snapshot_items for delete
  using (
    exists (
      select 1 from patrimony_snapshots
      where patrimony_snapshots.id = patrimony_snapshot_items.snapshot_id
      and patrimony_snapshots.user_id = auth.uid()
    )
  );

-- Investments (buy transactions)
create table investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  asset text not null,
  asset_type text not null check (asset_type in ('crypto', 'stock', 'bond', 'cedear', 'other')),
  units numeric not null,
  price_per_unit numeric not null,
  total_amount numeric not null,
  currency text not null default 'ARS',
  platform_id uuid references platforms(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table investments enable row level security;

create policy "Users can view own investments"
  on investments for select using (auth.uid() = user_id);
create policy "Users can insert own investments"
  on investments for insert with check (auth.uid() = user_id);
create policy "Users can update own investments"
  on investments for update using (auth.uid() = user_id);
create policy "Users can delete own investments"
  on investments for delete using (auth.uid() = user_id);

-- Indexes for common queries
create index idx_expenses_user_date on expenses(user_id, date desc);
create index idx_expenses_user_category on expenses(user_id, category);
create index idx_incomes_user_date on incomes(user_id, date desc);
create index idx_patrimony_snapshots_user_date on patrimony_snapshots(user_id, date desc);
create index idx_investments_user_date on investments(user_id, date desc);
create index idx_platforms_user on platforms(user_id);
