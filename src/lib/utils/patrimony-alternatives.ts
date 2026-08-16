/**
 * One month on the timeline. Everything here describes that month alone; the
 * running totals are built by `buildAlternatives`.
 *
 * This module stays import-free on purpose: a client component imports it, and
 * reaching into `src/lib/api/*` would drag `fetch` calls into the bundle.
 */
export interface TimelinePoint {
  /** `YYYY-MM`. */
  month: string;
  /** Last day of the month, used as the x value. */
  date: string;
  /** Recorded net worth for that month, when a snapshot exists. */
  patrimonyArs: number | null;
  /** Income minus expenses that month, in pesos of that month. */
  netSavingsArs: number;
  /** The same flows, in dollars bought at that month's rate. */
  netSavingsUsd: number | null;
  /** Blue sell rate at month end. */
  blueRate?: number;
  /** That month's CPI, as a percentage. */
  inflationPct?: number;
}

export interface AlternativesPoint {
  date: string;
  /** What was actually recorded. Null in months without a snapshot. */
  patrimony: number | null;
  /** Every peso saved, kept as pesos. */
  mattress: number;
  /** Every peso saved, turned into dollars that month, valued at today's rate. */
  dollarized: number | null;
  /** What the mattress pesos really buy, in money of the first month. */
  mattressReal: number | null;
}

/**
 * Accumulates the flows three ways and returns one row per month.
 *
 * All four lines start from the same anchor: the patrimony as of the month of
 * the first recorded movement. From there each alternative carries that money
 * in a different unit and adds what was saved each month.
 *
 *   mattress(i)     = P0 + Σ savings, in pesos
 *   dollarized(i)   = blue_i × ( P0/blue_0 + Σ savings ÷ blue of their month )
 *   mattressReal(i) = mattress(i) ÷ inflation accumulated since the anchor
 *
 * The anchor month contributes no savings: its closing balance already
 * reflects that month's income and expenses, so adding them would count twice.
 *
 * The caller passes the whole history and slices the *result* for display.
 * Recomputing per visible range would make each range a different chart rather
 * than a window onto one.
 */
export function buildAlternatives(points: TimelinePoint[]): AlternativesPoint[] {
  if (points.length === 0) return [];

  const anchorArs = points[0].patrimonyArs ?? 0;
  const anchorBlue = points[0].blueRate;

  let pesos = anchorArs;
  let dollars = anchorBlue ? anchorArs / anchorBlue : null;
  let index = 1;
  let cpiStopped = false;

  return points.map((point, i) => {
    if (i > 0) {
      pesos += point.netSavingsArs;

      if (dollars === null || point.netSavingsUsd === null) dollars = null;
      else dollars += point.netSavingsUsd;

      if (point.inflationPct === undefined) cpiStopped = true;
      else if (!cpiStopped) index *= 1 + point.inflationPct / 100;
    }

    return {
      date: point.date,
      patrimony: point.patrimonyArs,
      mattress: pesos,
      dollarized: dollars !== null && point.blueRate ? dollars * point.blueRate : null,
      mattressReal: cpiStopped ? null : pesos / index,
    };
  });
}
