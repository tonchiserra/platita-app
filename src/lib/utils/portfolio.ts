/**
 * The portfolio's arithmetic: positions, realized results and the monthly
 * invested-vs-value series. Pure and import-free, so it is testable on its own
 * and safe to import from either side.
 *
 * Everything is measured in **USD**. An operation paid in pesos is converted
 * at the blue of its own date by the `toUsd` the caller passes in, so an old
 * purchase keeps the dollar cost it really had.
 *
 * Cost basis is the **average cost** method: a sale removes units at the
 * position's average cost and leaves that average unchanged. Its realized
 * result is what the sale brought in minus that cost.
 */

export interface Operation {
  id?: string;
  date: string;
  asset: string;
  asset_type: string;
  side: "buy" | "sell";
  units: number;
  total_amount: number;
  currency: string;
}

export type PriceSource = "manual" | "market" | "crypto";

export interface CurrentPrice {
  usd: number;
  source: PriceSource;
  /** Day change, percent, when the source gives one. */
  change?: number | null;
}

export interface Position {
  /** Normalised key: trimmed, upper case. */
  key: string;
  /** The spelling of the first operation, for display. */
  asset: string;
  assetType: string;
  units: number;
  /** Remaining cost basis of the units held. */
  costUsd: number;
  avgCostUsd: number | null;
  /** Sum of every purchase, before any sale. */
  boughtUsd: number;
  /** Sum of what every sale brought in. */
  soldUsd: number;
  realizedUsd: number;
  priceUsd: number | null;
  priceSource: PriceSource | null;
  priceChange: number | null;
  valueUsd: number | null;
  unrealizedUsd: number | null;
  unrealizedPct: number | null;
  /** Share of the portfolio's value, 0–100. Unpriced positions weigh at cost. */
  weight: number;
  firstDate: string;
  operations: number;
  closed: boolean;
}

export interface PortfolioSummary {
  /** Priced positions at market, plus unpriced ones at cost. */
  valueUsd: number;
  /** Cost basis of every open position. */
  costUsd: number;
  unrealizedUsd: number;
  unrealizedPct: number | null;
  realizedUsd: number;
  /** Purchases minus sale proceeds, over the whole history. */
  netInvestedUsd: number;
  unpricedAssets: string[];
}

/** Below this many units a position counts as closed (floating-point dust). */
const DUST = 1e-9;

export const assetKey = (asset: string) => asset.trim().toUpperCase();

function chronological<T extends { date: string }>(ops: readonly T[]): T[] {
  // Stable: same-day operations keep their given order.
  return ops.map((op, i) => ({ op, i })).sort((a, b) => (a.op.date === b.op.date ? a.i - b.i : a.op.date < b.op.date ? -1 : 1)).map((x) => x.op);
}

interface Book {
  units: number;
  costUsd: number;
  boughtUsd: number;
  soldUsd: number;
  realizedUsd: number;
}

function apply(book: Book, op: Operation, usd: number) {
  const units = Math.abs(op.units);
  if (op.side === "buy") {
    book.units += units;
    book.costUsd += usd;
    book.boughtUsd += usd;
    return;
  }
  // A sale larger than the holding only counts up to what was held; the
  // excess has no cost to set against it.
  const sold = Math.min(units, book.units);
  if (sold <= 0) return;
  const avg = book.costUsd / book.units;
  const proceeds = usd * (sold / units);
  book.realizedUsd += proceeds - avg * sold;
  book.soldUsd += proceeds;
  book.costUsd -= avg * sold;
  book.units -= sold;
  if (book.units < DUST) {
    book.units = 0;
    book.costUsd = 0;
  }
}

