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
