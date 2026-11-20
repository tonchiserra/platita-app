/**
 * Peso exchange rates. Every fetcher returns `null` on failure instead of
 * throwing, so a dead upstream degrades to missing figures, never a crashed page.
 */

export interface DolarRate {
  compra: number;
  venta: number;
  nombre: string;
  fechaActualizacion: string;
}

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Blue sell side is the app's peso rate everywhere. */
export function getDolarBlue() {
  return getJson<DolarRate>("https://dolarapi.com/v1/dolares/blue", 300);
}

export function getDolarOficial() {
  return getJson<DolarRate>("https://dolarapi.com/v1/dolares/oficial", 300);
}

export function getEuroBlue() {
  return getJson<DolarRate>("https://dolarapi.com/v1/cotizaciones/eur", 300);
}

export interface DolarHistoryPoint {
  fecha: string;
  compra: number;
  venta: number;
}

/** Blue sell rate on `date`, or the closest earlier quote (weekends, holidays). */
export function blueRateOn(series: DolarHistoryPoint[], date: string): number | undefined {
  let best: DolarHistoryPoint | undefined;
  for (const point of series) {
    if (point.fecha <= date && (!best || point.fecha > best.fecha)) best = point;
  }
  return best?.venta;
}

/**
 * `blueRateOn` for many dates: sorts once and binary-searches, instead of
 * scanning two thousand quotes for every one of thousands of movements.
 * Dates before the series starts get its first quote — better an early
 * rate than a movement that silently drops out of a dollar total.
 */
export function makeBlueLookup(series: DolarHistoryPoint[] | null): ((date: string) => number | undefined) | null {
  if (!series || series.length === 0) return null;
  const sorted = [...series].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const dates = sorted.map((p) => p.fecha);
  const cache = new Map<string, number | undefined>();
  return (date: string) => {
    const hit = cache.get(date);
    if (hit !== undefined || cache.has(date)) return hit;
    let lo = 0;
    let hi = dates.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const rate = sorted[found === -1 ? 0 : found]?.venta;
    cache.set(date, rate);
    return rate;
  };
}

/**
 * Blue history, for valuing past movements at the rate of their own day. The
 * upstream only serves the whole series (~500 KB) with no date-scoped
 * endpoint, so this runs server-side on a long revalidate and keeps the tail.
 */
export async function getDolarBlueHistory(days = 4000): Promise<DolarHistoryPoint[] | null> {
  const all = await getJson<DolarHistoryPoint[]>("https://api.argentinadatos.com/v1/cotizaciones/dolares/blue", 21600);
  if (!Array.isArray(all)) return null;
  return all.slice(-days);
}
