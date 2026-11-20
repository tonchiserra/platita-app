import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { getDolarBlue, getDolarBlueHistory, getEuroBlue, makeBlueLookup } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { makeHistoricalConverter } from "@/lib/utils/currency-conversion";
import { resolveCategories } from "@/lib/utils/expense-categories";
import type { ExchangeRates, ExpenseCategoryRow, Platform } from "@/types/database";

/**
 * Server-side reads. Every query names its columns and filters by `user_id`
 * even though RLS already does: an explicit filter lets Postgres use the
 * `(user_id, date)` indexes instead of leaning on the policy alone.
 *
 * Each loader is wrapped in `React.cache`, so a layout and a page — or two
 * sections of one page — share a single round trip per request.
 */

export const getSession = cache(async () => {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");
  return { user, supabase };
});

/* ---------- Rates ---------- */

export const getRates = cache(async () => {
  const [blue, euro, crypto] = await Promise.all([getDolarBlue(), getEuroBlue(), getCryptoPrices()]);
  const fx: ExchangeRates = {
    usdRate: blue?.venta ?? 0,
    eurRate: euro?.venta ?? 0,
    btcUsd: crypto?.bitcoin?.usd ?? 0,
    ethUsd: crypto?.ethereum?.usd ?? 0,
  };
  return { fx, blue, euro, crypto };
});

/** Today's rates plus the blue of any past date. */
export const getConverter = cache(async () => {
  const [{ fx }, history] = await Promise.all([getRates(), getDolarBlueHistory()]);
  return { fx, history, ...makeHistoricalConverter(fx, makeBlueLookup(history)), hasHistory: !!history };
});

/* ---------- Reference data ---------- */

export const getPlatforms = cache(async (): Promise<Platform[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("platforms")
    .select("id, user_id, name, type, default_currency, is_active, created_at")
    .eq("user_id", user.id)
    .order("name");
  return (data ?? []) as Platform[];
});

export const getCategoryRows = cache(async (): Promise<ExpenseCategoryRow[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("expense_categories")
    .select("id, user_id, name, icon, is_fixed, sort_order, created_at")
    .eq("user_id", user.id)
    .order("sort_order");
  return (data ?? []) as ExpenseCategoryRow[];
});

export const getCategories = cache(async () => resolveCategories(await getCategoryRows()));

/* ---------- Movements ---------- */

export interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  platform_id: string | null;
}

export interface IncomeRow {
  id: string;
  amount: number;
  currency: string;
  source: string;
  description: string;
  date: string;
  platform_id: string | null;
}

export interface TradeRow {
  id: string;
  date: string;
  asset: string;
  direction: string;
  pnl_usd: number;
  pnl_pct: number | null;
  leverage: number | null;
  platform_id: string | null;
  notes: string | null;
}

const num = <T extends { amount: number | string }>(r: T) => ({ ...r, amount: Number(r.amount) });

/** Every expense, newest first. Small rows: a personal history fits easily. */
export const getExpenses = cache(async (): Promise<ExpenseRow[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("expenses")
    .select("id, amount, currency, category, description, date, platform_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(num) as ExpenseRow[];
});

export const getIncomes = cache(async (): Promise<IncomeRow[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("incomes")
    .select("id, amount, currency, source, description, date, platform_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(num) as IncomeRow[];
});

/** The trading book. Null `data` means migration 003 is not applied: an empty book. */
export const getTrades = cache(async (): Promise<TradeRow[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("trades")
    .select("id, date, asset, direction, pnl_usd, pnl_pct, leverage, platform_id, notes")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as TradeRow[]).map((t) => ({
    ...t,
    pnl_usd: Number(t.pnl_usd),
    pnl_pct: t.pnl_pct === null ? null : Number(t.pnl_pct),
    leverage: t.leverage === null ? null : Number(t.leverage),
  }));
});

/* ---------- Patrimony ---------- */

export interface SnapshotItem {
  id: string;
  platform_id: string;
  currency: string;
  amount: number;
}

export interface Snapshot {
  id: string;
  date: string;
  total_ars: number;
  notes: string | null;
  items: SnapshotItem[];
}

/** Every close with its items, oldest first. */
export const getSnapshots = cache(async (): Promise<Snapshot[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("patrimony_snapshots")
    .select("id, date, total_ars, notes, patrimony_snapshot_items(id, platform_id, currency, amount)")
    .eq("user_id", user.id)
    .order("date", { ascending: true });
  type Raw = Omit<Snapshot, "items"> & { patrimony_snapshot_items: SnapshotItem[] | null };
  return ((data ?? []) as unknown as Raw[]).map((s) => ({
    id: s.id,
    date: s.date,
    total_ars: Number(s.total_ars),
    notes: s.notes,
    items: (s.patrimony_snapshot_items ?? []).map((i) => ({ ...i, amount: Number(i.amount) })),
  }));
});

/* ---------- Investments ---------- */

export interface InvestmentRow {
  id: string;
  date: string;
  asset: string;
  asset_type: string;
  side: "buy" | "sell";
  units: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  platform_id: string | null;
  notes: string | null;
}

/**
 * Read with `*` on purpose: before migration 004 there is no `side` column,
 * and naming it would fail the whole query. A row without one is a purchase.
 */
export const getInvestments = cache(async (): Promise<InvestmentRow[]> => {
  const { user, supabase } = await getSession();
  const { data } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    date: r.date as string,
    asset: (r.asset as string).trim(),
    asset_type: r.asset_type as string,
    side: r.side === "sell" ? "sell" : "buy",
    units: Number(r.units),
    price_per_unit: Number(r.price_per_unit),
    total_amount: Number(r.total_amount),
    currency: r.currency as string,
    platform_id: (r.platform_id as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  }));
});

export interface AssetPriceRow {
  asset: string;
  price: number;
  currency: "ARS" | "USD";
  updated_at: string;
}

/** Manual prices. A missing table (migration 004 not applied) reads as none. */
export const getAssetPrices = cache(async (): Promise<{ rows: AssetPriceRow[]; available: boolean }> => {
  const { user, supabase } = await getSession();
  const { data, error } = await supabase
    .from("asset_prices")
    .select("asset, price, currency, updated_at")
    .eq("user_id", user.id);
  if (error) return { rows: [], available: false };
  return {
    rows: (data ?? []).map((r) => ({ ...r, price: Number(r.price) })) as AssetPriceRow[],
    available: true,
  };
});

/** Whether migration 004 is in: the investments table has a `side` column. */
export const hasSidesColumn = cache(async (): Promise<boolean> => {
  const { supabase } = await getSession();
  const { error } = await supabase.from("investments").select("side").limit(1);
  return !error;
});
