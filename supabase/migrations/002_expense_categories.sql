-- User-editable expense categories.
--
-- `expenses.category` stays free text on purpose: renaming or deleting a
-- category here must not orphan or rewrite historical rows. This table is the
-- list offered in the picker, not a foreign key.

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text not null default '📌',
  -- Monthly-fixed charges (rent, utilities, subscriptions) are held flat when
  -- projecting month-end spend, instead of being scaled as a daily rate.
  is_fixed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table expense_categories enable row level security;

create policy "Users can view own categories"
  on expense_categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories"
  on expense_categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories"
  on expense_categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories"
  on expense_categories for delete using (auth.uid() = user_id);

create index idx_expense_categories_user on expense_categories(user_id, sort_order);
