export const CURRENCIES = ["ARS", "USD", "EUR", "BTC", "ETH"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const FIAT_CURRENCIES = ["ARS", "USD", "EUR"] as const;
export const CRYPTO_CURRENCIES = ["BTC", "ETH"] as const;

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: "$",
  USD: "US$",
  EUR: "€",
  BTC: "₿",
  ETH: "Ξ",
};

export const PLATFORM_TYPES = [
  "bank",
  "crypto_exchange",
  "investment_broker",
  "cash",
  "other",
] as const;

export type PlatformType = (typeof PLATFORM_TYPES)[number];

export const PLATFORM_TYPE_LABELS: Record<PlatformType, string> = {
  bank: "Banco",
  crypto_exchange: "Exchange Crypto",
  investment_broker: "Broker de Inversiones",
  cash: "Efectivo",
  other: "Otro",
};

export const ASSET_TYPES = [
  "crypto",
  "stock",
  "bond",
  "cedear",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
