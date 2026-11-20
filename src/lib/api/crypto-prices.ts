/**
 * Crypto prices in USD.
 *
 * Binance's public market-data host (`data-api.binance.vision`) is the main
 * source: any `<ASSET>USDT` pair resolves with no ticker map, and its monthly
 * candles go back years, where CoinGecko's free tier stops at 365 days.
 * CoinGecko stays as the fallback for the headline BTC/ETH quotes.
 */

const BINANCE = "https://data-api.binance.vision/api/v3";

export const STABLECOINS: ReadonlySet<string> = new Set(["USDT", "USDC", "DAI", "BUSD", "FDUSD", "TUSD", "USDP"]);

/** User-typed names that are not tickers. */
const NAME_TO_TICKER: Record<string, string> = {
  BITCOIN: "BTC",
  ETHEREUM: "ETH",
  ETHER: "ETH",
  SOLANA: "SOL",
  CARDANO: "ADA",
  POLKADOT: "DOT",
  AVALANCHE: "AVAX",
  CHAINLINK: "LINK",
  POLYGON: "POL",
  MATIC: "POL",
  RIPPLE: "XRP",
  DOGECOIN: "DOGE",
  LITECOIN: "LTC",
  TETHER: "USDT",
};

/** `"Bitcoin"`, `" btc "` → `"BTC"`. */
export function cryptoTicker(asset: string): string {
  const key = asset.trim().toUpperCase();
  return NAME_TO_TICKER[key] ?? key;
}

export interface CryptoQuote {
  usd: number;
  /** Unix seconds. */
  last_updated_at: number;
  /** 24 h change, percent. */
  change24h?: number;
}

export interface CryptoPrices {
  bitcoin: CryptoQuote | null;
  ethereum: CryptoQuote | null;
}

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  closeTime: number;
}

async function binance24h(symbols: string[]): Promise<BinanceTicker24h[] | null> {
  try {
    const url = `${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as BinanceTicker24h[];
  } catch {
    return null;
  }
}

/** The two quotes the cotizaciones panel and the patrimony maths need. */
export async function getCryptoPrices(): Promise<CryptoPrices | null> {
  const tickers = await binance24h(["BTCUSDT", "ETHUSDT"]);
  if (tickers && tickers.length > 0) {
    const pick = (symbol: string): CryptoQuote | null => {
      const t = tickers.find((x) => x.symbol === symbol);
      return t
        ? {
            usd: Number(t.lastPrice),
            last_updated_at: Math.floor(t.closeTime / 1000),
            change24h: Number(t.priceChangePercent),
          }
        : null;
    };
    return { bitcoin: pick("BTCUSDT"), ethereum: pick("ETHUSDT") };
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd: number; last_updated_at: number }>;
    return { bitcoin: data.bitcoin ?? null, ethereum: data.ethereum ?? null };
  } catch {
    return null;
  }
}

/**
 * Current USD price for each asset name the user typed. Unknown pairs are
 * simply missing from the result, which the UI shows as "Sin precio".
 */
export async function getCryptoPriceMap(assets: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const pairs = new Map<string, string[]>();
  for (const asset of assets) {
    const ticker = cryptoTicker(asset);
    if (STABLECOINS.has(ticker)) {
      out[asset] = 1;
      continue;
    }
    const symbol = `${ticker}USDT`;
    pairs.set(symbol, [...(pairs.get(symbol) ?? []), asset]);
  }
  if (pairs.size === 0) return out;

  // One bad symbol fails the whole batch on Binance, so a failed batch falls
  // back to one request per symbol.
  let tickers = await binance24h([...pairs.keys()]);
  if (!tickers) {
    const singles = await Promise.all([...pairs.keys()].map((symbol) => binance24h([symbol])));
    tickers = singles.flatMap((t) => t ?? []);
  }
  for (const t of tickers) {
    for (const asset of pairs.get(t.symbol) ?? []) out[asset] = Number(t.lastPrice);
  }
  return out;
}

/**
 * Month-end closes for one asset, keyed `YYYY-MM`, in USD. Null when the pair
 * does not exist on Binance.
 */
export async function getCryptoMonthlyCloses(asset: string): Promise<Map<string, number> | null> {
  const ticker = cryptoTicker(asset);
  if (STABLECOINS.has(ticker)) return new Map();
  try {
    const res = await fetch(`${BINANCE}/klines?symbol=${ticker}USDT&interval=1M&limit=120`, {
      next: { revalidate: 43200 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as [number, string, string, string, string][];
    const closes = new Map<string, number>();
    for (const row of rows) {
      const month = new Date(row[0]).toISOString().slice(0, 7);
      closes.set(month, Number(row[4]));
    }
    return closes;
  } catch {
    return null;
  }
}
