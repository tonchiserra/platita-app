import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";
import type { CpiIndexPoint, InflationPoint } from "@/lib/api/inflation";
import type { TimelinePoint } from "./patrimony-alternatives";

/** A single income or expense, already converted to ARS. `sign` is +1 or -1. */
export interface TimelineFlow {
  date: string;
  amountArs: number;
  sign: 1 | -1;
}

export interface TimelineInput {
  /** Ascending by date. */
  snapshots: { date: string; totalArs: number }[];
  flows: TimelineFlow[];
  blueSeries: DolarHistoryPoint[] | null;
  inflationSeries: InflationPoint[] | null;
  /** US CPI-U index levels, for discounting the dollarized alternative. */
  usCpiSeries?: CpiIndexPoint[] | null;
  /**
   * Net worth as of today for the month still open: the last close revalued at
   * current rates plus this month's movements. Used only when that month has no
   * close of its own, and flagged as an estimate so the chart can say so.
   */
  estimatedCurrentArs?: number | null;
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Last calendar day of `YYYY-MM`, as `YYYY-MM-DD`. */
function endOfMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const day = new Date(year, m, 0).getDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Folds flows, snapshots, rates and CPI into one row per calendar month.
 *
 * The series starts at the first recorded flow, not at the first snapshot: the
 * alternatives only ever contain money that passed through income or expenses,
 * so months before any of that has nothing to accumulate.
 */
export function buildTimeline(input: TimelineInput): TimelinePoint[] {
  const { snapshots, flows, blueSeries, inflationSeries } = input;
  if (flows.length === 0) return [];

  const flowMonths = flows.map((f) => monthOf(f.date)).sort();
  const first = flowMonths[0];

  const lastFlow = flowMonths[flowMonths.length - 1];
  const lastSnapshot =
    snapshots.length > 0 ? monthOf(snapshots[snapshots.length - 1].date) : first;
  const last = lastFlow > lastSnapshot ? lastFlow : lastSnapshot;

  // Flows and snapshots bucketed by month, so gaps still produce a row.
  const savingsByMonth = new Map<string, number>();
  for (const flow of flows) {
    const key = monthOf(flow.date);
    if (key < first) continue;
    savingsByMonth.set(key, (savingsByMonth.get(key) ?? 0) + flow.sign * flow.amountArs);
  }

  const patrimonyByMonth = new Map<string, number>();
  for (const snapshot of snapshots) {
    // A later snapshot in the same month wins; it is the more current close.
    patrimonyByMonth.set(monthOf(snapshot.date), snapshot.totalArs);
  }

  const cpiByMonth = new Map<string, number>();
  for (const point of inflationSeries ?? []) {
    cpiByMonth.set(monthOf(point.fecha), point.valor);
  }

  const usCpiByMonth = new Map<string, number>();
  for (const point of input.usCpiSeries ?? []) {
    usCpiByMonth.set(point.month, point.index);
  }

  // The first row is the anchor every line starts from, so it always needs a
  // patrimony. When no close lands in that month, the most recent earlier one
  // is carried forward — later months keep a null and simply have no point.
  const anchorArs = (() => {
    const own = patrimonyByMonth.get(first);
    if (own !== undefined) return own;
    let carried: number | null = null;
    for (const snapshot of snapshots) {
      if (monthOf(snapshot.date) <= first) carried = snapshot.totalArs;
    }
    return carried ?? snapshots[0]?.totalArs ?? null;
  })();

  const points: TimelinePoint[] = [];
  for (let month = first; month <= last; month = nextMonth(month)) {
    const date = endOfMonth(month);
    const netSavingsArs = savingsByMonth.get(month) ?? 0;
    const blueRate = blueSeries ? blueRateOn(blueSeries, date) : undefined;

    const recorded = month === first ? anchorArs : patrimonyByMonth.get(month) ?? null;
    // The open month has no close of its own; fall back to the estimate.
    const useEstimate =
      month === last && recorded === null && (input.estimatedCurrentArs ?? null) !== null;

    points.push({
      month,
      date,
      patrimonyArs: useEstimate ? input.estimatedCurrentArs! : recorded,
      patrimonyIsEstimate: useEstimate || undefined,
      netSavingsArs,
      // Dollars bought with that month's savings, at that month's rate.
      netSavingsUsd: blueRate ? netSavingsArs / blueRate : null,
      blueRate,
      inflationPct: cpiByMonth.get(month),
      usCpiIndex: usCpiByMonth.get(month),
    });
  }

  return points;
}
