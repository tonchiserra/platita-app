import { buildPerformance, buildPositions, type Operation } from "@/lib/utils/portfolio";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);
const near = (a: number | null | undefined, b: number) => a !== null && a !== undefined && Math.abs(a - b) < 1e-6;

const op = (date: string, asset: string, side: "buy" | "sell", units: number, total: number, currency = "USD", asset_type = "crypto"): Operation =>
  ({ date, asset, asset_type, side, units, total_amount: total, currency });

// Pesos convert at a fixed 1000, so the arithmetic stays readable.
const toUsd = (o: Operation) => (o.currency === "ARS" ? o.total_amount / 1000 : o.total_amount);

section("costo promedio");
{
  const ops = [op("2026-01-10", "BTC", "buy", 1, 50_000), op("2026-02-10", "btc ", "buy", 1, 70_000)];
  const { positions } = buildPositions(ops, toUsd, { BTC: { usd: 80_000, source: "crypto" } });
  const p = positions[0];
  check("one position despite the different spelling", positions.length === 1);
  check("units add up", p.units === 2);
  check("average cost is the mean of the purchases", near(p.avgCostUsd, 60_000));
  check("value is units × price", near(p.valueUsd, 160_000));
  check("unrealized is value − cost", near(p.unrealizedUsd, 40_000));
  check("unrealized % is over cost", near(p.unrealizedPct, (40_000 / 120_000) * 100));
}

section("una venta realiza al costo promedio y no lo mueve");
{
  const ops = [
    op("2026-01-10", "ETH", "buy", 2, 4_000),
    op("2026-02-10", "ETH", "buy", 2, 8_000),
    op("2026-03-10", "ETH", "sell", 1, 5_000),
  ];
  const { positions, summary } = buildPositions(ops, toUsd, { ETH: { usd: 2_500, source: "crypto" } });
  const p = positions[0];
  check("units drop by the sale", p.units === 3);
  check("average cost stays at 3000", near(p.avgCostUsd, 3_000));
  check("realized is proceeds − avg × sold", near(p.realizedUsd, 2_000));
  check("cost basis is what remains", near(p.costUsd, 9_000));
  check("net invested is buys − proceeds", near(summary.netInvestedUsd, 7_000));
  check("summary carries the realized result", near(summary.realizedUsd, 2_000));
}

section("vender todo cierra la posición");
{
  const ops = [op("2026-01-10", "SOL", "buy", 10, 1_000), op("2026-02-10", "SOL", "sell", 10, 1_500)];
  const { positions, summary } = buildPositions(ops, toUsd, {});
  const p = positions[0];
  check("closed", p.closed);
  check("realized 500", near(p.realizedUsd, 500));
  check("worth nothing now", p.valueUsd === 0);
  check("a closed position is not 'sin precio'", summary.unpricedAssets.length === 0);
}

section("vender de más solo cuenta lo que había");
{
  const ops = [op("2026-01-10", "ADA", "buy", 10, 100), op("2026-02-10", "ADA", "sell", 20, 400)];
  const p = buildPositions(ops, toUsd, {}).positions[0];
  check("units floor at zero", p.units === 0);
  check("only the held half is realized: 200 − 100", near(p.realizedUsd, 100));
}

section("pesos al blue de la operación");
{
  const ops = [op("2026-01-10", "GGAL", "buy", 100, 500_000, "ARS", "stock")];
  const p = buildPositions(ops, toUsd, { GGAL: { usd: 6, source: "market" } }).positions[0];
  check("cost in dollars", near(p.costUsd, 500));
  check("value in dollars", near(p.valueUsd, 600));
}

section("sin precio");
{
  const ops = [op("2026-01-10", "Plazo fijo", "buy", 1, 1_000, "USD", "other"), op("2026-01-10", "BTC", "buy", 1, 1_000)];
  const { positions, summary } = buildPositions(ops, toUsd, { BTC: { usd: 2_000, source: "crypto" } });
  const pf = positions.find((p) => p.key === "PLAZO FIJO")!;
  check("unpriced value is null", pf.valueUsd === null);
  check("and it is listed", summary.unpricedAssets.includes("Plazo fijo"));
  check("total value counts it at cost", near(summary.valueUsd, 3_000));
  check("unrealized only from priced positions", near(summary.unrealizedUsd, 1_000));
  check("weights add to 100", near(positions.reduce((s, p) => s + p.weight, 0), 100));
}

section("rendimiento mes a mes");
{
  const ops = [
    op("2026-01-15", "BTC", "buy", 1, 50_000),
    op("2026-03-02", "BTC", "sell", 0.5, 40_000),
  ];
  const closes: Record<string, number> = { "2026-01": 60_000, "2026-02": 70_000, "2026-03": 90_000 };
  const out = buildPerformance(ops, ["2026-01", "2026-02", "2026-03"], toUsd, (_k, m) => closes[m] ?? null);
  check("one row per month", out.length === 3);
  check("invested starts at the purchase", near(out[0].investedUsd, 50_000));
  check("value at the month close", near(out[0].valueUsd, 60_000));
  check("february revalues", near(out[1].valueUsd, 70_000));
  check("a sale lowers invested by its proceeds", near(out[2].investedUsd, 10_000));
  check("half a coin left at 90k", near(out[2].valueUsd, 45_000));
  const gap = buildPerformance(ops, ["2026-01", "2026-02"], toUsd, (_k, m) => (m === "2026-01" ? 60_000 : null));
  check("an unknown price carries the holding at cost", near(gap[1].valueUsd, 50_000));
  check("and flags the month", gap[1].atCost && !gap[0].atCost);
}

console.log(`\n${pass} ok, ${fail} failed`);
if (fail > 0) process.exit(1);
