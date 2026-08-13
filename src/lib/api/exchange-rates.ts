export interface DolarRate {
  compra: number;
  venta: number;
  nombre: string;
  fechaActualizacion: string;
}

export async function getDolarBlue(): Promise<DolarRate | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue", {
      next: { revalidate: 300 }, // cache 5 minutes
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getDolarOficial(): Promise<DolarRate | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface DolarHistoryPoint {
  fecha: string;
  compra: number;
  venta: number;
}

/**
 * Recent blue history, for spotting a sharp move. The upstream only serves the
 * whole series (~500 KB) with no date-scoped endpoint, so this runs server-side
 * on a long revalidate and returns just the tail.
 */
export async function getDolarBlueHistory(days = 10): Promise<DolarHistoryPoint[] | null> {
  try {
    const res = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/blue", {
      next: { revalidate: 21600 }, // 6 hours — a weekly delta doesn't move fast
    });
    if (!res.ok) return null;
    const all = (await res.json()) as DolarHistoryPoint[];
    if (!Array.isArray(all)) return null;
    return all.slice(-days);
  } catch {
    return null;
  }
}

export async function getEuroBlue(): Promise<DolarRate | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/cotizaciones/eur", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
