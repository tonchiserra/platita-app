import type { ExchangeRates } from "@/types/database";

export function convertToArs(
  amount: number,
  currency: string,
  rates: ExchangeRates
): number {
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
