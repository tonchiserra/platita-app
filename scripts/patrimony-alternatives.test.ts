import { buildAlternatives, type TimelinePoint } from "@/lib/utils/patrimony-alternatives";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};
const section = (name: string) => console.log("\n" + name);
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1;

/**
 * Anchor 1.000.000 with blue at 1000, then two months of 200.000 saved,
 * blue 1100 and 1200, inflation 5 % and 4 %.
 */
const worked: TimelinePoint[] = [
  { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
  { date: "2026-02-28", patrimonyArs: 1_300_000, netSavingsArs: 200_000, blueRate: 1100, inflationPct: 5 },
  { date: "2026-03-31", patrimonyArs: 1_700_000, netSavingsArs: 200_000, blueRate: 1200, inflationPct: 4 },
];

section("anclaje");
{
  const out = buildAlternatives(worked);
  check("returns one row per point", out.length === 3);
  const first = out[0];
  check("the four lines start equal at the anchor",
    first.patrimony === 1_000_000 && first.mattress === 1_000_000 &&
    near(first.inflation, 1_000_000) && near(first.dollarized, 1_000_000));
  check("fewer than two points yields nothing", buildAlternatives([worked[0]]).length === 0);
  check("an empty timeline yields nothing", buildAlternatives([]).length === 0);
}

section("ejemplo trabajado a mano");
{
  const out = buildAlternatives(worked);
  check("patrimony passes through", out[2].patrimony === 1_700_000);
  // 1.000.000 + 200.000 + 200.000
  check("mattress accumulates nominally", out[2].mattress === 1_400_000);
  // 1.000.000 x 1,092 + 200.000 x 1,04 + 200.000
  check("inflation compounds each contribution from its own month",
    near(out[2].inflation, 1_500_000), String(out[2].inflation));
  // (1.000.000/1000 + 200.000/1100 + 200.000/1200) x 1200
  check("dollarized converts at each month's rate",
    near(out[2].dollarized, 1_618_182), String(out[2].dollarized));
}

section("degenerados");
{
  const noSavings: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_500_000, netSavingsArs: 0, blueRate: 1000, inflationPct: 0 },
  ];
  const out = buildAlternatives(noSavings);
  check("with no savings the mattress stays flat", out[1].mattress === 1_000_000);
  check("with zero inflation, inflation equals the mattress", near(out[1].inflation, out[1].mattress));
  check("with a flat blue, dollarized equals the mattress", near(out[1].dollarized, out[1].mattress));

  const flatBlue: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_500_000, netSavingsArs: 500_000, blueRate: 1000, inflationPct: 0 },
  ];
  const flat = buildAlternatives(flatBlue);
  check("a flat blue tracks the mattress even with savings",
    near(flat[1].dollarized, 1_500_000) && flat[1].mattress === 1_500_000);
  check("zero inflation tracks the mattress even with savings",
    near(flat[1].inflation, 1_500_000));
}

section("meses en rojo");
{
  const overspent: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 900_000, netSavingsArs: -300_000, blueRate: 1000, inflationPct: 0 },
  ];
  const out = buildAlternatives(overspent);
  check("a negative month lowers the mattress", out[1].mattress === 700_000);
  check("a negative month lowers the dollarized line", near(out[1].dollarized, 700_000));
  check("it is not floored at zero",
    buildAlternatives([
      { date: "2026-01-31", patrimonyArs: 100_000, netSavingsArs: 0, blueRate: 1000 },
      { date: "2026-02-28", patrimonyArs: 0, netSavingsArs: -300_000, blueRate: 1000, inflationPct: 0 },
    ])[1].mattress === -200_000);
}

section("datos faltantes");
{
  const cpiLag: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_100_000, netSavingsArs: 100_000, blueRate: 1100, inflationPct: 5 },
    { date: "2026-03-31", patrimonyArs: 1_200_000, netSavingsArs: 100_000, blueRate: 1200 },
  ];
  const out = buildAlternatives(cpiLag);
  check("the inflation line stops where CPI stops", out[2].inflation === null);
  check("earlier inflation points survive", out[1].inflation !== null);
  check("the dollarized line is unaffected", out[2].dollarized !== null);

  const noBlue: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0 },
    { date: "2026-02-28", patrimonyArs: 1_100_000, netSavingsArs: 100_000, inflationPct: 5 },
  ];
  const bare = buildAlternatives(noBlue);
  check("without any blue the dollarized line is null throughout",
    bare[0].dollarized === null && bare[1].dollarized === null);
  check("the other lines still compute", bare[1].mattress === 1_100_000 && bare[1].inflation !== null);
}

section("re-baseo");
{
  const full = buildAlternatives(worked);
  const rebased = buildAlternatives(worked.slice(1));
  check("a later anchor starts from that point's patrimony", rebased[0].mattress === 1_300_000);
  // Read off the inflation line, not the dollarized one. In this dataset the
  // full run's dollarized value at 2026-02-28 coincides with the actual
  // patrimony there (both 1.300.000), so re-basing restarts from the very same
  // dollar balance and lands identically — the one series that cannot show the
  // property. Inflation does: 1.500.000 full against 1.552.000 re-based.
  check("re-basing is not a constant offset",
    Math.abs((rebased[1].inflation ?? 0) - (full[2].inflation ?? 0)) > 1);
  check("the anchor's own savings are ignored", rebased[0].mattress === rebased[0].patrimony);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