export function buildPositions(
  ops: readonly Operation[],
  toUsd: (op: Operation) => number,
  prices: Record<string, CurrentPrice>
): { positions: Position[]; summary: PortfolioSummary } {
  const books = new Map<string, Book & { asset: string; assetType: string; firstDate: string; operations: number }>();

  for (const op of chronological(ops)) {
    const key = assetKey(op.asset);
    let book = books.get(key);
    if (!book) {
      book = { units: 0, costUsd: 0, boughtUsd: 0, soldUsd: 0, realizedUsd: 0, asset: op.asset.trim(), assetType: op.asset_type, firstDate: op.date, operations: 0 };
      books.set(key, book);
    }
    book.operations += 1;
    apply(book, op, toUsd(op));
  }

  const positions: Position[] = [...books.entries()].map(([key, b]) => {
    const price = prices[key] ?? null;
    const open = b.units > DUST;
    const valueUsd = open && price ? b.units * price.usd : open ? null : 0;
    const unrealizedUsd = open && price ? valueUsd! - b.costUsd : null;
    return {
      key,
      asset: b.asset,
      assetType: b.assetType,
      units: b.units,
      costUsd: b.costUsd,
      avgCostUsd: open ? b.costUsd / b.units : null,
      boughtUsd: b.boughtUsd,
      soldUsd: b.soldUsd,
      realizedUsd: b.realizedUsd,
      priceUsd: price?.usd ?? null,
      priceSource: price?.source ?? null,
      priceChange: price?.change ?? null,
      valueUsd,
      unrealizedUsd,
      unrealizedPct: unrealizedUsd !== null && b.costUsd > 0 ? (unrealizedUsd / b.costUsd) * 100 : null,
      weight: 0,
      firstDate: b.firstDate,
      operations: b.operations,
      closed: !open,
    };
  });

  const open = positions.filter((p) => !p.closed);
  const weightBase = open.reduce((sum, p) => sum + (p.valueUsd ?? p.costUsd), 0);
  for (const p of open) p.weight = weightBase > 0 ? ((p.valueUsd ?? p.costUsd) / weightBase) * 100 : 0;

  const priced = open.filter((p) => p.valueUsd !== null);
  const pricedCost = priced.reduce((sum, p) => sum + p.costUsd, 0);
  const unrealizedUsd = priced.reduce((sum, p) => sum + (p.unrealizedUsd ?? 0), 0);

  const summary: PortfolioSummary = {
    valueUsd: weightBase,
    costUsd: open.reduce((sum, p) => sum + p.costUsd, 0),
    unrealizedUsd,
    unrealizedPct: pricedCost > 0 ? (unrealizedUsd / pricedCost) * 100 : null,
    realizedUsd: positions.reduce((sum, p) => sum + p.realizedUsd, 0),
    netInvestedUsd: positions.reduce((sum, p) => sum + p.boughtUsd - p.soldUsd, 0),
    unpricedAssets: open.filter((p) => p.valueUsd === null).map((p) => p.asset),
  };

  // Open positions by value, closed ones after, most recently opened first.
  positions.sort((a, b) =>
    a.closed !== b.closed ? (a.closed ? 1 : -1) : (b.valueUsd ?? b.costUsd) - (a.valueUsd ?? a.costUsd) || (a.firstDate < b.firstDate ? 1 : -1)
  );

  return { positions, summary };
}

export interface PerformancePoint {
  month: string;
  /** Purchases minus sale proceeds to date. */
  investedUsd: number;
  /** Units held at month end × that month's close. */
  valueUsd: number;
  /** True when some holding had no price that month and was carried at cost. */
  atCost: boolean;
}

/**
 * One row per month from `months[0]` to the last. `priceAt` returns the USD
 * price of one unit of `key` at the end of `month`, or null when unknown —
 * that holding is then carried at its cost basis, which keeps the line
 * honest (flat, not zero) and flags the month.
 */
export function buildPerformance(
  ops: readonly Operation[],
  months: readonly string[],
  toUsd: (op: Operation) => number,
  priceAt: (key: string, month: string) => number | null
): PerformancePoint[] {
  const sorted = chronological(ops);
  const books = new Map<string, Book>();
  let invested = 0;
  let cursor = 0;

  return months.map((month) => {
    while (cursor < sorted.length && sorted[cursor].date.slice(0, 7) <= month) {
      const op = sorted[cursor++];
      const key = assetKey(op.asset);
      const book = books.get(key) ?? { units: 0, costUsd: 0, boughtUsd: 0, soldUsd: 0, realizedUsd: 0 };
      books.set(key, book);
      const usd = toUsd(op);
      const before = book.soldUsd;
      apply(book, op, usd);
      invested += op.side === "buy" ? usd : -(book.soldUsd - before);
    }

    let value = 0;
    let atCost = false;
    for (const [key, book] of books) {
      if (book.units <= DUST) continue;
      const price = priceAt(key, month);
      if (price === null) {
        value += book.costUsd;
        atCost = true;
      } else value += book.units * price;
    }
    return { month, investedUsd: invested, valueUsd: value, atCost };
  });
}
