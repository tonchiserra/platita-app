import { TRADE_INCOME_SOURCE } from "@/lib/constants/sources";

/**
 * The trading book's arithmetic.
 *
 * Pure, and deliberately importing nothing from `lib/api`: the two halves of a
 * trade — profits are income, losses are not expenses — are read by four
 * different pages, so the rule has to live in one testable place rather than be
 * re-derived in each page body.
 *
 * Numbers arrive as strings from PostgREST on some paths, so every field is
 * wrapped in `Number(...)` here once instead of at every call site.
 */

/**
 * The shape every function here needs. Wider rows (joins, ids) are fine.
 *
 * `direction` is a plain string rather than `TradeDirection` because PostgREST
 * hands back the column untyped; the check constraint is what guarantees it.
 */
export interface TradeLike {
  date: string;
  asset: string;
  direction: string;
  pnl_usd: number | string;
  pnl_pct?: number | string | null;
  leverage?: number | string | null;
  notes?: string | null;
  platform_id?: string | null;
}

function pnl(trade: TradeLike): number {
  return Number(trade.pnl_usd);
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** A trading profit, in the shape every income aggregator already handles. */
export interface TradeIncome {
  /** Prefixed so it can never collide with a real income's uuid. */
  id: string;
  amount: number;
  /** Always USD — the PnL is entered in dollars. */
  currency: string;
  source: string;
  description: string;
  date: string;
  platform_id: string | null;
  /** Present only on derived rows: the book they came from. */
  trade: { asset: string; direction: string; leverage: number | null };
}

/**
 * The winning trades, as income rows.
 *
 * `currency: "USD"` is what makes this need no changes anywhere: every page
 * already knows how to convert a USD income row with whatever rate it uses.
 * `source` is a member of `RETURN_SOURCES`, which is what keeps these out of the
 * patrimony alternatives chart without that chart knowing trades exist.
 */
export function tradeIncomes<T extends TradeLike & { id?: string }>(
  trades: readonly T[]
): TradeIncome[] {
  const rows: TradeIncome[] = [];
  trades.forEach((trade, i) => {
    const amount = pnl(trade);
    if (!(amount > 0)) return;
    rows.push({
      id: `trade:${trade.id ?? `${trade.date}-${i}`}`,
      amount,
      currency: "USD",
      source: TRADE_INCOME_SOURCE,
      description: trade.notes?.trim() || defaultLabel(trade),
      date: trade.date,
      platform_id: trade.platform_id ?? null,
      trade: {
        asset: trade.asset,
        direction: trade.direction,
        leverage: trade.leverage === null || trade.leverage === undefined
          ? null
          : Number(trade.leverage),
      },
    });
  });
  return rows;
}

/** `Long en BTC` — used when the operation carries no note. */
export function defaultLabel(trade: Pick<TradeLike, "asset" | "direction">): string {
  return `${trade.direction === "long" ? "Long" : "Short"} en ${trade.asset}`;
}

/**
 * Losses, as a positive number of dollars.
 *
 * Positive because every caller subtracts it: a signed value here invites a
 * double negative at the one place where the sign decides whether the estimated
 * patrimony goes up or down.
 */
export function tradeLossesUsd(trades: readonly TradeLike[], month?: string): number {
  return trades.reduce((sum, trade) => {
    const amount = pnl(trade);
    if (amount >= 0) return sum;
    if (month !== undefined && monthOf(trade.date) !== month) return sum;
    return sum + Math.abs(amount);
  }, 0);
}

/** Profits, as a positive number of dollars. The mirror of `tradeLossesUsd`. */
export function tradeProfitsUsd(trades: readonly TradeLike[], month?: string): number {
  return trades.reduce((sum, trade) => {
    const amount = pnl(trade);
    if (amount <= 0) return sum;
    if (month !== undefined && monthOf(trade.date) !== month) return sum;
    return sum + amount;
  }, 0);
}

export interface TradeStats {
  /** Profits minus losses, signed, in USD. */
  net: number;
  wins: number;
  losses: number;
  /** Share of operations that closed in profit, 0–100. `null` with no trades. */
  winRate: number | null;
  /** Earliest month with an operation, as `YYYY-MM`. `null` with no trades. */
  firstMonth: string | null;
}

export function tradeStats(trades: readonly TradeLike[], month?: string): TradeStats {
  let net = 0;
  let wins = 0;
  let losses = 0;
  let firstMonth: string | null = null;

  for (const trade of trades) {
    const key = monthOf(trade.date);
    if (firstMonth === null || key < firstMonth) firstMonth = key;
    if (month !== undefined && key !== month) continue;
    const amount = pnl(trade);
    net += amount;
    if (amount > 0) wins++;
    else if (amount < 0) losses++;
  }

  const counted = wins + losses;
  return {
    net,
    wins,
    losses,
    winRate: counted > 0 ? (wins / counted) * 100 : null,
    firstMonth,
  };
}

export interface TradeMonth {
  /** `YYYY-MM`. */
  month: string;
  /** Signed net result for the month, in USD. */
  net: number;
  wins: number;
  losses: number;
}

/**
 * One row per month that has an operation, ascending.
 *
 * Months with no operation are skipped rather than filled with a zero: a zero
 * bar reads as "I traded and broke even", which is a different fact from not
 * having traded.
 */
export function tradePnlByMonth(trades: readonly TradeLike[]): TradeMonth[] {
  const byMonth = new Map<string, TradeMonth>();
  for (const trade of trades) {
    const month = monthOf(trade.date);
    const row = byMonth.get(month) ?? { month, net: 0, wins: 0, losses: 0 };
    const amount = pnl(trade);
    row.net += amount;
    if (amount > 0) row.wins++;
    else if (amount < 0) row.losses++;
    byMonth.set(month, row);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
