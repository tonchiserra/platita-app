import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";
import { inflationBetween, type InflationPoint } from "@/lib/api/inflation";
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
}

/**
 * Folds snapshots, flows, rates and CPI into one row per snapshot. Everything
 * on a row except `patrimonyArs` and `blueRate` describes the interval since
 * the previous row, which is the shape `buildAlternatives` expects.
 */
export function buildTimeline(input: TimelineInput): TimelinePoint[] {
  const { snapshots, flows, blueSeries, inflationSeries } = input;
  if (snapshots.length < 2) return [];

  return snapshots.map((snapshot, i) => {
    const previous = i > 0 ? snapshots[i - 1] : undefined;

    let netSavingsArs = 0;
    if (previous) {
      for (const flow of flows) {
        if (flow.date <= previous.date || flow.date > snapshot.date) continue;
        netSavingsArs += flow.sign * flow.amountArs;
      }
    }

    return {
      date: snapshot.date,
      patrimonyArs: snapshot.totalArs,
      netSavingsArs,
      blueRate: blueSeries ? blueRateOn(blueSeries, snapshot.date) : undefined,
      inflationPct:
        previous && inflationSeries
          ? inflationBetween(inflationSeries, previous.date, snapshot.date)
          : undefined,
    };
  });
}
