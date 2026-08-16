import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};

const series: DolarHistoryPoint[] = [
  { fecha: "2026-06-28", compra: 1300, venta: 1320 },
  { fecha: "2026-07-01", compra: 1400, venta: 1420 },
  { fecha: "2026-08-01", compra: 1700, venta: 1750 },
];

check("exact date returns that quote", blueRateOn(series, "2026-08-01") === 1750);
check("a gap falls back to the prior quote", blueRateOn(series, "2026-07-15") === 1420);
check("a weekend falls back too", blueRateOn(series, "2026-07-04") === 1420);
check("before the series returns undefined", blueRateOn(series, "2026-01-01") === undefined);
check("an empty series returns undefined", blueRateOn([], "2026-07-15") === undefined);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
