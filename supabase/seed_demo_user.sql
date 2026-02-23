-- =============================================================================
-- Seed Demo User: 1 year of complete test data
-- =============================================================================
-- Run this in Supabase SQL Editor after registering with demo@platita.app
--
-- This script will:
--   1. Look up the user by email demo@platita.app
--   2. Create 6 platforms
--   3. Create ~195 expenses (feb 2025 → feb 2026)
--   4. Create ~33 incomes (feb 2025 → feb 2026)
--   5. Create 8 investments
--   6. Create 12 patrimony snapshots with items
-- =============================================================================

DO $$
DECLARE
  v_user_id uuid;

  -- Platform IDs
  v_galicia_id uuid;
  v_binance_id uuid;
  v_iol_id uuid;
  v_mp_id uuid;
  v_wise_id uuid;
  v_efectivo_id uuid;

  -- Snapshot ID (reused per row)
  v_snapshot_id uuid;

BEGIN
  -- Look up user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@platita.app';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email demo@platita.app not found. Register first.';
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- =========================================================================
  -- 1. Platforms
  -- =========================================================================
  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Banco Galicia', 'bank', 'ARS', true)
  RETURNING id INTO v_galicia_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Binance', 'crypto_exchange', 'USD', true)
  RETURNING id INTO v_binance_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'IOL Inversiones', 'investment_broker', 'ARS', true)
  RETURNING id INTO v_iol_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Mercado Pago', 'bank', 'ARS', true)
  RETURNING id INTO v_mp_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Wise', 'other', 'USD', true)
  RETURNING id INTO v_wise_id;

  INSERT INTO platforms (user_id, name, type, default_currency, is_active)
  VALUES (v_user_id, 'Efectivo', 'cash', 'ARS', true)
  RETURNING id INTO v_efectivo_id;

  -- =========================================================================
  -- 2. Expenses (~195, feb 2025 → feb 2026)
  -- =========================================================================

  -- Febrero 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 85000, 'ARS', 'Supermarket', 'Supermercado Coto', '2025-02-03', v_mp_id),
    (v_user_id, 45000, 'ARS', 'Supermarket', 'Carrefour', '2025-02-15', v_galicia_id),
    (v_user_id, 12000, 'ARS', 'Transport', 'Carga SUBE', '2025-02-05', v_mp_id),
    (v_user_id, 8500, 'ARS', 'Subscriptions', 'Spotify', '2025-02-01', v_galicia_id),
    (v_user_id, 15000, 'ARS', 'Subscriptions', 'Netflix', '2025-02-01', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Food', 'Cena restaurante', '2025-02-08', v_mp_id),
    (v_user_id, 22000, 'ARS', 'Food', 'Pedidos Ya', '2025-02-14', v_mp_id),
    (v_user_id, 65000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-02-10', v_galicia_id),
    (v_user_id, 42000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-02-12', v_galicia_id),
    (v_user_id, 18000, 'ARS', 'Entertainment', 'Cine', '2025-02-22', v_mp_id),
    (v_user_id, 55000, 'ARS', 'Shopping', 'Ropa Zara', '2025-02-18', v_galicia_id),
    (v_user_id, 28000, 'ARS', 'Transport', 'Uber', '2025-02-20', v_mp_id),
    (v_user_id, 15000, 'ARS', 'Personal Care', 'Farmacia', '2025-02-25', v_mp_id),
    (v_user_id, 95000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-02-05', v_galicia_id),
    (v_user_id, 8000, 'ARS', 'Transport', 'Estacionamiento', '2025-02-27', v_efectivo_id);

  -- Marzo 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 92000, 'ARS', 'Supermarket', 'Supermercado Dia', '2025-03-02', v_mp_id),
    (v_user_id, 48000, 'ARS', 'Supermarket', 'Coto semanal', '2025-03-16', v_galicia_id),
    (v_user_id, 12000, 'ARS', 'Transport', 'Carga SUBE', '2025-03-04', v_mp_id),
    (v_user_id, 8500, 'ARS', 'Subscriptions', 'Spotify', '2025-03-01', v_galicia_id),
    (v_user_id, 15000, 'ARS', 'Subscriptions', 'Netflix', '2025-03-01', v_galicia_id),
    (v_user_id, 28000, 'ARS', 'Food', 'Sushi delivery', '2025-03-07', v_mp_id),
    (v_user_id, 42000, 'ARS', 'Food', 'Almuerzo trabajo', '2025-03-12', v_efectivo_id),
    (v_user_id, 68000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-03-10', v_galicia_id),
    (v_user_id, 25000, 'ARS', 'Bills & Utilities', 'Telecentro internet', '2025-03-08', v_galicia_id),
    (v_user_id, 120000, 'ARS', 'Education', 'Curso Udemy', '2025-03-15', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Entertainment', 'Recital', '2025-03-22', v_mp_id),
    (v_user_id, 95000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-03-05', v_galicia_id),
    (v_user_id, 22000, 'ARS', 'Transport', 'Uber', '2025-03-18', v_mp_id),
    (v_user_id, 18000, 'ARS', 'Gifts', 'Regalo cumpleaños', '2025-03-25', v_mp_id),
    (v_user_id, 7500, 'ARS', 'Personal Care', 'Peluquería', '2025-03-28', v_efectivo_id);

  -- Abril 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 98000, 'ARS', 'Supermarket', 'Jumbo', '2025-04-01', v_galicia_id),
    (v_user_id, 52000, 'ARS', 'Supermarket', 'Coto', '2025-04-14', v_mp_id),
    (v_user_id, 14000, 'ARS', 'Transport', 'Carga SUBE', '2025-04-03', v_mp_id),
    (v_user_id, 9000, 'ARS', 'Subscriptions', 'Spotify', '2025-04-01', v_galicia_id),
    (v_user_id, 16000, 'ARS', 'Subscriptions', 'Netflix', '2025-04-01', v_galicia_id),
    (v_user_id, 6500, 'ARS', 'Subscriptions', 'iCloud', '2025-04-01', v_galicia_id),
    (v_user_id, 38000, 'ARS', 'Food', 'Cena cumpleaños', '2025-04-12', v_efectivo_id),
    (v_user_id, 72000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-04-10', v_galicia_id),
    (v_user_id, 45000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-04-11', v_galicia_id),
    (v_user_id, 85000, 'ARS', 'Shopping', 'Zapatillas Nike', '2025-04-20', v_mp_id),
    (v_user_id, 95000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-04-05', v_galicia_id),
    (v_user_id, 32000, 'ARS', 'Transport', 'Uber', '2025-04-16', v_mp_id),
    (v_user_id, 25000, 'ARS', 'Food', 'Rappi', '2025-04-22', v_mp_id),
    (v_user_id, 180000, 'ARS', 'Travel', 'Vuelo Mendoza', '2025-04-25', v_galicia_id),
    (v_user_id, 15000, 'ARS', 'Entertainment', 'Streaming HBO', '2025-04-08', v_galicia_id);

  -- Mayo 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 105000, 'ARS', 'Supermarket', 'Coto mensual', '2025-05-03', v_mp_id),
    (v_user_id, 55000, 'ARS', 'Supermarket', 'Carrefour', '2025-05-17', v_galicia_id),
    (v_user_id, 14000, 'ARS', 'Transport', 'Carga SUBE', '2025-05-05', v_mp_id),
    (v_user_id, 9500, 'ARS', 'Subscriptions', 'Spotify', '2025-05-01', v_galicia_id),
    (v_user_id, 16500, 'ARS', 'Subscriptions', 'Netflix', '2025-05-01', v_galicia_id),
    (v_user_id, 45000, 'ARS', 'Food', 'Parrilla', '2025-05-10', v_efectivo_id),
    (v_user_id, 30000, 'ARS', 'Food', 'Pedidos Ya', '2025-05-18', v_mp_id),
    (v_user_id, 75000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-05-10', v_galicia_id),
    (v_user_id, 28000, 'ARS', 'Bills & Utilities', 'Telecentro', '2025-05-08', v_galicia_id),
    (v_user_id, 48000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-05-12', v_galicia_id),
    (v_user_id, 95000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-05-05', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Transport', 'Uber', '2025-05-20', v_mp_id),
    (v_user_id, 22000, 'ARS', 'Entertainment', 'Teatro', '2025-05-24', v_mp_id),
    (v_user_id, 65000, 'ARS', 'Home', 'Ferretería arreglos', '2025-05-15', v_mp_id),
    (v_user_id, 12000, 'ARS', 'Personal Care', 'Farmacia', '2025-05-28', v_mp_id);

  -- Junio 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 110000, 'ARS', 'Supermarket', 'Coto', '2025-06-02', v_mp_id),
    (v_user_id, 58000, 'ARS', 'Supermarket', 'Dia', '2025-06-15', v_mp_id),
    (v_user_id, 15000, 'ARS', 'Transport', 'Carga SUBE', '2025-06-04', v_mp_id),
    (v_user_id, 10000, 'ARS', 'Subscriptions', 'Spotify', '2025-06-01', v_galicia_id),
    (v_user_id, 17000, 'ARS', 'Subscriptions', 'Netflix', '2025-06-01', v_galicia_id),
    (v_user_id, 42000, 'ARS', 'Food', 'Cena aniversario', '2025-06-14', v_galicia_id),
    (v_user_id, 78000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-06-10', v_galicia_id),
    (v_user_id, 52000, 'ARS', 'Bills & Utilities', 'Metrogas invierno', '2025-06-12', v_galicia_id),
    (v_user_id, 100000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-06-05', v_galicia_id),
    (v_user_id, 250000, 'ARS', 'Shopping', 'Campera invierno', '2025-06-08', v_galicia_id),
    (v_user_id, 38000, 'ARS', 'Transport', 'Uber', '2025-06-18', v_mp_id),
    (v_user_id, 28000, 'ARS', 'Food', 'Rappi', '2025-06-22', v_mp_id),
    (v_user_id, 45000, 'ARS', 'Gifts', 'Regalos navidad adelantados', '2025-06-20', v_mp_id),
    (v_user_id, 8000, 'ARS', 'Personal Care', 'Peluquería', '2025-06-25', v_efectivo_id),
    (v_user_id, 18000, 'ARS', 'Entertainment', 'Cine IMAX', '2025-06-28', v_mp_id);

  -- Julio 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 115000, 'ARS', 'Supermarket', 'Jumbo', '2025-07-01', v_galicia_id),
    (v_user_id, 62000, 'ARS', 'Supermarket', 'Coto', '2025-07-14', v_mp_id),
    (v_user_id, 16000, 'ARS', 'Transport', 'Carga SUBE', '2025-07-03', v_mp_id),
    (v_user_id, 10500, 'ARS', 'Subscriptions', 'Spotify', '2025-07-01', v_galicia_id),
    (v_user_id, 18000, 'ARS', 'Subscriptions', 'Netflix', '2025-07-01', v_galicia_id),
    (v_user_id, 7000, 'ARS', 'Subscriptions', 'iCloud', '2025-07-01', v_galicia_id),
    (v_user_id, 82000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-07-10', v_galicia_id),
    (v_user_id, 58000, 'ARS', 'Bills & Utilities', 'Metrogas invierno', '2025-07-12', v_galicia_id),
    (v_user_id, 100000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-07-05', v_galicia_id),
    (v_user_id, 48000, 'ARS', 'Food', 'Cena sushi', '2025-07-11', v_mp_id),
    (v_user_id, 32000, 'ARS', 'Food', 'Pedidos Ya', '2025-07-19', v_mp_id),
    (v_user_id, 40000, 'ARS', 'Transport', 'Uber', '2025-07-16', v_mp_id),
    (v_user_id, 350000, 'ARS', 'Travel', 'Vuelo Bariloche vacaciones', '2025-07-20', v_galicia_id),
    (v_user_id, 180000, 'ARS', 'Travel', 'Hotel Bariloche', '2025-07-21', v_galicia_id),
    (v_user_id, 15000, 'ARS', 'Entertainment', 'Museo', '2025-07-26', v_efectivo_id);

  -- Agosto 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 120000, 'ARS', 'Supermarket', 'Coto', '2025-08-02', v_mp_id),
    (v_user_id, 65000, 'ARS', 'Supermarket', 'Carrefour', '2025-08-16', v_galicia_id),
    (v_user_id, 16000, 'ARS', 'Transport', 'Carga SUBE', '2025-08-04', v_mp_id),
    (v_user_id, 11000, 'ARS', 'Subscriptions', 'Spotify', '2025-08-01', v_galicia_id),
    (v_user_id, 18500, 'ARS', 'Subscriptions', 'Netflix', '2025-08-01', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Food', 'Almuerzo', '2025-08-08', v_efectivo_id),
    (v_user_id, 85000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-08-10', v_galicia_id),
    (v_user_id, 55000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-08-12', v_galicia_id),
    (v_user_id, 30000, 'ARS', 'Bills & Utilities', 'Telecentro', '2025-08-08', v_galicia_id),
    (v_user_id, 105000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-08-05', v_galicia_id),
    (v_user_id, 42000, 'ARS', 'Transport', 'Uber', '2025-08-18', v_mp_id),
    (v_user_id, 75000, 'ARS', 'Shopping', 'Electrónica ML', '2025-08-14', v_mp_id),
    (v_user_id, 28000, 'ARS', 'Food', 'Rappi', '2025-08-22', v_mp_id),
    (v_user_id, 20000, 'ARS', 'Entertainment', 'Cine', '2025-08-25', v_mp_id),
    (v_user_id, 14000, 'ARS', 'Personal Care', 'Farmacia', '2025-08-28', v_mp_id);

  -- Septiembre 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 125000, 'ARS', 'Supermarket', 'Coto', '2025-09-01', v_mp_id),
    (v_user_id, 68000, 'ARS', 'Supermarket', 'Dia', '2025-09-15', v_mp_id),
    (v_user_id, 18000, 'ARS', 'Transport', 'Carga SUBE', '2025-09-03', v_mp_id),
    (v_user_id, 11500, 'ARS', 'Subscriptions', 'Spotify', '2025-09-01', v_galicia_id),
    (v_user_id, 19000, 'ARS', 'Subscriptions', 'Netflix', '2025-09-01', v_galicia_id),
    (v_user_id, 88000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-09-10', v_galicia_id),
    (v_user_id, 48000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-09-12', v_galicia_id),
    (v_user_id, 105000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-09-05', v_galicia_id),
    (v_user_id, 55000, 'ARS', 'Food', 'Parrilla amigos', '2025-09-13', v_efectivo_id),
    (v_user_id, 32000, 'ARS', 'Food', 'Pedidos Ya', '2025-09-20', v_mp_id),
    (v_user_id, 45000, 'ARS', 'Transport', 'Uber', '2025-09-17', v_mp_id),
    (v_user_id, 150000, 'ARS', 'Education', 'Curso Platzi anual', '2025-09-10', v_galicia_id),
    (v_user_id, 92000, 'ARS', 'Shopping', 'Ropa primavera', '2025-09-22', v_mp_id),
    (v_user_id, 9000, 'ARS', 'Personal Care', 'Peluquería', '2025-09-26', v_efectivo_id),
    (v_user_id, 25000, 'ARS', 'Friends', 'Asado cumple amigo', '2025-09-28', v_efectivo_id);

  -- Octubre 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 130000, 'ARS', 'Supermarket', 'Jumbo', '2025-10-01', v_galicia_id),
    (v_user_id, 72000, 'ARS', 'Supermarket', 'Coto', '2025-10-13', v_mp_id),
    (v_user_id, 18000, 'ARS', 'Transport', 'Carga SUBE', '2025-10-02', v_mp_id),
    (v_user_id, 12000, 'ARS', 'Subscriptions', 'Spotify', '2025-10-01', v_galicia_id),
    (v_user_id, 20000, 'ARS', 'Subscriptions', 'Netflix', '2025-10-01', v_galicia_id),
    (v_user_id, 7500, 'ARS', 'Subscriptions', 'iCloud', '2025-10-01', v_galicia_id),
    (v_user_id, 92000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-10-10', v_galicia_id),
    (v_user_id, 42000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-10-12', v_galicia_id),
    (v_user_id, 110000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-10-05', v_galicia_id),
    (v_user_id, 48000, 'ARS', 'Food', 'Cena japonesa', '2025-10-11', v_mp_id),
    (v_user_id, 35000, 'ARS', 'Food', 'Rappi', '2025-10-19', v_mp_id),
    (v_user_id, 48000, 'ARS', 'Transport', 'Uber', '2025-10-16', v_mp_id),
    (v_user_id, 85000, 'ARS', 'Home', 'Pintura departamento', '2025-10-08', v_mp_id),
    (v_user_id, 25000, 'ARS', 'Entertainment', 'Recital Luna Park', '2025-10-25', v_mp_id),
    (v_user_id, 15000, 'ARS', 'Personal Care', 'Farmacia', '2025-10-28', v_mp_id);

  -- Noviembre 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 135000, 'ARS', 'Supermarket', 'Coto', '2025-11-03', v_mp_id),
    (v_user_id, 75000, 'ARS', 'Supermarket', 'Carrefour', '2025-11-17', v_galicia_id),
    (v_user_id, 20000, 'ARS', 'Transport', 'Carga SUBE', '2025-11-05', v_mp_id),
    (v_user_id, 12500, 'ARS', 'Subscriptions', 'Spotify', '2025-11-01', v_galicia_id),
    (v_user_id, 21000, 'ARS', 'Subscriptions', 'Netflix', '2025-11-01', v_galicia_id),
    (v_user_id, 95000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-11-10', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Bills & Utilities', 'Telecentro', '2025-11-08', v_galicia_id),
    (v_user_id, 110000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-11-05', v_galicia_id),
    (v_user_id, 52000, 'ARS', 'Food', 'Asado fin de semana', '2025-11-09', v_efectivo_id),
    (v_user_id, 38000, 'ARS', 'Food', 'Pedidos Ya', '2025-11-21', v_mp_id),
    (v_user_id, 50000, 'ARS', 'Transport', 'Uber', '2025-11-18', v_mp_id),
    (v_user_id, 320000, 'ARS', 'Shopping', 'Black Friday electro', '2025-11-28', v_galicia_id),
    (v_user_id, 75000, 'ARS', 'Gifts', 'Regalos navidad', '2025-11-29', v_mp_id),
    (v_user_id, 28000, 'ARS', 'Entertainment', 'Cine + pop', '2025-11-22', v_mp_id),
    (v_user_id, 10000, 'ARS', 'Personal Care', 'Peluquería', '2025-11-26', v_efectivo_id);

  -- Diciembre 2025
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 145000, 'ARS', 'Supermarket', 'Coto fiestas', '2025-12-01', v_mp_id),
    (v_user_id, 95000, 'ARS', 'Supermarket', 'Jumbo fiestas', '2025-12-20', v_galicia_id),
    (v_user_id, 20000, 'ARS', 'Transport', 'Carga SUBE', '2025-12-03', v_mp_id),
    (v_user_id, 13000, 'ARS', 'Subscriptions', 'Spotify', '2025-12-01', v_galicia_id),
    (v_user_id, 22000, 'ARS', 'Subscriptions', 'Netflix', '2025-12-01', v_galicia_id),
    (v_user_id, 98000, 'ARS', 'Bills & Utilities', 'Edenor', '2025-12-10', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Bills & Utilities', 'Metrogas', '2025-12-12', v_galicia_id),
    (v_user_id, 115000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2025-12-05', v_galicia_id),
    (v_user_id, 180000, 'ARS', 'Gifts', 'Regalos navidad familia', '2025-12-22', v_mp_id),
    (v_user_id, 85000, 'ARS', 'Food', 'Cena nochebuena', '2025-12-24', v_efectivo_id),
    (v_user_id, 65000, 'ARS', 'Food', 'Brindis año nuevo', '2025-12-31', v_efectivo_id),
    (v_user_id, 55000, 'ARS', 'Transport', 'Uber fiestas', '2025-12-26', v_mp_id),
    (v_user_id, 450000, 'ARS', 'Travel', 'Vuelo Mar del Plata', '2025-12-28', v_galicia_id),
    (v_user_id, 120000, 'ARS', 'Shopping', 'Ropa verano', '2025-12-15', v_mp_id),
    (v_user_id, 35000, 'ARS', 'Entertainment', 'Parque acuático', '2025-12-30', v_mp_id);

  -- Enero 2026
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 150000, 'ARS', 'Supermarket', 'Coto', '2026-01-05', v_mp_id),
    (v_user_id, 82000, 'ARS', 'Supermarket', 'Dia', '2026-01-18', v_mp_id),
    (v_user_id, 22000, 'ARS', 'Transport', 'Carga SUBE', '2026-01-06', v_mp_id),
    (v_user_id, 13500, 'ARS', 'Subscriptions', 'Spotify', '2026-01-01', v_galicia_id),
    (v_user_id, 23000, 'ARS', 'Subscriptions', 'Netflix', '2026-01-01', v_galicia_id),
    (v_user_id, 8000, 'ARS', 'Subscriptions', 'iCloud', '2026-01-01', v_galicia_id),
    (v_user_id, 102000, 'ARS', 'Bills & Utilities', 'Edenor', '2026-01-10', v_galicia_id),
    (v_user_id, 32000, 'ARS', 'Bills & Utilities', 'Metrogas', '2026-01-12', v_galicia_id),
    (v_user_id, 38000, 'ARS', 'Bills & Utilities', 'Telecentro', '2026-01-08', v_galicia_id),
    (v_user_id, 115000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2026-01-05', v_galicia_id),
    (v_user_id, 55000, 'ARS', 'Food', 'Parrilla', '2026-01-12', v_efectivo_id),
    (v_user_id, 42000, 'ARS', 'Food', 'Pedidos Ya', '2026-01-20', v_mp_id),
    (v_user_id, 52000, 'ARS', 'Transport', 'Uber', '2026-01-15', v_mp_id),
    (v_user_id, 28000, 'ARS', 'Entertainment', 'Cine', '2026-01-25', v_mp_id),
    (v_user_id, 16000, 'ARS', 'Personal Care', 'Farmacia', '2026-01-28', v_mp_id);

  -- Febrero 2026
  INSERT INTO expenses (user_id, amount, currency, category, description, date, platform_id) VALUES
    (v_user_id, 158000, 'ARS', 'Supermarket', 'Coto', '2026-02-02', v_mp_id),
    (v_user_id, 88000, 'ARS', 'Supermarket', 'Carrefour', '2026-02-16', v_galicia_id),
    (v_user_id, 24000, 'ARS', 'Transport', 'Carga SUBE', '2026-02-04', v_mp_id),
    (v_user_id, 14000, 'ARS', 'Subscriptions', 'Spotify', '2026-02-01', v_galicia_id),
    (v_user_id, 24000, 'ARS', 'Subscriptions', 'Netflix', '2026-02-01', v_galicia_id),
    (v_user_id, 8500, 'ARS', 'Subscriptions', 'iCloud', '2026-02-01', v_galicia_id),
    (v_user_id, 108000, 'ARS', 'Bills & Utilities', 'Edenor', '2026-02-10', v_galicia_id),
    (v_user_id, 30000, 'ARS', 'Bills & Utilities', 'Metrogas', '2026-02-12', v_galicia_id),
    (v_user_id, 40000, 'ARS', 'Bills & Utilities', 'Telecentro', '2026-02-08', v_galicia_id),
    (v_user_id, 120000, 'ARS', 'Health & Wellness', 'Prepaga OSDE', '2026-02-05', v_galicia_id),
    (v_user_id, 48000, 'ARS', 'Food', 'Cena San Valentín', '2026-02-14', v_galicia_id),
    (v_user_id, 35000, 'ARS', 'Food', 'Pedidos Ya', '2026-02-19', v_mp_id),
    (v_user_id, 55000, 'ARS', 'Transport', 'Uber', '2026-02-15', v_mp_id),
    (v_user_id, 95000, 'ARS', 'Shopping', 'Ropa verano rebajas', '2026-02-08', v_mp_id),
    (v_user_id, 30000, 'ARS', 'Entertainment', 'Cine + cena', '2026-02-21', v_mp_id);

  -- =========================================================================
  -- 3. Incomes (~33, feb 2025 → feb 2026)
  -- =========================================================================

  -- Febrero 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 820000, 'ARS', 'Salary', 'Sueldo febrero', '2025-02-01', v_galicia_id),
    (v_user_id, 600, 'USD', 'Salary', 'Sueldo USD febrero', '2025-02-05', v_wise_id);

  -- Marzo 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 850000, 'ARS', 'Salary', 'Sueldo marzo', '2025-03-01', v_galicia_id),
    (v_user_id, 600, 'USD', 'Salary', 'Sueldo USD marzo', '2025-03-05', v_wise_id),
    (v_user_id, 180000, 'ARS', 'Freelance', 'Diseño web cliente', '2025-03-15', v_mp_id);

  -- Abril 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 880000, 'ARS', 'Salary', 'Sueldo abril', '2025-04-01', v_galicia_id),
    (v_user_id, 700, 'USD', 'Salary', 'Sueldo USD abril', '2025-04-05', v_wise_id);

  -- Mayo 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 910000, 'ARS', 'Salary', 'Sueldo mayo', '2025-05-01', v_galicia_id),
    (v_user_id, 700, 'USD', 'Salary', 'Sueldo USD mayo', '2025-05-05', v_wise_id),
    (v_user_id, 250000, 'ARS', 'Freelance', 'App mobile cliente', '2025-05-20', v_mp_id);

  -- Junio 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 950000, 'ARS', 'Salary', 'Sueldo junio', '2025-06-01', v_galicia_id),
    (v_user_id, 700, 'USD', 'Salary', 'Sueldo USD junio', '2025-06-05', v_wise_id),
    (v_user_id, 480000, 'ARS', 'Bonus', 'Aguinaldo junio', '2025-06-18', v_galicia_id);

  -- Julio 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 980000, 'ARS', 'Salary', 'Sueldo julio', '2025-07-01', v_galicia_id),
    (v_user_id, 800, 'USD', 'Salary', 'Sueldo USD julio', '2025-07-05', v_wise_id);

  -- Agosto 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1020000, 'ARS', 'Salary', 'Sueldo agosto', '2025-08-01', v_galicia_id),
    (v_user_id, 800, 'USD', 'Salary', 'Sueldo USD agosto', '2025-08-05', v_wise_id),
    (v_user_id, 320000, 'ARS', 'Freelance', 'Landing page cliente', '2025-08-12', v_mp_id);

  -- Septiembre 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1050000, 'ARS', 'Salary', 'Sueldo septiembre', '2025-09-01', v_galicia_id),
    (v_user_id, 800, 'USD', 'Salary', 'Sueldo USD septiembre', '2025-09-05', v_wise_id);

  -- Octubre 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1080000, 'ARS', 'Salary', 'Sueldo octubre', '2025-10-01', v_galicia_id),
    (v_user_id, 900, 'USD', 'Salary', 'Sueldo USD octubre', '2025-10-05', v_wise_id),
    (v_user_id, 280000, 'ARS', 'Freelance', 'Consultoría tech', '2025-10-18', v_mp_id);

  -- Noviembre 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1120000, 'ARS', 'Salary', 'Sueldo noviembre', '2025-11-01', v_galicia_id),
    (v_user_id, 900, 'USD', 'Salary', 'Sueldo USD noviembre', '2025-11-05', v_wise_id);

  -- Diciembre 2025
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1150000, 'ARS', 'Salary', 'Sueldo diciembre', '2025-12-01', v_galicia_id),
    (v_user_id, 1000, 'USD', 'Salary', 'Sueldo USD diciembre', '2025-12-05', v_wise_id),
    (v_user_id, 580000, 'ARS', 'Bonus', 'Aguinaldo diciembre', '2025-12-18', v_galicia_id);

  -- Enero 2026
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1200000, 'ARS', 'Salary', 'Sueldo enero', '2026-01-01', v_galicia_id),
    (v_user_id, 1000, 'USD', 'Salary', 'Sueldo USD enero', '2026-01-05', v_wise_id),
    (v_user_id, 350000, 'ARS', 'Freelance', 'Proyecto React', '2026-01-15', v_mp_id);

  -- Febrero 2026
  INSERT INTO incomes (user_id, amount, currency, source, description, date, platform_id) VALUES
    (v_user_id, 1250000, 'ARS', 'Salary', 'Sueldo febrero', '2026-02-01', v_galicia_id),
    (v_user_id, 1000, 'USD', 'Salary', 'Sueldo USD febrero', '2026-02-05', v_wise_id),
    (v_user_id, 200000, 'ARS', 'Freelance', 'Diseño UI cliente', '2026-02-10', v_mp_id);

  -- =========================================================================
  -- 4. Investments (8 transactions)
  -- =========================================================================
  INSERT INTO investments (user_id, date, asset, asset_type, units, price_per_unit, total_amount, currency, platform_id, notes) VALUES
    (v_user_id, '2025-03-10', 'BTC', 'crypto', 0.005, 82000, 410, 'USD', v_binance_id, 'DCA mensual'),
    (v_user_id, '2025-05-15', 'BTC', 'crypto', 0.004, 97000, 388, 'USD', v_binance_id, 'DCA mensual'),
    (v_user_id, '2025-04-20', 'ETH', 'crypto', 0.15, 1800, 270, 'USD', v_binance_id, 'Compra ETH'),
    (v_user_id, '2025-08-10', 'ETH', 'crypto', 0.12, 2500, 300, 'USD', v_binance_id, 'Compra ETH'),
    (v_user_id, '2025-06-05', 'AAPL', 'cedear', 5, 185000, 925000, 'ARS', v_iol_id, 'Cedear Apple'),
    (v_user_id, '2025-07-12', 'MELI', 'cedear', 2, 520000, 1040000, 'ARS', v_iol_id, 'Cedear MercadoLibre'),
    (v_user_id, '2025-09-08', 'ON YPF 2026', 'bond', 100, 9800, 980000, 'ARS', v_iol_id, 'Obligación Negociable YPF'),
    (v_user_id, '2025-11-20', 'BTC', 'crypto', 0.003, 95000, 285, 'USD', v_binance_id, 'DCA mensual');

  -- =========================================================================
  -- 5. Patrimony Snapshots (12, one per month end)
  -- =========================================================================

  -- Feb 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-02-28', 4850000, 'USD Blue ~1180')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1200000),
    (v_snapshot_id, v_mp_id, 'ARS', 350000),
    (v_snapshot_id, v_wise_id, 'USD', 1800),
    (v_snapshot_id, v_binance_id, 'USD', 200),
    (v_snapshot_id, v_efectivo_id, 'ARS', 120000);

  -- Mar 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-03-31', 5320000, 'USD Blue ~1200')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1450000),
    (v_snapshot_id, v_mp_id, 'ARS', 420000),
    (v_snapshot_id, v_wise_id, 'USD', 2000),
    (v_snapshot_id, v_binance_id, 'USD', 610),
    (v_snapshot_id, v_efectivo_id, 'ARS', 85000);

  -- Apr 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-04-30', 5680000, 'USD Blue ~1220')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1580000),
    (v_snapshot_id, v_mp_id, 'ARS', 380000),
    (v_snapshot_id, v_wise_id, 'USD', 2200),
    (v_snapshot_id, v_binance_id, 'USD', 880),
    (v_snapshot_id, v_efectivo_id, 'ARS', 95000);

  -- May 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-05-31', 6250000, 'USD Blue ~1250')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1720000),
    (v_snapshot_id, v_mp_id, 'ARS', 510000),
    (v_snapshot_id, v_wise_id, 'USD', 2400),
    (v_snapshot_id, v_binance_id, 'USD', 1268),
    (v_snapshot_id, v_efectivo_id, 'ARS', 60000);

  -- Jun 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-06-30', 7450000, 'USD Blue ~1280 | Aguinaldo')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1950000),
    (v_snapshot_id, v_mp_id, 'ARS', 620000),
    (v_snapshot_id, v_wise_id, 'USD', 2600),
    (v_snapshot_id, v_binance_id, 'USD', 1268),
    (v_snapshot_id, v_iol_id, 'ARS', 925000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 80000);

  -- Jul 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-07-31', 7100000, 'USD Blue ~1300 | Vacaciones')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1680000),
    (v_snapshot_id, v_mp_id, 'ARS', 480000),
    (v_snapshot_id, v_wise_id, 'USD', 2800),
    (v_snapshot_id, v_binance_id, 'USD', 1268),
    (v_snapshot_id, v_iol_id, 'ARS', 1965000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 45000);

  -- Aug 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-08-31', 7850000, 'USD Blue ~1320')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 1850000),
    (v_snapshot_id, v_mp_id, 'ARS', 550000),
    (v_snapshot_id, v_wise_id, 'USD', 3000),
    (v_snapshot_id, v_binance_id, 'USD', 1568),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 1980000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 70000);

  -- Sep 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-09-30', 8500000, 'USD Blue ~1350')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 2050000),
    (v_snapshot_id, v_mp_id, 'ARS', 620000),
    (v_snapshot_id, v_wise_id, 'USD', 3200),
    (v_snapshot_id, v_binance_id, 'USD', 1568),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 2960000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 55000);

  -- Oct 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-10-31', 9200000, 'USD Blue ~1380')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 2250000),
    (v_snapshot_id, v_mp_id, 'ARS', 680000),
    (v_snapshot_id, v_wise_id, 'USD', 3500),
    (v_snapshot_id, v_binance_id, 'USD', 1568),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 2980000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 90000);

  -- Nov 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-11-30', 9650000, 'USD Blue ~1400')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 2100000),
    (v_snapshot_id, v_mp_id, 'ARS', 580000),
    (v_snapshot_id, v_wise_id, 'USD', 3800),
    (v_snapshot_id, v_binance_id, 'BTC', 0.012),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 3010000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 65000);

  -- Dec 2025
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2025-12-31', 10800000, 'USD Blue ~1420 | Aguinaldo')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 2450000),
    (v_snapshot_id, v_mp_id, 'ARS', 720000),
    (v_snapshot_id, v_wise_id, 'USD', 4200),
    (v_snapshot_id, v_binance_id, 'BTC', 0.012),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 3050000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 150000);

  -- Jan 2026
  INSERT INTO patrimony_snapshots (user_id, date, total_ars, notes)
  VALUES (v_user_id, '2026-01-31', 11250000, 'USD Blue ~1450')
  RETURNING id INTO v_snapshot_id;
  INSERT INTO patrimony_snapshot_items (snapshot_id, platform_id, currency, amount) VALUES
    (v_snapshot_id, v_galicia_id, 'ARS', 2600000),
    (v_snapshot_id, v_mp_id, 'ARS', 780000),
    (v_snapshot_id, v_wise_id, 'USD', 4500),
    (v_snapshot_id, v_binance_id, 'BTC', 0.012),
    (v_snapshot_id, v_binance_id, 'ETH', 0.27),
    (v_snapshot_id, v_iol_id, 'ARS', 3100000),
    (v_snapshot_id, v_efectivo_id, 'ARS', 95000);

  RAISE NOTICE 'Demo user data seeded successfully!';
END $$;
