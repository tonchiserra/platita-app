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
  /**
   * True when `patrimonyArs` is the estimate for a month that has not been
   * closed yet, rather than a recorded close.
   */
  patrimonyIsEstimate?: boolean;
  /** Income minus expenses that month, in pesos of that month. */
  netSavingsArs: number;
  /** The same flows, in dollars bought at that month's rate. */
  netSavingsUsd: number | null;
  /** Blue sell rate at month end. */
  blueRate?: number;
  /** That month's CPI, as a percentage. */
  inflationPct?: number;
  /**
   * US CPI-U index level for that month. A level, not a monthly change, so a
   * month the BLS never published costs only its own point.
   */
  usCpiIndex?: number;
}

export interface AlternativesPoint {
  date: string;
  /** What was actually recorded. Null in months without a snapshot. */
  patrimony: number | null;
  /**
   * Carries the last recorded close and the estimate for the open month, and
   * nothing else, so the chart can draw that one segment as a projection.
   */
  patrimonyEstimate: number | null;
  /** Every peso saved, kept as pesos. */
  mattress: number;
  /** Every peso saved, turned into dollars that month, valued at today's rate. */
  dollarized: number | null;
  /** What the mattress pesos really buy, in money of the first month. */
  mattressReal: number | null;
  /** The same dollars, less the purchasing power US inflation took from them. */
  dollarizedReal: number | null;
}

/**
 * Accumulates the flows four ways and returns one row per month.
 *
 * All the lines start from the same anchor: the patrimony as of the month of
 * the first recorded movement. From there each alternative carries that money
 * in a different unit and adds what was saved each month.
 *
 *   mattress(i)       = P0 + Σ savings, in pesos
 *   dollarized(i)     = blue_i × ( P0/blue_0 + Σ savings ÷ blue of their month )
 *   mattressReal(i)   = mattress(i) ÷ inflation accumulated since the anchor
 *   dollarizedReal(i) = dollarized(i) × usCpi_0 / usCpi_i
 *
 * The two "real" lines are deliberately not symmetric, because they answer
 * different questions. `mattressReal` restates the pesos in money of the anchor
 * month. `dollarizedReal` keeps the nominal peso value the dollars fetch today
 * and removes only what US inflation took from the dollar itself — it is the
 * dollarized line with the dollar's own debasement netted out, not a
 * translation into anchor pesos.
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
  const anchorUsCpi = points[0].usCpiIndex;

  let pesos = anchorArs;
  let dollars = anchorBlue ? anchorArs / anchorBlue : null;
  let index = 1;
  let cpiStopped = false;

  const out = points.map((point, i) => {
    if (i > 0) {
      pesos += point.netSavingsArs;

      if (dollars === null || point.netSavingsUsd === null) dollars = null;
      else dollars += point.netSavingsUsd;

      if (point.inflationPct === undefined) cpiStopped = true;
      else if (!cpiStopped) index *= 1 + point.inflationPct / 100;
    }

    const dollarized = dollars !== null && point.blueRate ? dollars * point.blueRate : null;

    return {
      date: point.date,
      // An unclosed month is not a recorded value, so it stays out of the solid
      // line and is handed to `patrimonyEstimate` below instead.
      patrimony: point.patrimonyIsEstimate ? null : point.patrimonyArs,
      patrimonyEstimate: null as number | null,
      mattress: pesos,
      dollarized,
      mattressReal: cpiStopped ? null : pesos / index,
      // Measured against the anchor rather than compounded month to month, so a
      // month the BLS never published nulls itself and the next one recovers.
      dollarizedReal:
        dollarized !== null && anchorUsCpi && point.usCpiIndex
          ? dollarized * (anchorUsCpi / point.usCpiIndex)
          : null,
    };
  });

  // The projected segment needs both ends: the last real close, and the
  // estimate it runs to. Everything between stays null so nothing else draws.
  const estimateIdx = points.findIndex((p) => p.patrimonyIsEstimate && p.patrimonyArs !== null);
  if (estimateIdx > -1) {
    let lastCloseIdx = -1;
    for (let i = estimateIdx - 1; i >= 0; i--) {
      if (out[i].patrimony !== null) { lastCloseIdx = i; break; }
    }
    out[estimateIdx].patrimonyEstimate = points[estimateIdx].patrimonyArs;
    if (lastCloseIdx > -1) out[lastCloseIdx].patrimonyEstimate = out[lastCloseIdx].patrimony;
  }

  return out;
}
