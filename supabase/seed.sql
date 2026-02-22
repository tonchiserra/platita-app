-- =============================================================================
-- Seed Patrimony Data from CSV
-- =============================================================================
-- Run this in Supabase SQL Editor after registering with tonchiserra@gmail.com
--
-- This script will:
--   1. Look up the user by email tonchiserra@gmail.com
--   2. Create 7 platforms (Lemon, Uala, Brubank, NaranjaX, Cocos, Otros, Efectivo)
--   3. Create 48 patrimony snapshots with their corresponding items
--   4. Only insert snapshot items where the amount is > 0
-- =============================================================================

DO $$
DECLARE
  v_user_id uuid;

  -- Platform IDs
  v_lemon_id uuid;
  v_uala_id uuid;
  v_brubank_id uuid;
  v_naranjax_id uuid;
  v_cocos_id uuid;
  v_otros_id uuid;
  v_efectivo_id uuid;

  -- Snapshot ID (reused per row)
  v_snapshot_id uuid;

BEGIN
  -- Look up user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'tonchiserra@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email tonchiserra@gmail.com not found. Register first.';
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- =========================================================================
  -- 1. Create Platforms
  -- =========================================================================
  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Lemon', 'crypto_exchange', 'ARS', true)
  RETURNING id INTO v_lemon_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Uala', 'bank', 'ARS', true)
  RETURNING id INTO v_uala_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Brubank', 'bank', 'ARS', true)
  RETURNING id INTO v_brubank_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'NaranjaX', 'bank', 'ARS', true)
  RETURNING id INTO v_naranjax_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Cocos', 'investment_broker', 'ARS', true)
  RETURNING id INTO v_cocos_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Otros', 'other', 'USD', true)
  RETURNING id INTO v_otros_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Efectivo', 'cash', 'ARS', true)
  RETURNING id INTO v_efectivo_id;

  -- =========================================================================
  -- 2. Create Patrimony Snapshots and Items
  -- =========================================================================

  -- Row 1: 2021-12-20
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2021-12-20', 20892.20, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 323.15),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00003545),
    (v_snapshot_id, v_uala_id, 'ARS', 1139.05),
    (v_snapshot_id, v_efectivo_id, 'ARS', 1180.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 85.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 2: 2021-12-27
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2021-12-27', 23624.21, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 357.09),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00003545),
    (v_snapshot_id, v_uala_id, 'ARS', 747.12),
    (v_snapshot_id, v_efectivo_id, 'ARS', 2270.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 95.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 3: 2022-01-06
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-01-06', 23675.54, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2378.65),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00017583),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00129239),
    (v_snapshot_id, v_uala_id, 'ARS', 751.89),
    (v_snapshot_id, v_efectivo_id, 'ARS', 1870.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 85.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 4: 2022-01-24
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-01-24', 25825.22, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2138.05),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00017613),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00129239),
    (v_snapshot_id, v_uala_id, 'ARS', 1462.17),
    (v_snapshot_id, v_efectivo_id, 'ARS', 2360.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 85.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 5: 2022-02-23
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-02-23', 28227.86, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2536.10),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00017661),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00219969),
    (v_snapshot_id, v_uala_id, 'ARS', 1271.76),
    (v_snapshot_id, v_efectivo_id, 'ARS', 5575.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 85.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 6: 2022-03-22
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-03-22', 25027.36, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4175.74),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00024336),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00220645),
    (v_snapshot_id, v_lemon_id, 'USD', 5.183246),
    (v_snapshot_id, v_uala_id, 'ARS', 1341.62),
    (v_snapshot_id, v_efectivo_id, 'ARS', 6260.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 7: 2022-04-21
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-04-21', 24719.82, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4719.03),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00014462),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00250161),
    (v_snapshot_id, v_lemon_id, 'USD', 10.412346),
    (v_snapshot_id, v_uala_id, 'ARS', 60.79),
    (v_snapshot_id, v_efectivo_id, 'ARS', 6690.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 8: 2022-05-24
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-05-24', 24340.72, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2508.00),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00022509),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00251106),
    (v_snapshot_id, v_lemon_id, 'USD', 14.767827),
    (v_snapshot_id, v_uala_id, 'ARS', 62.72),
    (v_snapshot_id, v_efectivo_id, 'ARS', 8520.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 9: 2022-08-09
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-08-09', 124225.10, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2752.26),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00023464),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00253239),
    (v_snapshot_id, v_uala_id, 'ARS', 67.84),
    (v_snapshot_id, v_otros_id, 'USD', 300.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 14460.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 10: 2022-09-06
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-09-06', 171622.70, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 9211.70),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00023930),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00254003),
    (v_snapshot_id, v_lemon_id, 'USD', 24.556687),
    (v_snapshot_id, v_uala_id, 'ARS', 70.85),
    (v_snapshot_id, v_otros_id, 'USD', 518.30),
    (v_snapshot_id, v_efectivo_id, 'ARS', 4180.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 11: 2022-10-05
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-10-05', 238765.73, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 6720.10),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00028302),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00254768),
    (v_snapshot_id, v_lemon_id, 'USD', 13.140507),
    (v_snapshot_id, v_uala_id, 'ARS', 74.23),
    (v_snapshot_id, v_otros_id, 'USD', 714.80),
    (v_snapshot_id, v_efectivo_id, 'ARS', 3360.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 12: 2022-11-03
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-11-03', 296550.80, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 36931.16),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00028386),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00255536),
    (v_snapshot_id, v_lemon_id, 'USD', 115.91496),
    (v_snapshot_id, v_uala_id, 'ARS', 77.74),
    (v_snapshot_id, v_otros_id, 'USD', 807.82),
    (v_snapshot_id, v_efectivo_id, 'ARS', 2060.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 60.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 13: 2022-12-08
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2022-12-08', 347140.54, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 11211.49),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00028815),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256173),
    (v_snapshot_id, v_lemon_id, 'USD', 23.462123),
    (v_snapshot_id, v_uala_id, 'ARS', 131.93),
    (v_snapshot_id, v_otros_id, 'USD', 43.82),
    (v_snapshot_id, v_efectivo_id, 'ARS', 840.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1010.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 14: 2023-01-05
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-01-05', 553585.81, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 5533.72),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029067),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256369),
    (v_snapshot_id, v_lemon_id, 'USD', 7.802875),
    (v_snapshot_id, v_uala_id, 'ARS', 1212.83),
    (v_snapshot_id, v_otros_id, 'USD', 602.42),
    (v_snapshot_id, v_efectivo_id, 'ARS', 11190.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 910.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 15: 2023-02-11
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-02-11', 764010.52, 'Mac')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 3938.30),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029067),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_uala_id, 'ARS', 8367.62),
    (v_snapshot_id, v_otros_id, 'USD', 550.67),
    (v_snapshot_id, v_efectivo_id, 'ARS', 19950.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1370.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 16: 2023-03-09
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-03-09', 537185.01, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 25451.77),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029067),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 58.001164),
    (v_snapshot_id, v_uala_id, 'ARS', 8455.24),
    (v_snapshot_id, v_otros_id, 'USD', 447.17),
    (v_snapshot_id, v_efectivo_id, 'ARS', 14410.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 770.00),
    (v_snapshot_id, v_efectivo_id, 'EUR', 5.00);

  -- Row 17: 2023-04-10
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-04-10', 678998.25, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 34722.69),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029255),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 58.5825),
    (v_snapshot_id, v_uala_id, 'ARS', 11993.56),
    (v_snapshot_id, v_otros_id, 'USD', 343.68),
    (v_snapshot_id, v_efectivo_id, 'ARS', 18810.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1190.00);

  -- Row 18: 2023-05-23
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-05-23', 924656.02, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 30151.04),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029356),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 50.646029),
    (v_snapshot_id, v_uala_id, 'ARS', 12633.48),
    (v_snapshot_id, v_otros_id, 'USD', 268.70),
    (v_snapshot_id, v_efectivo_id, 'ARS', 18740.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1475.00);

  -- Row 19: 2023-07-23
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-07-23', 1223668.11, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 123632.57),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029434),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 225.19),
    (v_snapshot_id, v_uala_id, 'ARS', 12169.54),
    (v_snapshot_id, v_efectivo_id, 'ARS', 12330.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2037.00);

  -- Row 20: 2023-08-19
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-08-19', 1804019.17, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 136123.85),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029503),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 180.20),
    (v_snapshot_id, v_uala_id, 'ARS', 11925.32),
    (v_snapshot_id, v_efectivo_id, 'ARS', 18690.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2274.00);

  -- Row 21: 2023-09-16
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-09-16', 1977995.43, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 103773.70),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029585),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 132.56),
    (v_snapshot_id, v_uala_id, 'ARS', 12321.73),
    (v_snapshot_id, v_efectivo_id, 'ARS', 33250.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2505.00);

  -- Row 22: 2023-10-31
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-10-31', 2749827.16, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 71869.09),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029716),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 69.99094),
    (v_snapshot_id, v_uala_id, 'ARS', 12078.07),
    (v_snapshot_id, v_efectivo_id, 'ARS', 20030.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2845.00);

  -- Row 23: 2023-11-25
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-11-25', 3095339.63, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 31273.86),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029716),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 18.23),
    (v_snapshot_id, v_uala_id, 'ARS', 11995.77),
    (v_snapshot_id, v_efectivo_id, 'ARS', 12070.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3040.00);

  -- Row 24: 2023-12-18
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2023-12-18', 3287860.26, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 20844.58),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029763),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 3.03),
    (v_snapshot_id, v_uala_id, 'ARS', 12725.68),
    (v_snapshot_id, v_efectivo_id, 'ARS', 19290.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3235.00);

  -- Row 25: 2024-01-09
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-01-09', 4354357.57, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 236496.74),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029802),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 190.44),
    (v_snapshot_id, v_uala_id, 'ARS', 13510.83),
    (v_snapshot_id, v_efectivo_id, 'ARS', 16350.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3650.00);

  -- Row 26: 2024-02-06
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-02-06', 5356823.20, 'Mudanza')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 195290.34),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00029835),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 136.94),
    (v_snapshot_id, v_uala_id, 'ARS', 12273.86),
    (v_snapshot_id, v_efectivo_id, 'ARS', 520.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 4630.00);

  -- Row 27: 2024-03-06
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-03-06', 3403330.92, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 848945.83),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00033774),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256516),
    (v_snapshot_id, v_lemon_id, 'USD', 805.55),
    (v_snapshot_id, v_uala_id, 'ARS', 13205.09),
    (v_snapshot_id, v_efectivo_id, 'ARS', 204048.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2314.00);

  -- Row 28: 2024-04-14
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-04-14', 3370665.62, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 559802.90),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00036485),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00256925),
    (v_snapshot_id, v_lemon_id, 'USD', 507.19),
    (v_snapshot_id, v_uala_id, 'ARS', 77.48),
    (v_snapshot_id, v_brubank_id, 'ARS', 22925.00),
    (v_snapshot_id, v_naranjax_id, 'ARS', 116080.24),
    (v_snapshot_id, v_efectivo_id, 'ARS', 157270.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2502.00);

  -- Row 29: 2024-05-22
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-05-22', 4351974.13, 'Vacaciones')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1077669.90),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00037925),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00257373),
    (v_snapshot_id, v_lemon_id, 'USD', 873.66),
    (v_snapshot_id, v_uala_id, 'ARS', 81.26),
    (v_snapshot_id, v_brubank_id, 'ARS', 24500.00),
    (v_snapshot_id, v_naranjax_id, 'ARS', 82892.97),
    (v_snapshot_id, v_efectivo_id, 'ARS', 218430.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2340.00);

  -- Row 30: 2024-06-24
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-06-24', 4061396.02, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 960364.41),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00039796),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00257845),
    (v_snapshot_id, v_lemon_id, 'USD', 712.05),
    (v_snapshot_id, v_uala_id, 'ARS', 83.21),
    (v_snapshot_id, v_brubank_id, 'ARS', 105840.81),
    (v_snapshot_id, v_naranjax_id, 'ARS', 72277.59),
    (v_snapshot_id, v_efectivo_id, 'ARS', 199670.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2063.00);

  -- Row 31: 2024-07-16
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-07-16', 5309199.02, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1183990.05),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00043180),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00258175),
    (v_snapshot_id, v_lemon_id, 'USD', 876.82),
    (v_snapshot_id, v_uala_id, 'ARS', 85.14),
    (v_snapshot_id, v_brubank_id, 'ARS', 189090.00),
    (v_snapshot_id, v_naranjax_id, 'ARS', 62663.83),
    (v_snapshot_id, v_efectivo_id, 'ARS', 114370.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2658.00);

  -- Row 32: 2024-08-13
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-08-13', 6059995.89, 'Dolar de 1450 a 1230')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1111650.35),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00043939),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00258579),
    (v_snapshot_id, v_lemon_id, 'USD', 849.07),
    (v_snapshot_id, v_uala_id, 'ARS', 87.34),
    (v_snapshot_id, v_brubank_id, 'ARS', 214250.22),
    (v_snapshot_id, v_naranjax_id, 'ARS', 49467.98),
    (v_snapshot_id, v_efectivo_id, 'ARS', 94540.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3400.00);

  -- Row 33: 2024-09-17
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-09-17', 6009006.33, NULL)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2046279.65),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00047238),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00259044),
    (v_snapshot_id, v_lemon_id, 'USD', 1643.62),
    (v_snapshot_id, v_uala_id, 'ARS', 38412.11),
    (v_snapshot_id, v_brubank_id, 'ARS', 279484.57),
    (v_snapshot_id, v_efectivo_id, 'ARS', 41230.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2860.00);

  -- Row 34: 2024-10-07
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-10-07', 6241223.32, 'Dolar de 1230 a 1185')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1749287.61),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00049679),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.00259348),
    (v_snapshot_id, v_lemon_id, 'USD', 1451.71),
    (v_snapshot_id, v_uala_id, 'ARS', 36310.71),
    (v_snapshot_id, v_brubank_id, 'ARS', 384235.00),
    (v_snapshot_id, v_otros_id, 'USD', 1200.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 102240.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2190.00);

  -- Row 35: 2024-11-11
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-11-11', 6010787.06, 'Dolar de 1185 a 1130')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1261361.35),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00063201),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.11376764),
    (v_snapshot_id, v_lemon_id, 'USD', 704.40),
    (v_snapshot_id, v_uala_id, 'ARS', 20995.71),
    (v_snapshot_id, v_brubank_id, 'ARS', 491240.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 78790.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3680.00);

  -- Row 36: 2024-12-18
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2024-12-18', 6604985.81, 'Dolar de 1130 a 1185')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 1904832.73),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00067622),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.18337927),
    (v_snapshot_id, v_lemon_id, 'USD', 270.21),
    (v_snapshot_id, v_uala_id, 'ARS', 7178.56),
    (v_snapshot_id, v_brubank_id, 'ARS', 730381.00),
    (v_snapshot_id, v_naranjax_id, 'ARS', 203013.52),
    (v_snapshot_id, v_efectivo_id, 'ARS', 69490.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 3114.00);

  -- Row 37: 2025-01-13
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-01-13', 6792040.68, 'Dolar de 1185 a 1220 y bajada crypto')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2507365.12),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00074268),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.18366463),
    (v_snapshot_id, v_lemon_id, 'USD', 1049.58),
    (v_snapshot_id, v_uala_id, 'ARS', 3178.56),
    (v_snapshot_id, v_brubank_id, 'ARS', 976417.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 177000.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2564.00);

  -- Row 38: 2025-02-18
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-02-18', 7177606.69, 'Aumento de sueldo pero baja de crypto')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2664793.69),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00083573),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.18400752),
    (v_snapshot_id, v_lemon_id, 'USD', 1295.83),
    (v_snapshot_id, v_brubank_id, 'ARS', 1362423.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 175020.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2419.00);

  -- Row 39: 2025-03-17
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-03-17', 7959716.03, 'Baja de crypto')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2693872.80),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00715612),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.18429177),
    (v_snapshot_id, v_lemon_id, 'USD', 968.24),
    (v_snapshot_id, v_uala_id, 'ARS', 202521.23),
    (v_snapshot_id, v_brubank_id, 'ARS', 2002852.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 85100.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2419.00);

  -- Row 40: 2025-04-11
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-04-11', 9481673.32, 'Baja de acciones pero suba de dolar a 1355')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 3215352.26),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00718413),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.32068544),
    (v_snapshot_id, v_lemon_id, 'USD', 1044.11),
    (v_snapshot_id, v_uala_id, 'ARS', 821726.06),
    (v_snapshot_id, v_brubank_id, 'ARS', 2053480.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 113370.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 2419.00);

  -- Row 41: 2025-06-16
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-06-16', 8717338.07, 'Vacaciones')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 3744402.79),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00731655),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.32188074),
    (v_snapshot_id, v_lemon_id, 'USD', 1315.92),
    (v_snapshot_id, v_uala_id, 'ARS', 385388.88),
    (v_snapshot_id, v_brubank_id, 'ARS', 2545028.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 533498.40),
    (v_snapshot_id, v_efectivo_id, 'ARS', 195680.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 42: 2025-07-14
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-07-14', 10890212.55, 'Dolar 1330. BTC 120k, ETH 3k, aguinaldo')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4167440.72),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00735195),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.18580384),
    (v_snapshot_id, v_lemon_id, 'USD', 1698.79),
    (v_snapshot_id, v_uala_id, 'ARS', 305335.31),
    (v_snapshot_id, v_brubank_id, 'ARS', 3724006.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 1127930.52),
    (v_snapshot_id, v_efectivo_id, 'ARS', 85210.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 43: 2025-08-12
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-08-12', 12319020.67, 'Dolar 1320. BTC 120k, ETH 4.3k')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4696103.86),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00738253),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.08420569),
    (v_snapshot_id, v_lemon_id, 'USD', 2235.91),
    (v_snapshot_id, v_uala_id, 'ARS', 268376.69),
    (v_snapshot_id, v_brubank_id, 'ARS', 4213003.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 1459807.12),
    (v_snapshot_id, v_efectivo_id, 'ARS', 212570.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 44: 2025-09-15
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-09-15', 14113224.34, 'Dolar 1445. BTC 114k, ETH 4.5k')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4893280.92),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00742582),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.08437928),
    (v_snapshot_id, v_lemon_id, 'USD', 1969.76),
    (v_snapshot_id, v_uala_id, 'ARS', 241787.09),
    (v_snapshot_id, v_brubank_id, 'ARS', 5362721.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 1977520.33),
    (v_snapshot_id, v_efectivo_id, 'ARS', 29630.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 45: 2025-10-18
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-10-18', 15283431.01, 'Dolar 1485. BTC 107k, ETH 3.8k')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 5060933.94),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00746744),
    (v_snapshot_id, v_lemon_id, 'ETH', 0.08475697),
    (v_snapshot_id, v_lemon_id, 'USD', 1749.00),
    (v_snapshot_id, v_brubank_id, 'ARS', 5785885.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 2600277.07),
    (v_snapshot_id, v_efectivo_id, 'ARS', 193530.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 46: 2025-11-20
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-11-20', 15684915.19, 'Dolar 1415. BTC 87k, ETH 2.8k')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 4384767.62),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00860727),
    (v_snapshot_id, v_lemon_id, 'USD', 2300.49),
    (v_snapshot_id, v_brubank_id, 'ARS', 5373847.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 4211665.57),
    (v_snapshot_id, v_efectivo_id, 'ARS', 139740.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 47: 2025-12-16
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-12-16', 19298832.54, 'Dolar 1480 y Aguinaldo')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 3189274.92),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00269623),
    (v_snapshot_id, v_lemon_id, 'USD', 1912.46),
    (v_snapshot_id, v_brubank_id, 'ARS', 6617301.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 5739396.62),
    (v_snapshot_id, v_otros_id, 'USD', 1331.00),
    (v_snapshot_id, v_efectivo_id, 'ARS', 135740.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  -- Row 48: 2026-01-20
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2026-01-20', 18016586.94, 'Dolar 1465, Camara y Mendoza')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_lemon_id, 'ARS', 2142084.55),
    (v_snapshot_id, v_lemon_id, 'BTC', 0.00001730),
    (v_snapshot_id, v_lemon_id, 'USD', 1461.49),
    (v_snapshot_id, v_brubank_id, 'ARS', 5563930.00),
    (v_snapshot_id, v_cocos_id, 'ARS', 6119090.09),
    (v_snapshot_id, v_otros_id, 'USD', 1630.22),
    (v_snapshot_id, v_efectivo_id, 'ARS', 144840.00),
    (v_snapshot_id, v_efectivo_id, 'USD', 1113.00);

  RAISE NOTICE 'Seed completed: 7 platforms, 48 snapshots with items created successfully.';
END $$;
