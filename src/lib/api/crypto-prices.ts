export interface CryptoPrices {
  bitcoin: { usd: number; last_updated_at: number };
  ethereum: { usd: number; last_updated_at: number };
}

export async function getCryptoPrices(): Promise<CryptoPrices | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true",
      { next: { revalidate: 300 } } // cache 5 minutes
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Maps common ticker symbols and names to CoinGecko IDs
const COINGECKO_MAP: Record<string, string> = {
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  ADA: "cardano",
  CARDANO: "cardano",
  DOT: "polkadot",
  POLKADOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  POL: "matic-network",
  UNI: "uniswap",
  XRP: "ripple",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BNB: "binancecoin",
  USDT: "tether",
  USDC: "usd-coin",
  ATOM: "cosmos",
  NEAR: "near",
  ARB: "arbitrum",
  OP: "optimism",
  APT: "aptos",
  SUI: "sui",
};

/**
 * Fetches current USD prices for a list of user-provided asset names.
 * Normalizes tickers/names (e.g. "Bitcoin", "btc", "BTC" all resolve to bitcoin).
 * Returns a map of original asset name → USD price.
 */
export async function getCryptoPriceMap(
  assets: string[]
): Promise<Record<string, number>> {
  // Map each asset to its CoinGecko ID
  const assetToId: [string, string][] = [];
  for (const asset of assets) {
    const id = COINGECKO_MAP[asset.toUpperCase()];
    if (id) assetToId.push([asset, id]);
  }

  const uniqueIds = [...new Set(assetToId.map(([, id]) => id))];
  if (uniqueIds.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(",")}&vs_currencies=usd`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return {};
    const data = await res.json();

    const prices: Record<string, number> = {};
    for (const [asset, id] of assetToId) {
      if (data[id]?.usd) prices[asset] = data[id].usd;
    }
    return prices;
  } catch {
    return {};
  }
}
