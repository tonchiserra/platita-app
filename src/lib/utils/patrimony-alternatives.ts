/**
 * One snapshot on the timeline. `netSavingsArs` and `inflationPct` describe the
 * interval *since the previous point*, so both are ignored on the first point
 * of whatever slice is being charted. `blueRate` is the rate on this date.
 */
export interface TimelinePoint {
  date: string;
  patrimonyArs: number;
  netSavingsArs: number;
  blueRate?: number;
  inflationPct?: number;
}

export interface AlternativesPoint {
  date: string;
  /** What actually happened. */
  patrimony: number;
  /** Nominal pesos, never revalued. */
  mattress: number;
  /** What it would take to hold purchasing power. Null once CPI runs out. */
  inflation: number | null;
  /** Every peso converted to dollars the month it arrived. Null without rates. */
  dollarized: number | null;
}

/**
 * Turns a timeline into four comparable series.
 *
 * The three counterfactuals are the same operation in different units: convert
 * each incoming peso into something that does not devalue, accumulate those
 * units, then revalue at each point.
 *
 *   mattress(i)   =         P0 + Σ c
 *   inflation(i)  = idx_i × ( P0/idx_0  + Σ c/idx )
 *   dollarized(i) = blue_i × ( P0/blue_0 + Σ c/blue )
 *
 * The first point is the anchor: all four lines start at its patrimony, which
 * is what makes the comparison mean anything.
 */
export function buildAlternatives(points: TimelinePoint[]): AlternativesPoint[] {
  if (points.length < 2) return [];

  const anchor = points[0];
  const start = anchor.patrimonyArs;

  // Running unit balances. Each is "how much of unit X we hold".
  let nominal = start;
  let realUnits = start; // start / idx_0, and idx_0 is 1 by definition
  let index = 1;

  const startBlue = anchor.blueRate;
  let usdUnits = startBlue && startBlue > 0 ? start / startBlue : null;

  // Once an input runs out mid-series the line ends rather than guessing.
  let cpiStopped = false;

  return points.map((point, i) => {
    if (i > 0) {
      const contribution = point.netSavingsArs;

      nominal += contribution;

      if (point.inflationPct === undefined) {
        cpiStopped = true;
      } else if (!cpiStopped) {
        index *= 1 + point.inflationPct / 100;
        realUnits += contribution / index;
      }

      if (usdUnits !== null) {
        if (point.blueRate && point.blueRate > 0) {
          usdUnits += contribution / point.blueRate;
        } else {
          usdUnits = null;
        }
      }
    }

    return {
      date: point.date,
      patrimony: point.patrimonyArs,
      mattress: nominal,
      inflation: cpiStopped ? null : realUnits * index,
      dollarized:
        usdUnits !== null && point.blueRate && point.blueRate > 0
          ? usdUnits * point.blueRate
          : null,
    };
  });
}
