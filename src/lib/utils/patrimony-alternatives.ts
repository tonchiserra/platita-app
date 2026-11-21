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
 * This is the whole-history line. A time range that opens later restarts the
 * dollarized line at its own first month with `rebaseDollarized`.
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

export interface DollarizedSeries {
  ars: (number | null)[];
  usd: (number | null)[];
}

export interface RebaseInput {
  /** The whole-history line, from `buildAlternatives`. */
  full: DollarizedSeries;
  /** Recorded net worth per month (closes and today's estimate), null where none. */
  patrimony: (number | null)[];
  /** Blue at each month end. */
  blue: (number | null)[];
  /** That month's savings, in dollars bought at that month's blue. */
  savingsUsd: (number | null)[];
}

/**
 * The dollarized line for a window that opens at month `from`, returned
 * cropped to that window. It answers "if I had gone to dollars at the start of
 * this range": the net worth recorded that month turned into dollars at its
 * blue, plus each later month's savings in dollars of their own month, all
 * valued at each month's blue. Both lines leave from the same point.
 *
 *   dollarized(i) = blue_i × ( P_from / blue_from + Σ savingsUsd after from )
 *
 * As in `buildAlternatives`, the anchor month adds no savings: its close
 * already counts them.
 *
 * A window that opens at or before the first movement keeps the whole-history
 * line, since there is nothing earlier to drop. A month with no recorded net
 * worth can't anchor, so the line starts at the first one in the window that has it.
 */
export function rebaseDollarized(input: RebaseInput, from: number): DollarizedSeries {
  const { full, patrimony, blue, savingsUsd } = input;
  const first = full.ars.findIndex((v) => v !== null);
  if (first === -1 || from <= first) return { ars: full.ars.slice(from), usd: full.usd.slice(from) };

  let anchor = from;
  while (anchor < patrimony.length && (patrimony[anchor] === null || !blue[anchor])) anchor++;

  const ars: (number | null)[] = [];
  const usd: (number | null)[] = [];
  let dollars: number | null = null;
  for (let i = from; i < patrimony.length; i++) {
    if (i === anchor) dollars = patrimony[i]! / blue[i]!;
    else if (i > anchor && dollars !== null) {
      const saved = savingsUsd[i];
      dollars = saved === null ? null : dollars + saved;
    }
    const rate = blue[i];
    const value = i >= anchor && dollars !== null && rate ? dollars * rate : null;
    ars.push(value);
    usd.push(value === null ? null : dollars);
  }
  return { ars, usd };
}
