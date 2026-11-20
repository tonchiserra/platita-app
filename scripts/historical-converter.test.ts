import { blueRateOn, makeBlueLookup, type DolarHistoryPoint } from "@/lib/api/exchange-rates";
import { makeHistoricalConverter } from "@/lib/utils/currency-conversion";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

const series: DolarHistoryPoint[] = [
  { fecha: "2026-01-02", compra: 990, venta: 1000 },
  { fecha: "2026-01-05", compra: 1040, venta: 1050 },
  { fecha: "2026-02-02", compra: 1190, venta: 1200 },
];

section("la búsqueda binaria coincide con blueRateOn");
{
  const lookup = makeBlueLookup([...series].reverse())!; // unsorted input on purpose
  for (const d of ["2026-01-02", "2026-01-03", "2026-01-05", "2026-01-31", "2026-02-02", "2026-03-15"]) {
    check(`same rate on ${d}`, lookup(d) === blueRateOn(series, d), `${lookup(d)} vs ${blueRateOn(series, d)}`);
  }
  check("before the series it takes the first quote", lookup("2025-12-31") === 1000);
  check("no series, no lookup", makeBlueLookup(null) === null && makeBlueLookup([]) === null);
}

section("cada movimiento a la cotización de su fecha");
{
  const fx = { usdRate: 1400, eurRate: 1540, btcUsd: 60000, ethUsd: 2000 };
  const conv = makeHistoricalConverter(fx, makeBlueLookup(series));
  check("ARS → USD at that day's blue", conv.toUsd({ amount: 105000, currency: "ARS", date: "2026-01-06" }) === 100);
  check("ARS stays ARS", conv.toArs({ amount: 5000, currency: "ARS", date: "2026-01-06" }) === 5000);
  check("USD → ARS at that day's blue", conv.toArs({ amount: 10, currency: "USD", date: "2026-02-10" }) === 12000);
  check("USD stays USD", conv.toUsd({ amount: 10, currency: "USD", date: "2026-02-10" }) === 10);
  check("EUR crosses through today's EUR/USD", Math.abs(conv.toUsd({ amount: 100, currency: "EUR", date: "2026-01-06" }) - 110) < 1e-9);
  check("BTC at today's price", conv.toUsd({ amount: 0.5, currency: "BTC", date: "2026-01-06" }) === 30000);
  check("strings from PostgREST are numbers", conv.toUsd({ amount: "105000", currency: "ARS", date: "2026-01-06" }) === 100);
  const flat = makeHistoricalConverter(fx, null);
  check("without history it falls back to today's blue", flat.toUsd({ amount: 1400, currency: "ARS", date: "2020-01-01" }) === 1);
}

console.log(`\n${pass} ok, ${fail} failed`);
if (fail > 0) process.exit(1);
