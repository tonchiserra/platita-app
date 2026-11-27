import "server-only";
import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";
import { RETURN_SOURCES } from "@/lib/constants/sources";
import { convertToArs, convertToUsd, type HistoricalConverter } from "@/lib/utils/currency-conversion";
import { addMonths, endOfMonth, monthRange } from "@/lib/utils/format";
import { buildAlternatives } from "@/lib/utils/patrimony-alternatives";
import { buildTimeline, type TimelineFlow } from "@/lib/utils/patrimony-timeline";
import { flowsSinceClose } from "@/lib/utils/patrimony-estimate";
import { buildReturns, type ReturnClose, type ReturnSummary } from "@/lib/utils/returns";
import { tradeIncomes, tradeLossesUsd } from "@/lib/utils/trading";
import type { IncomeRow, Snapshot, TradeRow } from "@/lib/data";
import type { ExchangeRates } from "@/types/database";

/**
 * Aggregations shared by more than one page. Everything a chart plots comes
 * out of here in both ARS and USD, each movement converted at the blue of its
 * own date (see `makeHistoricalConverter`).
 */

type Conv = Pick<HistoricalConverter, "toArs" | "toUsd" | "blue">;

export interface Flow {
  date: string;
  amount: number;
  currency: string;
}

export interface MonthlySeries {
  ars: number[];
  usd: number[];
}

export function monthlySums(rows: readonly Flow[], months: readonly string[], conv: Conv): MonthlySeries {
  const index = new Map(months.map((m, i) => [m, i]));
  const ars = months.map(() => 0);
  const usd = months.map(() => 0);
  for (const row of rows) {
    const i = index.get(row.date.slice(0, 7));
    if (i === undefined) continue;
    ars[i] += conv.toArs(row);
    usd[i] += conv.toUsd(row);
  }
  return { ars, usd };
}

/** Manual incomes plus trading profits — profits are income everywhere. */
export function allIncomes(incomes: readonly IncomeRow[], trades: readonly TradeRow[]) {
  const derived = tradeIncomes(trades).map((t) => ({
    id: t.id,
    amount: t.amount,
    currency: t.currency,
    source: t.source,
    description: t.description,
    date: t.date,
    platform_id: t.platform_id,
    fromTrade: true as const,
  }));
  return [...incomes.map((i) => ({ ...i, fromTrade: false as const })), ...derived].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** The last `count` months up to `current`, starting no earlier than the first movement. */
export function windowMonths(current: string, count: number, dates: Iterable<string>): string[] {
  let first: string | null = null;
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (first === null || m < first) first = m;
  }
  const from = addMonths(current, -(count - 1));
  return monthRange(first && first > from ? first : from, current);
}

/* =====================================================================
 * Estimated net worth
 * ===================================================================== */

export interface PatrimonyEstimate {
  /** The last close revalued at today's rates, plus every movement since it. */
  estimatedArs: number | null;
  estimatedUsd: number | null;
  lastClose: Snapshot | null;
  previousClose: Snapshot | null;
  /** The last close's own holdings, by currency, in their own units. */
  byCurrency: Record<string, number>;
  sinceIncomesArs: number;
  sinceExpensesArs: number;
  sinceLossesArs: number;
}

/**
 * One function for the dashboard hero and the patrimony page, so the two can
 * never disagree. Movements since the close are valued at **today's** rates,
 * like the close they are added to: a dollar received after the close is a
 * dollar still held now.
 */
