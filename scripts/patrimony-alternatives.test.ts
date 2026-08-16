import { buildAlternatives, type TimelinePoint } from "@/lib/utils/patrimony-alternatives";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1;

const month = (
  m: string,
  netSavingsArs: number,
  blueRate: number | undefined,
  inflationPct: number | undefined,
  patrimonyArs: number | null = null
): TimelinePoint => ({
  month: m,
  date: `${m}-28`,
  patrimonyArs,
  netSavingsArs,
  netSavingsUsd: blueRate ? netSavingsArs / blueRate : null,
  blueRate,
  inflationPct,
});

/**
 * Three months of 100.000 saved, blue at 1000 / 1250 / 2000, inflation 10 %
 * each month. Every figure below is worked by hand in the comments.
 */
const worked = [
  month("2026-01", 100_000, 1000, 10, 5_000_000),
  month("2026-02", 100_000, 1250, 10, 5_400_000),
  month("2026-03", 100_000, 2000, 10, 6_100_000),
];

section("las cuatro arrancan del mismo punto");
{
  const out = buildAlternatives(worked);
  check("all four equal the anchor patrimony at the first month",
    out[0].patrimony === 5_000_000 &&
    out[0].mattress === 5_000_000 &&
    near(out[0].dollarized, 5_000_000) &&
    out[0].mattressReal === 5_000_000,
    `${out[0].patrimony} / ${out[0].mattress} / ${out[0].dollarized} / ${out[0].mattressReal}`);
  check("the anchor month adds no savings — its close already includes them",
    out[0].mattress === 5_000_000);
  check("an empty timeline yields nothing", buildAlternatives([]).length === 0);
  check("without any snapshot the anchor is zero",
    buildAlternatives([month("2026-01", 100_000, 1000, 10, null)])[0].mattress === 0);
}

section("colchón: el ancla más los pesos que se fueron sumando");
{
  const out = buildAlternatives(worked);
  // anchor 5.000.000, then +100.000 and +100.000
  check("month 1 is the anchor", out[0].mattress === 5_000_000);
  check("month 2", out[1].mattress === 5_100_000);
  check("month 3", out[2].mattress === 5_200_000);
}

section("dolarizado: el ancla comprada a 1000, más lo de cada mes");
{
  const out = buildAlternatives(worked);
  // 5000 USD at the anchor
  check("month 1 equals the anchor", near(out[0].dollarized, 5_000_000));
  // (5000 + 100.000/1250) x 1250 = 6.350.000
  check("month 2 revalues the whole stock", near(out[1].dollarized, 6_350_000), String(out[1].dollarized));
  // (5080 + 100.000/2000) x 2000 = 10.260.000
  check("month 3", near(out[2].dollarized, 10_260_000), String(out[2].dollarized));
  check("it beats the mattress when the blue runs", (out[2].dollarized ?? 0) > out[2].mattress);
}

section("valor real: el colchón desinflado, por debajo");
{
  const out = buildAlternatives(worked);
  check("the anchor month is the base, undeflated", out[0].mattressReal === out[0].mattress);
  // 5.100.000 / 1,1
  check("month 2", near(out[1].mattressReal, 4_636_364), String(out[1].mattressReal));
  // 5.200.000 / 1,21
  check("month 3", near(out[2].mattressReal, 4_297_521), String(out[2].mattressReal));
  check("always at or below the mattress",
    out.every((p) => (p.mattressReal ?? 0) <= p.mattress));
}

section("meses en rojo");
{
  const out = buildAlternatives([
    month("2026-01", 100_000, 1000, 0, 0),
    month("2026-02", -300_000, 1000, 0),
  ]);
  // anchor 0, then -300.000 in month 2
  check("the mattress goes negative", out[1].mattress === -300_000);
  check("so does the dollarized line", near(out[1].dollarized, -300_000));
  check("it is not floored at zero", out[1].mattress < 0);
}

section("datos faltantes");
{
  const cpiLag = buildAlternatives([
    month("2026-01", 100_000, 1000, 10, 0),
    month("2026-02", 100_000, 1250, undefined),
  ]);
  check("the real line stops where CPI stops", cpiLag[1].mattressReal === null);
  check("earlier months survive", cpiLag[0].mattressReal !== null);
  check("the dollarized line is unaffected", cpiLag[1].dollarized !== null);

  const noBlue = buildAlternatives([
    month("2026-01", 100_000, undefined, 10, 0),
    month("2026-02", 100_000, undefined, 10),
  ]);
  check("without rates the dollarized line is null throughout",
    noBlue[0].dollarized === null && noBlue[1].dollarized === null);
  check("the other lines still compute", noBlue[1].mattress === 100_000 && noBlue[1].mattressReal !== null);
}

section("meses sin snapshot");
{
  const out = buildAlternatives([
    month("2026-01", 100_000, 1000, 0, 5_000_000),
    month("2026-02", 100_000, 1000, 0, null),
    month("2026-03", 100_000, 1000, 0, 5_400_000),
  ]);
  check("a month without a close leaves patrimony null", out[1].patrimony === null);
  check("the alternatives keep accumulating anyway", out[1].mattress === 5_100_000);
}

section("el rango no cambia el cálculo");
{
  // Cropping the output must equal computing on the whole history and slicing.
  const full = buildAlternatives(worked);
  const cropped = full.filter((p) => p.date >= "2026-02-01");
  check("the last month is identical either way",
    cropped[cropped.length - 1].mattress === full[2].mattress &&
    near(cropped[cropped.length - 1].dollarized, full[2].dollarized ?? 0));
  check("a cropped view does not restart at the anchor", cropped[0].mattress === 5_100_000);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
