/**
 * Argentine market quotes from data912 (free, keyless): CEDEARs, local
 * stocks, sovereign bonds, letras and corporate bonds, live and daily history.
 *
 * Conventions of the feed, verified against the live endpoints:
 * - Base tickers quote in ARS. A `D` suffix (AL30D) is the same instrument in
 *   MEP dollars and a `C` suffix in CCL dollars.
 * - Fixed income quotes per 100 of face value, so a holding of `units` face
 *   value is worth `units × price / 100`.
 */

const BASE = "https://data912.com";

interface LiveRow {
  symbol: string;
  c: number;
  px_bid: number;
  px_ask: number;
  pct_change: number;
}

type Panel = "arg_cedears" | "arg_stocks" | "arg_bonds" | "arg_notes" | "arg_corp";
type HistoryPanel = "cedears" | "stocks" | "bonds";

const FIXED_INCOME: ReadonlySet<Panel> = new Set(["arg_bonds", "arg_notes", "arg_corp"]);

async function getPanel(panel: Panel): Promise<LiveRow[] | null> {
  try {
    const res = await fetch(`${BASE}/live/${panel}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const rows = (await res.json()) as LiveRow[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

function lastPrice(row: LiveRow): number | null {
  if (row.c > 0) return row.c;
  if (row.px_bid > 0 && row.px_ask > 0) return (row.px_bid + row.px_ask) / 2;
  return null;
}

export interface MarketQuote {
  /** Price of one unit the user holds (already divided by 100 for fixed income). */
  price: number;
  currency: "ARS" | "USD";
  /** Day change, percent. */
  change: number | null;
  source: "data912";
}

/** Which panels can hold an asset of this type, most likely first. */
function panelsFor(assetType: string): Panel[] {
  switch (assetType) {
    case "cedear":
      return ["arg_cedears", "arg_stocks"];
    case "stock":
      return ["arg_stocks", "arg_cedears"];
    case "bond":
      return ["arg_bonds", "arg_notes", "arg_corp"];
    default:
      return ["arg_cedears", "arg_stocks", "arg_bonds", "arg_notes", "arg_corp"];
  }
}

export function marketTicker(asset: string): string {
  return asset.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Quotes for the assets the user holds. `assets` maps each typed name to its
 * asset type. Names no panel knows are missing from the result.
 */
export async function getMarketQuotes(
  assets: { asset: string; assetType: string }[]
): Promise<Record<string, MarketQuote>> {
  if (assets.length === 0) return {};
  const needed = new Set<Panel>(assets.flatMap((a) => panelsFor(a.assetType)));
  const loaded = new Map<Panel, Map<string, LiveRow>>();
  await Promise.all(
    [...needed].map(async (panel) => {
      const rows = await getPanel(panel);
      if (rows) loaded.set(panel, new Map(rows.map((r) => [r.symbol.toUpperCase(), r])));
    })
  );

  const out: Record<string, MarketQuote> = {};
  for (const { asset, assetType } of assets) {
    const ticker = marketTicker(asset);
    for (const panel of panelsFor(assetType)) {
      const rows = loaded.get(panel);
      const row = rows?.get(ticker);
      if (!row) continue;
      const price = lastPrice(row);
      if (price === null) continue;
      const base = ticker.slice(0, -1);
      const dollarSuffix = (ticker.endsWith("D") || ticker.endsWith("C")) && rows!.has(base);
      out[asset] = {
        price: FIXED_INCOME.has(panel) ? price / 100 : price,
        currency: dollarSuffix ? "USD" : "ARS",
        change: Number.isFinite(row.pct_change) ? row.pct_change : null,
        source: "data912",
      };
      break;
    }
  }
  return out;
}

interface HistoryRow {
  date: string;
  c: number;
}

function historyPanelsFor(assetType: string): HistoryPanel[] {
  switch (assetType) {
    case "cedear":
      return ["cedears", "stocks"];
    case "stock":
      return ["stocks", "cedears"];
    case "bond":
      return ["bonds"];
    default:
      return ["cedears", "stocks", "bonds"];
  }
}

/**
 * Last close of each month, keyed `YYYY-MM`, in the instrument's own quote
 * currency and already scaled to one unit. Null when no history exists.
 */
export async function getMarketMonthlyCloses(
  asset: string,
  assetType: string,
  fromMonth: string
): Promise<Map<string, number> | null> {
  const ticker = marketTicker(asset);
  for (const panel of historyPanelsFor(assetType)) {
    try {
      const res = await fetch(`${BASE}/historical/${panel}/${encodeURIComponent(ticker)}`, {
        next: { revalidate: 43200 },
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as HistoryRow[];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const scale = panel === "bonds" ? 1 / 100 : 1;
      const closes = new Map<string, number>();
      for (const row of rows) {
        const month = row.date.slice(0, 7);
        if (month < fromMonth || !(row.c > 0)) continue;
        // Rows are chronological, so the last write per month is its close.
        closes.set(month, row.c * scale);
      }
      return closes;
    } catch {
      continue;
    }
  }
  return null;
}
