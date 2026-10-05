import { axisScale } from "@/lib/utils/chart-scale";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);
const show = (s: ReturnType<typeof axisScale>) => (s ? `${s.domain.join("…")} [${s.ticks.join(", ")}]` : "undefined");

section("no cae a cero cuando los datos están lejos");
{
  // The alternatives chart on a year: lines between ~10M and ~29M.
  const s = axisScale([10_200_000, 13_000_000, 29_000_000])!;
  check("the floor stays above zero", s.domain[0] > 0, show(s));
  check("the floor is under the lowest value", s.domain[0] <= 10_200_000, show(s));
  check("the ceiling is over the highest value", s.domain[1] >= 29_000_000, show(s));
  check("the data fills at least half the height",
    (29_000_000 - 10_200_000) / (s.domain[1] - s.domain[0]) >= 0.5, show(s));
}

section("marcas legibles");
{
  for (const values of [[10_200_000, 29_000_000], [15_500_000, 28_900_000], [1_234, 9_876], [0.2, 0.9]]) {
    const s = axisScale(values)!;
    const steps = s.ticks.slice(1).map((t, i) => t - s.ticks[i]);
    check(`${values.join("–")}: between 4 and 7 marks`, s.ticks.length >= 4 && s.ticks.length <= 7, show(s));
    check(`${values.join("–")}: evenly spaced`,
      steps.every((d) => Math.abs(d - steps[0]) < steps[0] * 1e-9), show(s));
    check(`${values.join("–")}: the marks span the whole domain`,
      s.ticks[0] === s.domain[0] && Math.abs(s.ticks[s.ticks.length - 1] - s.domain[1]) < steps[0] * 1e-9, show(s));
    const mantissa = steps[0] / 10 ** Math.floor(Math.log10(steps[0]));
    check(`${values.join("–")}: the step is 1, 2, 2.5 or 5 × 10ⁿ`,
      [1, 2, 2.5, 5].some((n) => Math.abs(mantissa - n) < 1e-9), String(steps[0]));
  }
}

section("cero y negativos");
{
  const fromZero = axisScale([0, 1_000_000])!;
  check("data that starts at zero keeps zero as the floor", fromZero.domain[0] === 0, show(fromZero));
  const nearZero = axisScale([50_000, 5_000_000])!;
  check("non-negative data never gets a negative floor", nearZero.domain[0] >= 0, show(nearZero));
  const crossing = axisScale([-500_000, 2_000_000])!;
  check("data that goes negative gets a negative floor", crossing.domain[0] < -500_000 || crossing.domain[0] === -500_000, show(crossing));
}

section("casos borde");
{
  check("no values, no scale", axisScale([]) === undefined);
  const flat = axisScale([5_000_000, 5_000_000])!;
  check("a flat series still gets a range around it",
    flat.domain[0] < 5_000_000 && flat.domain[1] > 5_000_000, show(flat));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
