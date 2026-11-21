import "server-only";
import {
  BINGX_BASE,
  buildQuery,
  explainBingxError,
  hmacHex,
  type BingxIncome,
  type BingxPosition,
  type SyncWindow,
} from "@/lib/utils/bingx-sync";

/**
 * Signed, read-only calls to BingX's perpetual futures API. Only the routes
 * under /api/bingx call this.
 *
 * The signature comes from a `Signer`:
 * - `localSigner` while connecting, when the secret is still in the request;
 * - `vaultSigner` when syncing. Postgres signs with the secret it keeps in
 *   Vault, so the secret never leaves the database.
 *
 * BingX answers HTTP 200 with a `code` on almost every error, so success is
 * `code === 0`. `apiPermissions` is the odd one out: on success it sends the
 * object bare, with no `code` at all (verified live).
 */

export type Signer = (payload: string) => Promise<string>;

export interface BingxCredentials {
  apiKey: string;
  sign: Signer;
}

/** An error already worded for the user, in Spanish. */
export class BingxError extends Error {
  constructor(
    message: string,
    readonly code?: number | string
  ) {
    super(message);
  }
}

export function localSigner(secret: string): Signer {
  return async (payload) => hmacHex(payload, secret);
}

interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
}

/** Signs through `bingx_sign`, with the user's session: it can only sign for its own key. */
export function vaultSigner(supabase: RpcClient): Signer {
  return async (payload) => {
    const { data, error } = await supabase.rpc("bingx_sign", { p_payload: payload });
    if (error) {
      if (error.code === "P0002") throw new BingxError("No hay una key guardada. Volvé a conectarla en Ajustes.", error.code);
      if (error.code === "PGRST202") throw new BingxError("Falta aplicar la migración 006 de la base de datos.", error.code);
      throw new BingxError(`No se pudo firmar el pedido: ${error.message}`, error.code);
    }
    return String(data);
  };
}

/** 5 requests per second per UID on the history endpoints; 250 ms keeps under it. */
const PACE_MS = 250;
const TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signedGet(path: string, params: Record<string, string | number>, creds: BingxCredentials): Promise<unknown> {
  const { payload, encoded } = buildQuery({ ...params, timestamp: Date.now() });
  const signature = await creds.sign(payload);
  let res: Response;
  try {
    res = await fetch(`${BINGX_BASE}${path}?${encoded}&signature=${signature}`, {
      headers: { "X-BX-APIKEY": creds.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new BingxError("No se pudo conectar con BingX. Probá de nuevo en un rato.");
  }
  if (res.status === 429 || res.status === 418) throw new BingxError(explainBingxError(100410, undefined), 100410);

  let body: { code?: number; msg?: string; data?: unknown } & Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new BingxError(`BingX respondió algo inesperado (HTTP ${res.status}).`);
  }
  if (body.code === undefined) {
    if (!res.ok) throw new BingxError(`BingX respondió con un error (HTTP ${res.status}).`);
    return body;
  }
  if (body.code !== 0) throw new BingxError(explainBingxError(body.code, body.msg), body.code);
  return body.data;
}

/** The key's permissions and IP whitelist. Only ever signed locally, while connecting. */
export async function getApiPermissions(creds: BingxCredentials): Promise<{ permissions: number[]; ipAddresses: string[] }> {
  const data = (await signedGet("/openApi/v1/account/apiPermissions", {}, creds)) as {
    permissions?: number[];
    ipAddresses?: string[];
  };
  return { permissions: data.permissions ?? [], ipAddresses: data.ipAddresses ?? [] };
}

/**
 * Every income row in the window, any type. Newest first, at most 1000 per
 * call, so a full page moves `endTime` back to its oldest row and asks again.
 * The overlap at the seam only repeats rows, and only the symbols are used.
 */
export async function getIncome(creds: BingxCredentials, window: SyncWindow): Promise<BingxIncome[]> {
  const rows: BingxIncome[] = [];
  let endTime = window.to;
  for (let page = 0; page < 20; page++) {
    if (page > 0) await sleep(PACE_MS);
    const data = ((await signedGet("/openApi/swap/v2/user/income", { startTime: window.from, endTime, limit: 1000 }, creds)) ??
      []) as BingxIncome[];
    rows.push(...data);
    if (data.length < 1000) break;
    const oldest = Math.min(...data.map((r) => Number(r.time)));
    if (!(oldest > window.from) || oldest >= endTime) break;
    endTime = oldest;
  }
  return rows;
}

/**
 * Positions of one pair that closed in the window. v1, because v2 asks for
 * trading permission even though the docs say read. Pages start at 0 and come
 * newest first. The page size is capped at 100.
 */
export async function getClosedPositions(creds: BingxCredentials, symbol: string, window: SyncWindow): Promise<BingxPosition[]> {
  const rows: BingxPosition[] = [];
  const pageSize = 100;
  for (let pageIndex = 0; pageIndex < 50; pageIndex++) {
    if (pageIndex > 0) await sleep(PACE_MS);
    const data = (await signedGet(
      "/openApi/swap/v1/trade/positionHistory",
      { symbol, startTs: window.from, endTs: window.to, pageIndex, pageSize },
      creds
    )) as { positionHistory?: BingxPosition[] } | null;
    const page = data?.positionHistory ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/**
 * Every closed position in the windows, for the pairs the income names.
 *
 * Income only goes back three months. A pair last traded before that is
 * unknown, so its older positions can't be asked for: no endpoint lists pairs
 * further back (`allFillOrders` keeps three months too, verified live).
 */
export async function getClosedPositionsIn(
  creds: BingxCredentials,
  { income, windows }: { income: SyncWindow; windows: SyncWindow[] },
  symbolsOf: (income: BingxIncome[]) => string[]
): Promise<BingxPosition[]> {
  const symbols = symbolsOf(await getIncome(creds, income));
  const positions: BingxPosition[] = [];
  for (const symbol of symbols) {
    for (const window of windows) {
      await sleep(PACE_MS);
      positions.push(...(await getClosedPositions(creds, symbol, window)));
    }
  }
  return positions;
}
