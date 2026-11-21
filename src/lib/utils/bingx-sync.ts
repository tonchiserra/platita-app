import { createHmac } from "node:crypto";
import { todayKey } from "./format";

/**
 * The pure half of the BingX sync: the canonical query, the sync windows, the
 * mapping from a closed position to a row of the trading book, and the match
 * against operations already typed by hand.
 *
 * Every rule here was checked against the live API with a read-only key
 * (2026-11-21), not only against the docs. The docs were wrong once: v2
 * `positionHistory` asks for trading permission, so this uses v1. See
 * docs/plans/2026-11-21-sincronizacion-bingx-design.md.
 */

export const BINGX_BASE = "https://open-api.bingx.com";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** A sync re-reads the last hour, in case BingX registers a close late. The unique index absorbs the repeats. */
export const OVERLAP_MS = 60 * MINUTE;
/** `positionHistory` rejects ranges over 90 days (`109400`). */
export const MAX_SPAN_MS = 89 * DAY;
/**
 * How far back "todas las operaciones" starts. BingX kept about six months of
 * positions on the test account, so a year covers all of it.
 */
export const BACKFILL_MS = 365 * DAY;
/** Income (the source of the pairs) is kept for three months only. */
export const INCOME_RETENTION_MS = 89 * DAY;

/* ---------- Wire types (numbers arrive as strings) ---------- */

/** One row of `GET /openApi/swap/v1/trade/positionHistory`. */
export interface BingxPosition {
  positionId: string;
  symbol: string;
  /** `LONG` / `SHORT` in hedge mode. One-way mode is unverified. */
  positionSide: string;
  openTime: number;
  /** When the position closed. The range filter runs on this field. */
  updateTime: number;
  avgPrice: string;
  /** In coin units (`0.0158` BTC), not contracts. */
  positionAmt: string;
  closePositionAmt?: string;
  leverage: number | string;
  closeAllPositions: boolean;
  /** Realised PnL plus commission plus funding. What the balance actually moved. */
  netProfit: string;
  realisedProfit?: string;
  positionCommission?: string;
  totalFunding?: string;
}

/** One row of `GET /openApi/swap/v2/user/income`. */
export interface BingxIncome {
  symbol: string;
  incomeType: string;
  income: string;
  time: number;
}

/* ---------- Query and signature ---------- */

/**
 * BingX signs the parameters, not the path: sorted by key in ASCII order and
 * joined unencoded (`payload`). Values are URL-encoded only in the URL
 * (`encoded`).
 */
export function buildQuery(params: Record<string, string | number>): { payload: string; encoded: string } {
  const keys = Object.keys(params).sort();
  return {
    payload: keys.map((k) => `${k}=${params[k]}`).join("&"),
    encoded: keys.map((k) => `${k}=${encodeURIComponent(String(params[k]))}`).join("&"),
  };
}

/** HMAC-SHA256 in lowercase hex. The same function Postgres runs in `bingx_sign`. */
export function hmacHex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** The full signed query string, for a secret in hand. */
export function signQuery(params: Record<string, string | number>, secret: string): string {
  const { payload, encoded } = buildQuery(params);
  return `${encoded}&signature=${hmacHex(payload, secret)}`;
}

/* ---------- Windows ---------- */

export interface SyncWindow {
  /** Milliseconds, inclusive. */
  from: number;
  to: number;
}

/**
 * What one sync covers, from `importFrom` (or from the cursor minus the
 * overlap) to now, split into windows the API accepts, oldest first.
 *
 * A normal sync is a single window. The first sync of "todas las operaciones"
 * and a sync after months without opening the app are several.
 */
export function syncWindows({ importFrom, syncedUntil, now }: { importFrom: number; syncedUntil: number | null; now: number }): {
  span: SyncWindow;
  windows: SyncWindow[];
} {
  const start = syncedUntil === null ? importFrom : Math.max(importFrom, syncedUntil - OVERLAP_MS);
  const from = Math.max(start, now - BACKFILL_MS);
  const windows: SyncWindow[] = [];
  for (let to = now; to > from; to -= MAX_SPAN_MS) windows.unshift({ from: Math.max(from, to - MAX_SPAN_MS), to });
  return { span: { from, to: now }, windows };
}

/** The income range that names the pairs: the span, cut to what BingX keeps. */
export function incomeWindow(span: SyncWindow): SyncWindow {
  return { from: Math.max(span.from, span.to - INCOME_RETENTION_MS), to: span.to };
}

/**
 * The pairs that moved.
 *
 * Read from every income type, not only `REALIZED_PNL`: a liquidated position
 * leaves an `INSURANCE_CLEAR` row instead. A filter on PnL would never look up
 * a pair whose only operation was liquidated.
 */
export function symbolsFromIncome(rows: readonly BingxIncome[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    if (/^[A-Z0-9]+-[A-Z]+$/.test(symbol)) set.add(symbol);
  }
  return [...set].sort();
}

/* ---------- Position → trade ---------- */

