-- 006 · Exchange secrets in Supabase Vault, signed inside the database
--
-- Replaces 005's AES column, which needed an EXCHANGE_SECRET_KEY variable on
-- Vercel. Now nobody uploads anything anywhere: each user pastes a key in
-- Ajustes and it lives in Vault, encrypted by Supabase.
--
-- The secret never leaves Postgres. The server asks `bingx_sign` to sign a
-- query and gets back only the HMAC. The function signs only the shapes of the
-- two history reads the sync makes (income, position history). Its parameter
-- names belong to no order, transfer or withdrawal endpoint, and its timestamp
-- must be within 10 s of now, so a signature is useless anywhere else and
-- expires at once.
--
-- Users can no longer insert a connection or point it at another secret:
-- inserts go through `bingx_save_key`, and they may only update the columns the
-- sync and the platform picker touch.
--
-- Design: docs/plans/2026-11-21-sincronizacion-bingx-design.md.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

-- It holds where imports start, which is the connection time only for
-- "from now on". For "everything" it starts a year back.
alter table exchange_connections rename column connected_at to import_from;

alter table exchange_connections add column secret_id uuid;
-- The AES ciphertext of 005. A connection without a secret asks to reconnect.
alter table exchange_connections drop column api_secret;

-- ---------------------------------------------------------------------------
-- 2. Privileges: rows are created by bingx_save_key only
-- ---------------------------------------------------------------------------

revoke insert, update on exchange_connections from anon, authenticated;
grant update (platform_id, synced_until, last_sync_at, last_error) on exchange_connections to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Save a key
-- ---------------------------------------------------------------------------

-- Creates the connection, or replaces the key of an existing one. A replaced key
-- keeps `import_from`, the cursor and the platform (changed on its own picker),
-- so rotating it leaves no gap and loses no setting.
-- The route tries the key against BingX before calling this.
create or replace function public.bingx_save_key(
  p_api_key text,
  p_api_secret text,
  p_platform_id uuid,
  p_import_from timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conn public.exchange_connections;
  sid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(length(p_api_key), 0) = 0 or coalesce(length(p_api_secret), 0) = 0
     or length(p_api_key) > 256 or length(p_api_secret) > 256 then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if p_platform_id is not null
     and not exists (select 1 from public.platforms where id = p_platform_id and user_id = uid) then
    raise exception 'unknown platform' using errcode = '22023';
  end if;

  select * into conn from public.exchange_connections
   where user_id = uid and exchange = 'bingx'
   for update;

  if found and conn.secret_id is not null then
    perform vault.update_secret(conn.secret_id, p_api_secret);
    update public.exchange_connections
       set api_key = p_api_key, last_error = null
     where id = conn.id;
    return;
  end if;

  sid := vault.create_secret(
    p_api_secret,
    'platita:bingx:' || uid::text || ':' || gen_random_uuid()::text,
    'BingX API secret of a Platita user (read-only key).'
  );

  if found then
    update public.exchange_connections
       set api_key = p_api_key, secret_id = sid, last_error = null
     where id = conn.id;
  else
    insert into public.exchange_connections (user_id, exchange, api_key, secret_id, platform_id, import_from)
    values (uid, 'bingx', p_api_key, sid, p_platform_id, coalesce(p_import_from, now()));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Sign a history read
-- ---------------------------------------------------------------------------

-- `p_payload` is BingX's canonical string: params sorted by key, unencoded,
-- `k=v&k=v`. Only two shapes are signed:
--   income:           startTime, endTime (+ limit)
--   position history: symbol, startTs, endTs (+ pageIndex, pageSize)
-- Both carry a timestamp within 10 s of now.
create or replace function public.bingx_sign(p_payload text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pair text;
  keys text[] := '{}';
  ts bigint;
  secret text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_payload is null or length(p_payload) > 400
     or p_payload !~ '^[A-Za-z]+=[A-Za-z0-9-]+(&[A-Za-z]+=[A-Za-z0-9-]+)*$' then
    raise exception 'payload not allowed' using errcode = '22023';
  end if;

  foreach pair in array string_to_array(p_payload, '&') loop
    keys := keys || split_part(pair, '=', 1);
  end loop;
  if not keys <@ array['symbol', 'startTs', 'endTs', 'startTime', 'endTime', 'pageIndex', 'pageSize', 'limit', 'timestamp', 'recvWindow'] then
    raise exception 'payload not allowed' using errcode = '22023';
  end if;
  if not (keys @> array['symbol', 'startTs', 'endTs'] or keys @> array['startTime', 'endTime']) then
    raise exception 'payload not allowed' using errcode = '22023';
  end if;

  ts := substring(p_payload from '(?:^|&)timestamp=([0-9]+)')::bigint;
  if ts is null or abs(ts - (extract(epoch from clock_timestamp()) * 1000)::bigint) > 10000 then
    raise exception 'stale timestamp' using errcode = '22023';
  end if;

  select ds.decrypted_secret into secret
    from public.exchange_connections c
    join vault.decrypted_secrets ds on ds.id = c.secret_id
   where c.user_id = uid and c.exchange = 'bingx'
     and ds.name like 'platita:bingx:' || uid::text || ':%';
  if secret is null then
    raise exception 'no key' using errcode = 'P0002';
  end if;

  return encode(extensions.hmac(p_payload, secret, 'sha256'), 'hex');
end;
$$;

revoke all on function public.bingx_save_key(text, text, uuid, timestamptz) from public, anon;
revoke all on function public.bingx_sign(text) from public, anon;
grant execute on function public.bingx_save_key(text, text, uuid, timestamptz) to authenticated;
grant execute on function public.bingx_sign(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Disconnecting (or deleting the account) deletes the secret
-- ---------------------------------------------------------------------------

create or replace function public.exchange_connections_drop_secret() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end;
$$;

revoke all on function public.exchange_connections_drop_secret() from public, anon, authenticated;

create trigger exchange_connections_drop_secret
  after delete on exchange_connections
  for each row execute function public.exchange_connections_drop_secret();

commit;
