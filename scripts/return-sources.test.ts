import { RETURN_SOURCES, INCOME_SOURCES } from "@/lib/constants/sources";
import { buildTimeline } from "@/lib/utils/patrimony-timeline";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

section("la fuente existe y está bien nombrada");
check("'Investment Returns' es una fuente válida", INCOME_SOURCES.includes("Investment Returns" as never));
check("está marcada como retorno", RETURN_SOURCES.has("Investment Returns"));
check("el sueldo no lo está", !RETURN_SOURCES.has("Salary"));
check("el freelance tampoco", !RETURN_SOURCES.has("Freelance"));

section("el filtro cambia el resultado del gráfico");
{
  const common = {
    snapshots: [{ date: "2026-01-31", totalArs: 10_000_000 }],
    blueSeries: [
      { fecha: "2026-01-31", compra: 980, venta: 1000 },
      { fecha: "2026-02-28", compra: 1080, venta: 1100 },
    ],
    inflationSeries: null,
  };
  // 500 of salary and 561 of trading profit in February
  const all = buildTimeline({
    ...common,
    flows: [
      { date: "2026-01-10", amountArs: 1_000_000, sign: 1 as const },
      { date: "2026-02-10", amountArs: 500_000, sign: 1 as const },
      { date: "2026-02-20", amountArs: 561_000, sign: 1 as const },
    ],
  });
  const filtered = buildTimeline({
    ...common,
    flows: [
      { date: "2026-01-10", amountArs: 1_000_000, sign: 1 as const },
      { date: "2026-02-10", amountArs: 500_000, sign: 1 as const },
    ],
  });
  check("con el retorno adentro, febrero suma 1.061.000", all[1].netSavingsArs === 1_061_000);
  check("sin el retorno, suma solo 500.000", filtered[1].netSavingsArs === 500_000);
  check("y compra menos dólares ese mes",
    (filtered[1].netSavingsUsd ?? 0) < (all[1].netSavingsUsd ?? 0));
  check("el ancla no cambia", all[0].patrimonyArs === filtered[0].patrimonyArs);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
