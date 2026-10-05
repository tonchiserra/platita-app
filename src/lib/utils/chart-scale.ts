/** Steps a gridline may take, as multiples of a power of ten. */
const NICE = [1, 2, 2.5, 5];

/**
 * A y-axis that hugs the data, on round gridlines. For charts whose point is
 * the gaps between lines, which a zero-based axis squeezes into one band.
 *
 * Tries every round step near the data's own scale and keeps the tightest
 * domain that lands on 3 to 6 intervals. Taking the first step rounded *up*
 * from the span instead could double it — 5.9M became 10M — and snapping the
 * floor to a 10M multiple put lines that never fall below 10M on an axis from
 * zero, leaving half the chart empty.
 */
export function axisScale(
  values: number[]
): { domain: [number, number]; ticks: number[] } | undefined {
  if (values.length === 0) return undefined;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) * 0.2 || 1;
  // Breathing room so no line runs along the frame.
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  // Never below zero unless the data is: an empty negative band says nothing.
  const floor = min >= 0 ? 0 : -Infinity;

  let best: { lower: number; upper: number; step: number } | undefined;
  const magnitude = 10 ** Math.floor(Math.log10((hi - lo) / 5));
  for (const m of [magnitude / 10, magnitude, magnitude * 10]) {
    for (const n of NICE) {
      const step = n * m;
      const lower = Math.max(Math.floor(lo / step) * step, floor);
      const upper = Math.ceil(hi / step) * step;
      const intervals = Math.round((upper - lower) / step);
      if (intervals < 3 || intervals > 6) continue;
      if (!best || upper - lower < best.upper - best.lower) best = { lower, upper, step };
    }
  }
  if (!best) return undefined;

  // Each mark from its index, not by repeated addition, so 0.1-sized steps
  // don't drift off the gridline.
  const count = Math.round((best.upper - best.lower) / best.step);
  const ticks = Array.from({ length: count + 1 }, (_, i) => best.lower + i * best.step);
  return { domain: [best.lower, best.upper], ticks };
}