export function estimatePatrimony({
  snapshots,
  incomes,
  expenses,
  trades,
  fx,
  currentMonth,
}: {
  snapshots: readonly Snapshot[];
  incomes: readonly Flow[];
  expenses: readonly Flow[];
  trades: readonly TradeRow[];
  fx: ExchangeRates;
  currentMonth: string;
}): PatrimonyEstimate {
  const lastClose = snapshots[snapshots.length - 1] ?? null;
  const previousClose = snapshots[snapshots.length - 2] ?? null;
  const byCurrency: Record<string, number> = {};
  for (const item of lastClose?.items ?? []) byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount;

  if (!lastClose || lastClose.items.length === 0) {
    return { estimatedArs: null, estimatedUsd: null, lastClose, previousClose, byCurrency, sinceIncomesArs: 0, sinceExpensesArs: 0, sinceLossesArs: 0 };
  }

  const today = (r: Flow) => convertToArs(r.amount, r.currency, fx);
  const sinceIncomesArs = flowsSinceClose(incomes, lastClose.date, currentMonth).reduce((s, r) => s + today(r), 0);
  const sinceExpensesArs = flowsSinceClose(expenses, lastClose.date, currentMonth).reduce((s, r) => s + today(r), 0);
  // A trading loss is not a gasto, but the money did leave a balance the close counted.
  const sinceLossesArs = convertToArs(tradeLossesUsd(flowsSinceClose(trades, lastClose.date, currentMonth)), "USD", fx);

  const holdingsArs = lastClose.items.reduce((s, i) => s + convertToArs(i.amount, i.currency, fx), 0);
  const estimatedArs = holdingsArs + sinceIncomesArs - sinceExpensesArs - sinceLossesArs;
  return {
    estimatedArs,
    estimatedUsd: fx.usdRate > 0 ? estimatedArs / fx.usdRate : null,
    lastClose,
    previousClose,
    byCurrency,
    sinceIncomesArs,
    sinceExpensesArs,
    sinceLossesArs,
  };
}

/** Holdings of one close valued in USD at today's prices. */
export function holdingsUsd(snapshot: Snapshot, fx: ExchangeRates) {
  return snapshot.items.reduce((s, i) => s + convertToUsd(i.amount, i.currency, fx), 0);
}

/* =====================================================================
 * Capital growth + "si me dolarizaba"
 * ===================================================================== */

export interface GrowthSeries {
  months: string[];
  patrimony: { ars: (number | null)[]; usd: (number | null)[] };
  dollarized: { ars: (number | null)[]; usd: (number | null)[] };
  /** Index of the last real close when the final point is the open-month estimate. */
  estimateFrom?: number;
  notes: (string | undefined)[];
  hasDollarized: boolean;
  /**
   * Blue at each month end and that month's savings in dollars of its own blue:
   * what `rebaseDollarized` needs to restart the line at a range's first month.
   */
  blue: (number | null)[];
  savingsUsd: (number | null)[];
}

/**
 * Net worth month by month — every recorded close, plus today's estimate on
 * the open month — and the counterfactual of having turned every month's
 * savings into dollars (`buildAlternatives`). Returns on money already held
 * (`RETURN_SOURCES`, trading profits included) stay out of the counterfactual.
 */
