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
