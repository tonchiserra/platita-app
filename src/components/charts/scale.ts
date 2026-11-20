import { axisScale } from "@/lib/utils/chart-scale";

const NICE = [1, 2, 2.5, 5, 10];

/** Round ticks from zero to just above `max`, 3–5 intervals. For bars, which must start at zero. */
export function zeroScale(max: number): { domain: [number, number]; ticks: number[] } {
  if (!(max > 0)) return { domain: [0, 1], ticks: [0, 1] };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = (NICE.find((n) => n * magnitude >= rough) ?? 10) * magnitude;
  const upper = Math.ceil(max / step) * step;
  const count = Math.round(upper / step);
  return { domain: [0, upper], ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

/** Line charts hug the data (`axisScale`); a flat or empty series falls back to zero-based. */
export function lineScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  return axisScale(finite) ?? zeroScale(Math.max(...finite, 1));
}

/** Every how many months an x label fits: about one per 40px on a phone. */
export function labelStep(count: number, maxLabels = 8): number {
  return Math.max(1, Math.ceil(count / maxLabels));
}
