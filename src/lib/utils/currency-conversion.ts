import type { ExchangeRates } from "@/types/database";

/**
 * Today's rates: blue for USD and EUR, USD prices for crypto. Crypto converts
 * through the dollar: `units × usdPrice × usdRate`.
 */
export function convertToArs(amount: number, currency: string, rates: ExchangeRates): number {
  switch (currency) {
    case "ARS":
      return amount;
    case "USD":
      return amount * rates.usdRate;
    case "EUR":
      return amount * rates.eurRate;
    case "BTC":
      return amount * rates.btcUsd * rates.usdRate;
    case "ETH":
      return amount * rates.ethUsd * rates.usdRate;
    default:
      return amount;
  }
}

export function convertToUsd(amount: number, currency: string, rates: ExchangeRates): number {
  switch (currency) {
    case "USD":
      return amount;
    case "ARS":
      return rates.usdRate > 0 ? amount / rates.usdRate : 0;
    case "EUR":
      return rates.usdRate > 0 ? (amount * rates.eurRate) / rates.usdRate : 0;
    case "BTC":
      return amount * rates.btcUsd;
    case "ETH":
      return amount * rates.ethUsd;
    default:
      return 0;
  }
}

export interface DatedAmount {
  amount: number | string;
  currency: string;
  date: string;
}

/**
 * Converts a movement at the rate of **its own date** — the blue of that day
 * for pesos and dollars. EUR and crypto have no history here, so they cross
 * through today's price into dollars and then take the day's blue.
 *
 * Without a blue history every conversion falls back to today's rates.
 */
export function makeHistoricalConverter(rates: ExchangeRates, blueOn: ((date: string) => number | undefined) | null) {
  const blue = (date: string) => blueOn?.(date) || rates.usdRate;

  const toUsd = (row: DatedAmount): number => {
    const amount = Number(row.amount);
    if (row.currency === "ARS") {
      const rate = blue(row.date);
      return rate > 0 ? amount / rate : 0;
    }
    return convertToUsd(amount, row.currency, rates);
  };

  const toArs = (row: DatedAmount): number => {
    const amount = Number(row.amount);
    if (row.currency === "ARS") return amount;
    return toUsd(row) * blue(row.date);
  };

  return { toArs, toUsd, blue };
}

export type HistoricalConverter = ReturnType<typeof makeHistoricalConverter>;