/** A row of `trades` without `user_id`, which the route stamps. */
export interface ImportedTrade {
  date: string;
  asset: string;
  direction: "long" | "short";
  pnl_usd: number;
  pnl_pct: number | null;
  leverage: number | null;
  platform_id: string | null;
  notes: null;
  source: "bingx";
  external_id: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function directionOf(p: BingxPosition): "long" | "short" {
  const side = String(p.positionSide ?? "").toUpperCase();
  if (side === "LONG") return "long";
  if (side === "SHORT") return "short";
  // One-way mode (unverified): the sign of the amount is the only hint left.
  return Number(p.positionAmt) < 0 ? "short" : "long";
}

/**
 * The trade for a closed position, or `null` when it doesn't belong in the book:
 * still partly open (it comes in whole once fully closed), closed outside the
 * span or before `importFrom`, or a net result that rounds to zero (the table's
 * check rejects zero).
 *
 * Every amount is net: BingX's `netProfit` already carries commission and
 * funding. The margin percentage is the net over the initial margin,
 * `avgPrice × amount ÷ leverage` (amounts are in coin units, verified live).
 */
export function positionToTrade(
  p: BingxPosition,
  ctx: { span: SyncWindow; importFrom: number; platformId: string | null }
): ImportedTrade | null {
  if (p.closeAllPositions !== true) return null;
  const closedAt = Number(p.updateTime);
  if (!Number.isFinite(closedAt) || closedAt < ctx.span.from || closedAt > ctx.span.to || closedAt < ctx.importFrom) return null;

  const net = Number(p.netProfit);
  const pnl = round2(net);
  if (!Number.isFinite(pnl) || pnl === 0) return null;

  const leverage = Number(p.leverage);
  const amount = Math.abs(Number(p.closePositionAmt ?? p.positionAmt));
  const margin = leverage > 0 ? (Number(p.avgPrice) * amount) / leverage : NaN;

  return {
    date: todayKey(new Date(closedAt)),
    asset: String(p.symbol).split("-")[0].toUpperCase(),
    direction: directionOf(p),
    pnl_usd: pnl,
    pnl_pct: margin > 0 ? round2((net / margin) * 100) : null,
    leverage: leverage > 0 ? leverage : null,
    platform_id: ctx.platformId,
    notes: null,
    source: "bingx",
    external_id: String(p.positionId),
  };
}

/* ---------- Operations already typed by hand ---------- */

export interface ManualTradeLike {
  date: string;
  asset: string;
  direction: string;
  pnl_usd: number | string;
}

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

/**
 * Splits the imported trades into the new ones and those already in the book
 * by hand, so importing never doubles an operation.
 *
 * A manual row matches when it has the same market and direction, a date at
 * most one day apart, and a result within US$ 0,05 or 1 %. Each manual row
 * matches one position at most, the closest result first.
 *
 * Calibrated on the real book (2026-11-21): the 28 BingX positions of the last
 * 89 days all had their manual twin. The largest gap was US$ 0,07 on a
 * −US$ 1.849,93 loss, and two were typed on the next day.
 */
export function dropManualDuplicates(
  imported: readonly ImportedTrade[],
  manual: readonly ManualTradeLike[]
): { fresh: ImportedTrade[]; duplicates: ImportedTrade[] } {
  const candidates: { i: number; m: number; gap: number }[] = [];
  imported.forEach((t, i) => {
    manual.forEach((row, m) => {
      if (row.asset.trim().toUpperCase() !== t.asset || row.direction !== t.direction) return;
      if (dayDiff(row.date, t.date) > 1) return;
      const gap = Math.abs(Number(row.pnl_usd) - t.pnl_usd);
      if (gap <= Math.max(0.05, Math.abs(t.pnl_usd) * 0.01)) candidates.push({ i, m, gap });
    });
  });
  candidates.sort((a, b) => a.gap - b.gap);

  const takenImported = new Set<number>();
  const takenManual = new Set<number>();
  for (const c of candidates) {
    if (takenImported.has(c.i) || takenManual.has(c.m)) continue;
    takenImported.add(c.i);
    takenManual.add(c.m);
  }
  return {
    fresh: imported.filter((_, i) => !takenImported.has(i)),
    duplicates: imported.filter((_, i) => takenImported.has(i)),
  };
}

/* ---------- Errors and permissions ---------- */

/**
 * BingX's error codes in words a person can act on. Verified live: a wrong key
 * is `100413`, a wrong secret `100001`, a missing permission `100004`. The rest
 * come from the official error-code reference.
 */
export function explainBingxError(code: number | undefined, msg: string | undefined): string {
  switch (code) {
    case 100413:
      return "BingX no reconoce esa API Key. Revisá que la copiaste completa.";
    case 100001:
    case 100412:
      return "La Secret Key no coincide con la API Key. Revisá que la copiaste completa.";
    case 100004:
      return "La key no tiene permiso para leer los futuros. Creala con permiso de lectura.";
    case 100419:
      return "La key solo acepta ciertas IPs y Platita no tiene IP fija. Creala sin restricción de IP.";
    case 100421:
      return "BingX rechazó la hora del pedido. Probá de nuevo en un momento.";
    case 100410:
    case 109403:
      return "BingX está limitando los pedidos. Probá de nuevo en unos minutos.";
    default:
      return `BingX respondió con un error${code ? ` (${code})` : ""}${msg ? `: ${msg}` : "."}`;
  }
}

/**
 * Permissions a key may carry to be stored here: read only. BingX's list is 1
 * spot trading, 2 read, 3 futures trading, 4 universal transfer, 5 withdraw,
 * 7 sub-account transfer.
 */
export function isReadOnly(permissions: readonly number[]): boolean {
  return permissions.length > 0 && permissions.every((p) => Number(p) === 2);
}

/** BingX sends `[]` or `[""]` for a key with no IP whitelist. */
export function hasIpWhitelist(ipAddresses: readonly string[] | null | undefined): boolean {
  return (ipAddresses ?? []).some((ip) => String(ip).trim() !== "");
}
