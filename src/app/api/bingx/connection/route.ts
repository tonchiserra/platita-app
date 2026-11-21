import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { BingxError, getApiPermissions, localSigner } from "@/lib/api/bingx";
import { BACKFILL_MS, hasIpWhitelist, isReadOnly } from "@/lib/utils/bingx-sync";

/**
 * Saves the user's BingX key. Each user does it from Ajustes, with nothing to
 * configure on the server: the secret goes into Supabase Vault through
 * `bingx_save_key`, with the user's own session.
 *
 * Before saving, the key is tried against BingX (signed here, with the secret
 * still in the request). It is refused unless it is read-only with no IP
 * whitelist, because Vercel functions have no fixed IP.
 *
 * Body: `{ apiKey, apiSecret, platformId, importFrom: "now" | "all", accepted: true }`.
 * `importFrom` and `accepted` are asked on a new connection only. Replacing
 * the key keeps where imports started.
 */

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return fail("Tu sesión expiró. Volvé a iniciar sesión.", 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Pedido inválido.", 400);
  }
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiSecret = typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
  const platformId = typeof body.platformId === "string" && body.platformId ? body.platformId : null;
  if (!apiKey || !apiSecret) return fail("Completá la API Key y la Secret Key.", 400);
  if (apiKey.length > 256 || apiSecret.length > 256 || /\s/.test(apiKey + apiSecret)) return fail("La key tiene un formato inválido.", 400);
  if (body.accepted !== true) return fail("Confirmá que la key es de solo lectura.", 400);

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("exchange_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("exchange", "bingx")
    .maybeSingle();
  if (readError) return fail(dbError(readError), 500);

  let importFrom: string | null = null;
  if (!existing) {
    if (body.importFrom !== "now" && body.importFrom !== "all") return fail("Elegí qué operaciones sincronizar.", 400);
    importFrom = new Date(body.importFrom === "all" ? Date.now() - BACKFILL_MS : Date.now()).toISOString();
  }

  let access: Awaited<ReturnType<typeof getApiPermissions>>;
  try {
    access = await getApiPermissions({ apiKey, sign: localSigner(apiSecret) });
  } catch (e) {
    if (e instanceof BingxError) return fail(e.message, 400);
    throw e;
  }
  if (!isReadOnly(access.permissions))
    return fail("Esta key tiene permisos de más (operar, transferir o retirar). Creá una de SOLO LECTURA.", 400);
  if (hasIpWhitelist(access.ipAddresses))
    return fail("La key solo acepta ciertas IPs y Platita no tiene IP fija. Creala sin restricción de IP.", 400);

  const { error } = await supabase.rpc("bingx_save_key", {
    p_api_key: apiKey,
    p_api_secret: apiSecret,
    p_platform_id: platformId,
    p_import_from: importFrom,
  });
  if (error) return fail(dbError(error), error.code === "22023" ? 400 : 500);

  return NextResponse.json({ ok: true });
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01")
    return "Falta aplicar una migración de la base de datos (005 y 006).";
  if (error.code === "22023") return error.message === "unknown platform" ? "Esa plataforma no existe." : "La key tiene un formato inválido.";
  return `No se pudo guardar la conexión: ${error.message}`;
}
