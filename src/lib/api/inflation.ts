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

export interface CpiIndexPoint {
  /** `YYYY-MM`. */
  month: string;
  /** CPI-U index level (1982-84 = 100). */
  index: number;
}

/**
 * US CPI-U index levels from the BLS, used to discount the dollarized
 * alternative: dollars kept still lose purchasing power too, just far more
 * slowly than pesos.
 *
 * Index *levels* rather than monthly percentages on purpose. This series has
 * real holes — October 2025 was never published — and a level lets any month be
 * measured straight against the anchor, so a hole costs that one point instead
 * of ending the line the way compounding percentages would.
 *
 * The keyless v1 API serves the last three years and caps at 25 requests per
 * day per IP, which the daily revalidate keeps us well inside. A history that
 * reaches back further simply has no index for its early months, and the line
 * that depends on it does not draw there.
 */
export async function getUsCpiIndex(): Promise<CpiIndexPoint[] | null> {
  try {
    const res = await fetch("https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0", {
      next: { revalidate: 86400 }, // a monthly series; one day is plenty
    });
    if (!res.ok) return null;
    const body = await res.json();
    const rows = body?.Results?.series?.[0]?.data;
    if (!Array.isArray(rows)) return null;

    const points: CpiIndexPoint[] = [];
    for (const row of rows) {
      // `M13` is the annual average, not a thirteenth month, and withheld
      // months arrive as "-" rather than being absent.
      const period = String(row?.period ?? "");
      if (!/^M(0[1-9]|1[0-2])$/.test(period)) continue;
      const index = Number(row?.value);
      if (!Number.isFinite(index) || index <= 0) continue;
      points.push({ month: `${row.year}-${period.slice(1)}`, index });
    }
    return points.sort((a, b) => a.month.localeCompare(b.month));
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
