-- =============================================================================
-- Seed Demo User — 18 months of data, relative to today
-- =============================================================================
-- Run in the Supabase SQL Editor after registering demo@platita.app.
--
-- Dates are generated from current_date rather than written as literals, so
-- the demo never goes stale: the last close is always last month, and the
-- current month is always partially filled.
--
-- Re-running is safe. Every table is cleared for this user first.
--
-- Requires migration 002 (expense_categories).
-- =============================================================================

DO $$
DECLARE
  v_user_id uuid;

  v_galicia_id uuid;
  v_mp_id      uuid;
  v_belo_id    uuid;
  v_cocos_id   uuid;
  v_efectivo_id uuid;
  v_snapshot_id uuid;

  m          int;      -- months back from the current one
  d_start    date;     -- first day of that month
  d_end      date;     -- last day of that month
  age        int;      -- months elapsed since the start of the series

  infl       numeric;  -- price level, compounding month to month
  blue       numeric;  -- ARS per USD that month
  btc_usd    numeric;  -- BTC price that month

  salary     numeric;
  freelance  numeric;  -- in USD
  e_rent     numeric;
  e_subs     numeric;
  e_bills    numeric;
  e_super    numeric;  -- per shop, four a month
  e_transp   numeric;
  e_food     numeric;
  e_fun      numeric;
  e_care     numeric;
  e_extra    numeric;  -- occasional, not every month
  month_out  numeric;  -- everything spent that month, in ARS

  -- running balances, so the closes agree with the flows
  b_galicia  numeric := 900000;
  b_mp       numeric := 150000;
  b_belo_usd numeric := 1200;
  b_cash_usd numeric := 800;
  b_cocos    numeric := 300000;
  b_btc      numeric := 0.015;
  to_cocos   numeric;  -- aporte mensual al broker, traspaso interno
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@platita.app';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe el usuario demo@platita.app. Registralo primero desde /register.';
  END IF;

  -- ---------------------------------------------------------------- limpieza
  DELETE FROM patrimony_snapshot_items
   WHERE snapshot_id IN (SELECT id FROM patrimony_snapshots WHERE user_id = v_user_id);
  DELETE FROM patrimony_snapshots  WHERE user_id = v_user_id;
  DELETE FROM expenses             WHERE user_id = v_user_id;
  DELETE FROM incomes              WHERE user_id = v_user_id;
  DELETE FROM investments          WHERE user_id = v_user_id;
  DELETE FROM platforms            WHERE user_id = v_user_id;

  -- ------------------------------------------------------------ plataformas
  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Banco Galicia', 'bank', 'ARS', true) RETURNING id INTO v_galicia_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Mercado Pago', 'bank', 'ARS', true) RETURNING id INTO v_mp_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Belo', 'crypto_exchange', 'USD', true) RETURNING id INTO v_belo_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Cocos Capital', 'investment_broker', 'ARS', true) RETURNING id INTO v_cocos_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Efectivo', 'cash', 'ARS', true) RETURNING id INTO v_efectivo_id;

  -- -------------------------------------------------------------- categorías
  -- Mirrors EXPENSE_CATEGORIES / CATEGORY_ICONS, with Home and Subscriptions
  -- marked fixed so the month-end projection holds them flat.
  -- Skipped when migration 002 has not been applied, so the rest still loads.
  IF to_regclass('public.expense_categories') IS NULL THEN
    RAISE NOTICE 'expense_categories no existe: falta correr la migración 002. El resto de los datos se cargó igual.';
  ELSE
    DELETE FROM expense_categories WHERE user_id = v_user_id;
    INSERT INTO expense_categories (user_id, name, icon, is_fixed, sort_order) VALUES
      (v_user_id, 'Shopping',          '🛍️', false, 0),
      (v_user_id, 'Entertainment',     '🎬', false, 1),
      (v_user_id, 'Bills & Utilities', '💡', false, 2),
      (v_user_id, 'Education',         '📚', false, 3),
      (v_user_id, 'Travel',            '✈️', false, 4),
      (v_user_id, 'Food',              '🍽️', false, 5),
      (v_user_id, 'Health & Wellness', '💊', false, 6),
      (v_user_id, 'Supermarket',       '🛒', false, 7),
      (v_user_id, 'Transport',         '🚗', false, 8),
      (v_user_id, 'Home',              '🏠', true,  9),
      (v_user_id, 'Friends',           '👥', false, 10),
      (v_user_id, 'Pets',              '🐾', false, 11),
      (v_user_id, 'Gifts',             '🎁', false, 12),
      (v_user_id, 'Personal Care',     '💇', false, 13),
      (v_user_id, 'Subscriptions',     '📱', true,  14),
      (v_user_id, 'Savings',           '💰', false, 15),
      (v_user_id, 'Other',             '📌', false, 16);
  END IF;

  -- ------------------------------------------------- 18 meses de movimientos
  FOR m IN REVERSE 17..0 LOOP
    d_start := (date_trunc('month', current_date) - make_interval(months => m))::date;
    d_end   := (date_trunc('month', d_start) + interval '1 month' - interval '1 day')::date;
    age     := 17 - m;

    infl    := power(1.028, age);                 -- ~2,8 % mensual
    blue    := round(1100 * power(1.032, age));   -- el blue corre un poco arriba
    btc_usd := 60000 + age * 1750;

    salary    := round(1800000 * infl);
    freelance := 400;                              -- USD, constante
    e_rent    := round(450000 * infl);
    e_subs    := round( 38000 * infl);
    e_bills   := round( 95000 * infl);
    e_super   := round(105000 * infl);
    e_transp  := round( 42000 * infl);
    e_food    := round( 68000 * infl);
    e_fun     := round( 85000 * infl);
    e_care    := round( 30000 * infl);
    e_extra   := round(160000 * infl);

    month_out := e_rent + e_subs + e_bills + (e_super * 4)
               + (e_transp * 2) + (e_food * 2) + e_fun + e_care;

    -- ingresos -----------------------------------------------------------
    INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id)
    SELECT v_user_id, salary, 'ARS', 'Salary', 'Sueldo', d_start + 4, v_galicia_id
     WHERE d_start + 4 <= current_date;

    INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id)
    SELECT v_user_id, freelance, 'USD', 'Freelance', 'Proyecto freelance', d_start + 19, v_belo_id
     WHERE d_start + 19 <= current_date;

    -- Un retorno de inversión cada seis meses. Cuenta como ingreso en toda la
    -- app, pero el gráfico de alternativas lo deja afuera: no es plata nueva
    -- que entró, es rendimiento de plata que ya estaba.
    IF age % 6 = 3 THEN
      INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id)
      SELECT v_user_id, 260, 'USD', 'Investment Returns', 'Rendimiento cripto', d_start + 24, v_belo_id
       WHERE d_start + 24 <= current_date;
    END IF;

    -- gastos -------------------------------------------------------------
    INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id)
    SELECT * FROM (VALUES
      -- Casts on the first row so the VALUES list has determined types.
      (v_user_id, e_rent,   'ARS'::text, 'Home'::text, 'Alquiler'::text,     d_start + 2,  v_galicia_id),
      (v_user_id, e_subs,   'ARS', 'Subscriptions',     'Spotify y Netflix',   d_start + 0,  v_galicia_id),
      (v_user_id, e_bills,  'ARS', 'Bills & Utilities', 'Luz, gas e internet', d_start + 7,  v_mp_id),
      (v_user_id, e_super,  'ARS', 'Supermarket',       'Coto',                d_start + 5,  v_mp_id),
      (v_user_id, e_super,  'ARS', 'Supermarket',       'Carrefour',           d_start + 12, v_mp_id),
      (v_user_id, e_super,  'ARS', 'Supermarket',       'Chino del barrio',    d_start + 19, v_efectivo_id),
      (v_user_id, e_super,  'ARS', 'Supermarket',       'Coto',                d_start + 26, v_mp_id),
      (v_user_id, e_transp, 'ARS', 'Transport',         'Carga SUBE',          d_start + 4,  v_mp_id),
      (v_user_id, e_transp, 'ARS', 'Transport',         'Nafta',               d_start + 18, v_galicia_id),
      (v_user_id, e_food,   'ARS', 'Food',              'Delivery',            d_start + 9,  v_mp_id),
      (v_user_id, e_food,   'ARS', 'Food',              'Almuerzos',           d_start + 23, v_efectivo_id),
      (v_user_id, e_fun,    'ARS', 'Entertainment',     'Salidas',             d_start + 14, v_galicia_id),
      (v_user_id, e_care,   'ARS', 'Personal Care',     'Peluquería',          d_start + 11, v_efectivo_id)
    ) AS t(uid, amt, cur, cat, descr, dt, plat)
    WHERE t.dt <= current_date;

    -- Algo fuera de lo habitual de vez en cuando, para que el panel de avisos
    -- tenga de qué hablar sin que salte todos los meses.
    IF age % 5 = 2 THEN
      INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id)
      SELECT v_user_id, e_extra, 'ARS', 'Health & Wellness', 'Dentista', d_start + 16, v_galicia_id
       WHERE d_start + 16 <= current_date;
      month_out := month_out + e_extra;
    END IF;

    IF age % 7 = 4 THEN
      INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id)
      SELECT v_user_id, e_extra, 'ARS', 'Shopping', 'Zapatillas', d_start + 21, v_galicia_id
       WHERE d_start + 21 <= current_date;
      month_out := month_out + e_extra;
    END IF;

    -- inversiones --------------------------------------------------------
    IF age % 4 = 1 THEN
      INSERT INTO investments (user_id, date, asset, asset_type, units, price_per_unit, total_amount, currency, platform_id, notes)
      SELECT v_user_id, d_start + 15, 'BTC', 'crypto',
             round(300 / btc_usd, 8), btc_usd, 300, 'USD', v_belo_id, NULL
       WHERE d_start + 15 <= current_date;
      b_btc      := b_btc + round(300 / btc_usd, 8);
      b_belo_usd := b_belo_usd - 300;
    END IF;

    -- saldos y cierre ----------------------------------------------------
    -- Un aporte al broker todos los meses. Es un traspaso entre plataformas,
    -- no un gasto: el patrimonio total no cambia, solo dónde está.
    to_cocos   := round(80000 * infl);
    b_galicia  := b_galicia + salary - month_out - to_cocos;
    b_cocos    := round(b_cocos * 1.03 + to_cocos);
    b_belo_usd := b_belo_usd + freelance + (CASE WHEN age % 6 = 3 THEN 260 ELSE 0 END);
    b_mp       := round(b_mp * 1.01);           -- rinde poco, apenas se mueve

    -- El mes en curso todavía no cerró, así que no lleva snapshot.
    IF m >= 1 THEN
      INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
      VALUES (
        v_user_id,
        d_end,
        round(b_galicia + b_mp + (b_belo_usd + b_cash_usd) * blue + b_btc * btc_usd * blue, 2),
        'Blue ~' || blue::text
      )
      RETURNING id INTO v_snapshot_id;

      INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
        (v_snapshot_id, v_galicia_id,  'ARS', round(b_galicia, 2)),
        (v_snapshot_id, v_mp_id,       'ARS', round(b_mp, 2)),
        (v_snapshot_id, v_cocos_id,    'ARS', round(b_cocos, 2)),
        (v_snapshot_id, v_belo_id,     'USD', round(b_belo_usd, 2)),
        (v_snapshot_id, v_belo_id,     'BTC', round(b_btc, 8)),
        (v_snapshot_id, v_efectivo_id, 'USD', round(b_cash_usd, 2));
    END IF;
  END LOOP;

  RAISE NOTICE 'Listo. Datos para demo@platita.app desde % hasta hoy.',
    (date_trunc('month', current_date) - interval '17 months')::date;
END $$;
