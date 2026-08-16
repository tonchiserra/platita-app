import { buildTimeline, type TimelineInput } from "@/lib/utils/patrimony-timeline";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};

const input: TimelineInput = {
  snapshots: [
    { date: "2026-01-31", totalArs: 1_000_000 },
    { date: "2026-02-28", totalArs: 1_300_000 },
  ],
  flows: [
    // before the first snapshot: must not count
    { date: "2026-01-10", amountArs: 999_999, sign: 1 },
    { date: "2026-02-05", amountArs: 500_000, sign: 1 },
    { date: "2026-02-20", amountArs: 300_000, sign: -1 },
    // after the last snapshot: must not count
    { date: "2026-03-05", amountArs: 777_777, sign: 1 },
  ],
  blueSeries: [
    { fecha: "2026-01-31", compra: 980, venta: 1000 },
    { fecha: "2026-02-28", compra: 1080, venta: 1100 },
  ],
  inflationSeries: [
    { fecha: "2026-01-31", valor: 3 },
    { fecha: "2026-02-28", valor: 5 },
  ],
};

const out = buildTimeline(input);

check("one point per snapshot", out.length === 2);
check("the first point carries no savings", out[0].netSavingsArs === 0);
check("the first point carries no inflation", out[0].inflationPct === undefined);
check("savings net income against expenses in the interval",
  out[1].netSavingsArs === 200_000, String(out[1].netSavingsArs));
check("flows before the first snapshot are excluded",
  out[0].netSavingsArs === 0 && out[1].netSavingsArs === 200_000);
check("flows after the last snapshot are excluded", out.length === 2);
check("the blue rate is the one on that date", out[1].blueRate === 1100);
// Compounding one 3 % month lands on 3.0000000000000027, so compare with a
// tolerance rather than by identity.
check("inflation covers the interval",
  Math.abs((out[1].inflationPct ?? 0) - 3) < 1e-9, String(out[1].inflationPct));
check("patrimony passes through", out[1].patrimonyArs === 1_300_000);

const noRates = buildTimeline({ ...input, blueSeries: null, inflationSeries: null });
check("without a blue series the rate is undefined", noRates[1].blueRate === undefined);
check("without CPI the inflation is undefined", noRates[1].inflationPct === undefined);

check("fewer than two snapshots yields nothing",
  buildTimeline({ ...input, snapshots: [input.snapshots[0]] }).length === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