export function buildGrowth({
  snapshots,
  incomes,
  expenses,
  estimatedArs,
  conv,
  history,
  currentMonth,
}: {
  snapshots: readonly Snapshot[];
  incomes: readonly (Flow & { source: string })[];
  expenses: readonly Flow[];
  estimatedArs: number | null;
  conv: Conv;
  history: DolarHistoryPoint[] | null;
  currentMonth: string;
}): GrowthSeries {
  const flows: TimelineFlow[] = [
    ...incomes.filter((r) => !RETURN_SOURCES.has(r.source)).map((r) => ({ date: r.date, amountArs: conv.toArs(r), sign: 1 as const })),
    ...expenses.map((r) => ({ date: r.date, amountArs: conv.toArs(r), sign: -1 as const })),
  ];

  const timeline = buildTimeline({
    snapshots: snapshots.map((s) => ({ date: s.date, totalArs: s.total_ars })),
    flows,
    blueSeries: history,
    inflationSeries: null,
    estimatedCurrentArs: estimatedArs,
    currentMonth,
  });
  const alternatives = buildAlternatives(timeline);
  const dollarByMonth = new Map(
    timeline.map((p, i) => [p.month, { ars: alternatives[i].dollarized, blue: p.blueRate, savingsUsd: p.netSavingsUsd }])
  );

  const firstClose = snapshots[0]?.date.slice(0, 7);
  const firstFlow = timeline[0]?.month;
  const start = [firstClose, firstFlow].filter(Boolean).sort()[0];
  if (!start)
    return { months: [], patrimony: { ars: [], usd: [] }, dollarized: { ars: [], usd: [] }, notes: [], hasDollarized: false, blue: [], savingsUsd: [] };

  const months = monthRange(start, currentMonth);
  const closeByMonth = new Map<string, Snapshot>();
  for (const s of snapshots) closeByMonth.set(s.date.slice(0, 7), s); // later close in a month wins

  const blueAt = (month: string) => (history ? blueRateOn(history, endOfMonth(month)) : undefined) ?? conv.blue(endOfMonth(month));

  const patArs: (number | null)[] = [];
  const patUsd: (number | null)[] = [];
  const notes: (string | undefined)[] = [];
  let estimateFrom: number | undefined;

  months.forEach((m, i) => {
    const close = closeByMonth.get(m);
    if (close) {
      patArs.push(close.total_ars);
      const rate = conv.blue(close.date);
      patUsd.push(rate > 0 ? close.total_ars / rate : null);
      notes.push(`Cierre del ${Number(close.date.slice(8, 10))}`);
    } else if (m === currentMonth && estimatedArs !== null) {
      patArs.push(estimatedArs);
      const rate = conv.blue(endOfMonth(m));
      patUsd.push(rate > 0 ? estimatedArs / rate : null);
      notes.push("Estimado a hoy");
      for (let j = i - 1; j >= 0; j--)
        if (patArs[j] !== null) {
          estimateFrom = j;
          break;
        }
    } else {
      patArs.push(null);
      patUsd.push(null);
      notes.push(undefined);
    }
  });

  const blue = months.map((m) => dollarByMonth.get(m)?.blue ?? blueAt(m));
  const savingsUsd = months.map((m) => dollarByMonth.get(m)?.savingsUsd ?? null);
  const dolArs = months.map((m) => dollarByMonth.get(m)?.ars ?? null);
  const dolUsd = months.map((_, i) => {
    const v = dolArs[i];
    const rate = blue[i];
    return v !== null && rate ? v / rate : null;
  });

  return {
    months,
    patrimony: { ars: patArs, usd: patUsd },
    dollarized: { ars: dolArs, usd: dolUsd },
    estimateFrom,
    notes,
    hasDollarized: dolArs.some((v) => v !== null),
    blue,
    savingsUsd,
  };
}

/* =====================================================================
 * Rendimiento: what the money earned beyond what was saved into it
 * ===================================================================== */

export interface ReturnsView extends ReturnSummary {
  /** Trading result inside the measured window, in dollars. */
  tradingUsd: number;
}

/**
 * The return of the net worth in dollars, from the first close the recorded
 * movements can explain to today's estimate (or the last close). Savings are
 * the income that came from outside (`RETURN_SOURCES` and trading profits are
 * gains, not savings) minus every expense, each at the blue of its date.
 */
export function buildReturnsView({
  snapshots,
  incomes,
  expenses,
  trades,
  estimatedArs,
  fx,
  conv,
  today,
}: {
  snapshots: readonly Snapshot[];
  incomes: readonly (Flow & { source: string })[];
  expenses: readonly Flow[];
  trades: readonly TradeRow[];
  estimatedArs: number | null;
  fx: ExchangeRates;
  conv: Conv;
  today: string;
}): ReturnsView | null {
  const closes: ReturnClose[] = [];
  for (const sn of snapshots) {
    const rate = conv.blue(sn.date);
    if (rate > 0) closes.push({ date: sn.date, valueUsd: sn.total_ars / rate });
  }
  const last = closes[closes.length - 1];
  if (estimatedArs !== null && fx.usdRate > 0 && last && today > last.date)
    closes.push({ date: today, valueUsd: estimatedArs / fx.usdRate, estimate: true });

  const flows = [
    ...incomes.filter((r) => !RETURN_SOURCES.has(r.source)).map((r) => ({ date: r.date, amountUsd: conv.toUsd(r) })),
    ...expenses.map((r) => ({ date: r.date, amountUsd: -conv.toUsd(r) })),
  ].filter((f) => f.date <= today);

  const summary = buildReturns(closes, flows);
  if (!summary) return null;
  const tradingUsd = trades
    .filter((t) => t.date > summary.startDate && t.date <= summary.endDate)
    .reduce((s, t) => s + t.pnl_usd, 0);
  return { ...summary, tradingUsd };
}
