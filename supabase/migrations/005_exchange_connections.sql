-- 005 · Exchange connections (BingX)
--
-- Additive: it creates one table and adds two nullable columns. It rewrites no
-- data. Design: docs/plans/2026-11-21-sincronizacion-bingx-design.md.
--
-- 1. `exchange_connections` holds each user's read-only API key. The secret is
--    stored encrypted (AES-256-GCM, sealed in the Node server with
--    EXCHANGE_SECRET_KEY), so this column is useless without that variable.
-- 2. `trades` learns where a row came from. An imported operation carries the
--    exchange's position id, and a unique index makes a repeated sync a no-op.

begin;

-- ---------------------------------------------------------------------------
-- 1. Connections
-- ---------------------------------------------------------------------------

create table exchange_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  exchange text not null check (exchange in ('bingx')),
  api_key text not null,
  -- `v1.<iv>.<tag>.<ciphertext>`, base64url. Never sent to the browser.
  api_secret text not null,
  -- Imported operations are stamped with this platform.
  platform_id uuid references platforms(id) on delete set null,
  -- Only positions closed after this moment are imported.
  connected_at timestamptz not null default now(),
  -- End of the last window synced successfully. Null until the first sync.
  synced_until timestamptz,
  -- Last attempt, successful or not, and its error in Spanish.
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, exchange)
);

create index idx_exchange_connections_platform on exchange_connections(platform_id);

alter table exchange_connections enable row level security;

create policy "own rows: select" on exchange_connections for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on exchange_connections for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on exchange_connections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on exchange_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Imported trades
-- ---------------------------------------------------------------------------

-- Null for an operation typed by hand.
alter table trades add column source text check (source is null or source in ('bingx'));
-- The exchange's own id for the operation (BingX: `positionId`).
alter table trades add column external_id text;
alter table trades add constraint trades_external_requires_source
  check (external_id is null or source is not null);

-- Not partial on purpose: PostgREST's `on_conflict` cannot infer a partial
-- index. Manual rows never collide, because nulls are distinct.
create unique index trades_user_source_external on trades(user_id, source, external_id);

commit;
