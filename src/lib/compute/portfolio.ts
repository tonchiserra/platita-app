import "server-only";
import { cache } from "react";
import { getCryptoMonthlyCloses, getCryptoPriceMap } from "@/lib/api/crypto-prices";
import { getMarketMonthlyCloses, getMarketQuotes } from "@/lib/api/market";
import { getAssetPrices, getConverter, getInvestments, type InvestmentRow } from "@/lib/data";
import { assetKey, buildPerformance, buildPositions, type CurrentPrice, type Operation } from "@/lib/utils/portfolio";
import { currentMonthKey, endOfMonth, monthRange } from "@/lib/utils/format";

/**
 * The portfolio as the investments page shows it: every operation, live prices
 * from three sources (manual beats market beats nothing), positions and their
 * results in USD. Cached per request so the page's sections share it.
 */
export const getPortfolio = cache(async () => {
  const [ops, conv, manual] = await Promise.all([getInvestments(), getConverter(), getAssetPrices()]);
  const toUsd = (op: Operation) => conv.toUsd({ amount: op.total_amount, currency: op.currency, date: op.date });

  // One representative row per asset decides where to look its price up.
  const byKey = new Map<string, InvestmentRow>();
  for (const op of ops) if (!byKey.has(assetKey(op.asset))) byKey.set(assetKey(op.asset), op);
  const assets = [...byKey.values()];

  const cryptoNames = assets.filter((a) => a.asset_type === "crypto").map((a) => a.asset);
  const marketAssets = assets.filter((a) => a.asset_type !== "crypto").map((a) => ({ asset: a.asset, assetType: a.asset_type }));
  const [cryptoPrices, marketQuotes] = await Promise.all([getCryptoPriceMap(cryptoNames), getMarketQuotes(marketAssets)]);

  const prices: Record<string, CurrentPrice> = {};
  const quoteCurrency: Record<string, "ARS" | "USD"> = {};
  for (const [name, usd] of Object.entries(cryptoPrices)) prices[assetKey(name)] = { usd, source: "crypto" };
  for (const [name, q] of Object.entries(marketQuotes)) {
    const usd = q.currency === "USD" ? q.price : conv.fx.usdRate > 0 ? q.price / conv.fx.usdRate : 0;
    if (usd > 0) prices[assetKey(name)] = { usd, source: "market", change: q.change };
    quoteCurrency[assetKey(name)] = q.currency;
  }
  const manualByKey = new Map(manual.rows.map((r) => [assetKey(r.asset), r]));
  for (const [key, r] of manualByKey) {
    const usd = r.currency === "USD" ? r.price : conv.fx.usdRate > 0 ? r.price / conv.fx.usdRate : 0;
    if (usd > 0) prices[key] = { usd, source: "manual" };
  }

  const { positions, summary } = buildPositions(ops, toUsd, prices);
  return { ops, positions, summary, prices, quoteCurrency, manualByKey, manualAvailable: manual.available, conv, assets };
});

export interface PerformanceSeries {
  months: string[];
  invested: { ars: number[]; usd: number[] };
  value: { ars: number[]; usd: number[] };
  atCost: boolean[];
}

/**
 * Monthly invested capital against market value. Month-end closes come from
 * Binance (crypto) and data912 (the Argentine market); a month without a
 * price carries the holding at cost. Pesos: invested is nominal, value is the
 * dollar value at that month's blue.
 */
export const getPerformance = cache(async (): Promise<PerformanceSeries | null> => {
  const { ops, prices, quoteCurrency, manualByKey, conv, assets } = await getPortfolio();
  if (ops.length === 0) return null;
  const current = currentMonthKey();
  const first = ops.reduce((min, op) => (op.date < min ? op.date : min), ops[0].date).slice(0, 7);
  const months = monthRange(first, current);

  const closes = new Map<string, Map<string, number> | null>();
  await Promise.all(
    assets.map(async (a) => {
      const key = assetKey(a.asset);
      if (manualByKey.has(key)) return closes.set(key, null);
      if (a.asset_type === "crypto") return closes.set(key, await getCryptoMonthlyCloses(a.asset));
      const raw = await getMarketMonthlyCloses(a.asset, a.asset_type, first);
      if (!raw) return closes.set(key, null);
      // data912 history is in the ticker's own currency: pesos for base tickers.
      const dollarTicker = quoteCurrency[key] === "USD";
      const usd = new Map<string, number>();
      for (const [m, c] of raw) {
        const rate = conv.blue(endOfMonth(m));
        usd.set(m, dollarTicker ? c : rate > 0 ? c / rate : 0);
      }
      closes.set(key, usd);
    })
  );

  const priceUsdAt = (key: string, month: string): number | null => {
    if (month === current && prices[key]) return prices[key].usd;
    const series = closes.get(key);
    if (!series) return null;
    const own = series.get(month);
    if (own) return own;
    // Carry the latest earlier close across a gap in the history.
    let best: string | null = null;
    for (const m of series.keys()) if (m <= month && (!best || m > best)) best = m;
    return best ? series.get(best)! : null;
  };

  const toUsd = (op: Operation) => conv.toUsd({ amount: op.total_amount, currency: op.currency, date: op.date });
  const toArs = (op: Operation) => conv.toArs({ amount: op.total_amount, currency: op.currency, date: op.date });
  const usd = buildPerformance(ops, months, toUsd, priceUsdAt);
  const ars = buildPerformance(ops, months, toArs, (key, month) => {
    const p = priceUsdAt(key, month);
    return p === null ? null : p * conv.blue(endOfMonth(month));
  });

  return {
    months,
    invested: { usd: usd.map((p) => p.investedUsd), ars: ars.map((p) => p.investedUsd) },
    value: { usd: usd.map((p) => p.valueUsd), ars: ars.map((p) => p.valueUsd) },
    atCost: usd.map((p) => p.atCost),
  };
});
