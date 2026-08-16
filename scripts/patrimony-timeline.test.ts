import { buildTimeline, type TimelineInput } from "@/lib/utils/patrimony-timeline";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

const base: TimelineInput = {
  snapshots: [
    { date: "2026-01-31", totalArs: 5_000_000 },
    { date: "2026-03-31", totalArs: 6_000_000 },
  ],
  flows: [
    { date: "2026-01-05", amountArs: 500_000, sign: 1 },
    { date: "2026-01-20", amountArs: 300_000, sign: -1 },
    { date: "2026-03-10", amountArs: 400_000, sign: 1 },
  ],
  blueSeries: [
    { fecha: "2026-01-31", compra: 980, venta: 1000 },
    { fecha: "2026-02-28", compra: 1230, venta: 1250 },
    { fecha: "2026-03-31", compra: 1980, venta: 2000 },
  ],
  inflationSeries: [
    { fecha: "2026-01-31", valor: 3 },
    { fecha: "2026-02-28", valor: 4 },
    { fecha: "2026-03-31", valor: 5 },
  ],
};

section("una fila por mes calendario");
{
  const out = buildTimeline(base);
  check("fills the gap month", out.length === 3, String(out.length));
  check("months are consecutive",
    out.map((p) => p.month).join(",") === "2026-01,2026-02,2026-03",
    out.map((p) => p.month).join(","));
  check("the x value is the month end", out[0].date === "2026-01-31");
  check("february ends on the 28th in 2026", out[1].date === "2026-02-28");
}

section("arranca en el primer movimiento, no en el primer cierre");
{
  const earlySnapshot = buildTimeline({
    ...base,
    snapshots: [{ date: "2025-06-30", totalArs: 4_000_000 }, ...base.snapshots],
  });
  check("a snapshot before any flow does not extend the series backwards",
    earlySnapshot[0].month === "2026-01", earlySnapshot[0].month);
  check("no flows means no timeline at all", buildTimeline({ ...base, flows: [] }).length === 0);
}

section("ahorro neto del mes");
{
  const out = buildTimeline(base);
  check("income minus expenses", out[0].netSavingsArs === 200_000, String(out[0].netSavingsArs));
  check("a month without flows is zero, not missing", out[1].netSavingsArs === 0);
  check("later months keep their own flows", out[2].netSavingsArs === 400_000);
}

section("dólares comprados ese mes");
{
  const out = buildTimeline(base);
  check("200.000 a 1000", out[0].netSavingsUsd === 200);
  check("a zero month buys nothing", out[1].netSavingsUsd === 0);
  check("400.000 a 2000", out[2].netSavingsUsd === 200);
  check("without a rate series it is null",
    buildTimeline({ ...base, blueSeries: null })[0].netSavingsUsd === null);
}

section("patrimonio por mes");
{
  const out = buildTimeline(base);
  check("a month with a close carries it", out[0].patrimonyArs === 5_000_000);
  const noCloseThatMonth = buildTimeline({
    ...base,
    snapshots: [{ date: "2025-12-31", totalArs: 4_400_000 }, { date: "2026-03-31", totalArs: 6_000_000 }],
  });
  check("the anchor month carries the last known close when it has none",
    noCloseThatMonth[0].patrimonyArs === 4_400_000, String(noCloseThatMonth[0].patrimonyArs));
  check("a later month without a close stays null", noCloseThatMonth[1].patrimonyArs === null);
  check("with no earlier close the anchor takes the first one available",
    buildTimeline({ ...base, snapshots: [{ date: "2026-03-31", totalArs: 6_000_000 }] })[0].patrimonyArs === 6_000_000);
  check("a month without one is null", out[1].patrimonyArs === null);
  check("the last close lands on its month", out[2].patrimonyArs === 6_000_000);
  const twoInAMonth = buildTimeline({
    ...base,
    snapshots: [
      { date: "2026-01-10", totalArs: 1_000_000 },
      { date: "2026-01-31", totalArs: 5_000_000 },
    ],
  });
  check("two closes in one month: the later one wins", twoInAMonth[0].patrimonyArs === 5_000_000);
}

section("cotización e inflación del mes");
{
  const out = buildTimeline(base);
  check("rate is taken at month end", out[1].blueRate === 1250);
  check("CPI is that month's own figure", out[1].inflationPct === 4);
  check("without CPI it is undefined",
    buildTimeline({ ...base, inflationSeries: null })[0].inflationPct === undefined);
  check("a month past the published CPI is undefined",
    buildTimeline({ ...base, inflationSeries: [{ fecha: "2026-01-31", valor: 3 }] })[2].inflationPct === undefined);
}

section("cruce de año");
{
  const out = buildTimeline({
    ...base,
    snapshots: [],
    flows: [
      { date: "2025-11-10", amountArs: 100_000, sign: 1 },
      { date: "2026-02-10", amountArs: 100_000, sign: 1 },
    ],
  });
  check("december rolls into january",
    out.map((p) => p.month).join(",") === "2025-11,2025-12,2026-01,2026-02",
    out.map((p) => p.month).join(","));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
