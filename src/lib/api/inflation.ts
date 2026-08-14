export interface InflationPoint {
  /** End-of-month date, `YYYY-MM-DD`. */
  fecha: string;
  /** Monthly inflation, already a percentage (e.g. 2.1 means 2,1 %). */
  valor: number;
}

/**
 * Monthly CPI from argentinadatos. Used to answer the question that matters
 * most here: did net worth actually grow, or did the peso just shrink?
 * Returns null on failure so callers degrade to skipping the comparison.
 */
export async function getMonthlyInflation(months = 24): Promise<InflationPoint[] | null> {
  try {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
      next: { revalidate: 86400 }, // a monthly series; one day is plenty
    });
    if (!res.ok) return null;
    const all = (await res.json()) as InflationPoint[];
    if (!Array.isArray(all)) return null;
    return all.slice(-months);
  } catch {
    return null;
  }
}

/**
 * Compounds the inflation actually experienced between two dates: the month of
 * `fromDate` through the month before `toDate`. Whole months are an
 * approximation, which is fine because snapshots land near month boundaries.
 */
export function inflationBetween(
  series: InflationPoint[],
  fromDate: string,
  toDate: string
): number | undefined {
  const from = fromDate.slice(0, 7);
  const to = toDate.slice(0, 7);
  if (from >= to) return undefined;

  const relevant = series.filter((p) => {
    const month = p.fecha.slice(0, 7);
    return month >= from && month < to;
  });
  if (relevant.length === 0) return undefined;

  const factor = relevant.reduce((acc, p) => acc * (1 + p.valor / 100), 1);
  return (factor - 1) * 100;
}
