import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { BingxError, getClosedPositionsIn, vaultSigner } from "@/lib/api/bingx";
import {
  dropManualDuplicates,
  incomeWindow,
  positionToTrade,
  symbolsFromIncome,
  syncWindows,
  type ImportedTrade,
} from "@/lib/utils/bingx-sync";
import { todayKey } from "@/lib/utils/format";

/**
 * Brings the positions closed on BingX since the last sync into the trading
 * book. It runs with the user's own session: RLS authorizes every read and
 * write, as it does for the rest of the app. Postgres signs each request with
 * the secret it keeps in Vault (`bingx_sign`), so this route never sees it.
 * There is no cron, no service role key and no server variable.
 *
 * Called by `BingxAutoSync` when the app opens or comes back to the
 * foreground, and by the «Sincronizar» button (`force`).
 *
 * Responses: `{ connected: false }`, `{ skipped: true }`,
 * `{ inserted, duplicates }` or `{ error }` with a status. `duplicates` counts
 * positions left out because the user had already typed them by hand.
 */

/** Without `force`, a second request inside this span is answered without calling BingX. */
const MIN_INTERVAL_MS = 60_000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return fail("Tu sesión expiró. Volvé a iniciar sesión.", 401);

  let force = false;
  try {
    force = (await request.json())?.force === true;
  } catch {
    // An empty body is an automatic sync.
  }

  const supabase = await createClient();
  const { data: conn, error: readError } = await supabase
    .from("exchange_connections")
    .select("id, api_key, secret_id, platform_id, import_from, synced_until, last_sync_at")
    .eq("user_id", user.id)
    .eq("exchange", "bingx")
    .maybeSingle();
  if (readError) {
    if (readError.code === "PGRST205") return NextResponse.json({ connected: false });
    return fail(`No se pudo leer la conexión: ${readError.message}`, 500);
  }
  if (!conn) return NextResponse.json({ connected: false });

  const now = Date.now();
  if (!force && conn.last_sync_at && now - Date.parse(conn.last_sync_at) < MIN_INTERVAL_MS) {
    return NextResponse.json({ skipped: true, inserted: 0 });
  }

  const record = (patch: Record<string, string | null>) =>
    supabase.from("exchange_connections").update(patch).eq("id", conn.id);
  const attemptedAt = new Date(now).toISOString();

  if (!conn.secret_id) {
    const message = "No hay una key guardada. Volvé a conectarla en Ajustes.";
    await record({ last_sync_at: attemptedAt, last_error: message });
    return fail(message, 409);
  }

  const importFrom = Date.parse(conn.import_from);
  const { span, windows } = syncWindows({
    importFrom,
    syncedUntil: conn.synced_until ? Date.parse(conn.synced_until) : null,
    now,
  });

  try {
    let inserted = 0;
    let duplicates = 0;
    if (windows.length > 0) {
      const positions = await getClosedPositionsIn(
        { apiKey: conn.api_key, sign: vaultSigner(supabase) },
        { income: incomeWindow(span), windows },
        symbolsFromIncome
      );
      const byId = new Map<string, ImportedTrade>();
      for (const p of positions) {
        const trade = positionToTrade(p, { span, importFrom, platformId: conn.platform_id });
        if (trade) byId.set(trade.external_id, trade);
      }

      if (byId.size > 0) {
        // Operations typed by hand around the same dates: importing must not double them.
        const { data: manual, error: manualError } = await supabase
          .from("trades")
          .select("date, asset, direction, pnl_usd")
          .eq("user_id", user.id)
          .is("source", null)
          .gte("date", todayKey(new Date(span.from - 2 * 86_400_000)));
        if (manualError) throw new Error(`manual trades: ${manualError.code} ${manualError.message}`);
        const split = dropManualDuplicates([...byId.values()], manual ?? []);
        duplicates = split.duplicates.length;

        if (split.fresh.length > 0) {
          // `ignoreDuplicates` is ON CONFLICT DO NOTHING, so what comes back are
          // only the rows that are new.
          const { data, error } = await supabase
            .from("trades")
            .upsert(
              split.fresh.map((t) => ({ ...t, user_id: user.id })),
              { onConflict: "user_id,source,external_id", ignoreDuplicates: true }
            )
            .select("id");
          if (error) throw new Error(`trades upsert: ${error.code} ${error.message}`);
          inserted = data?.length ?? 0;
        }
      }
    }
    await record({ synced_until: new Date(span.to).toISOString(), last_sync_at: attemptedAt, last_error: null });
    return NextResponse.json({ inserted, duplicates });
  } catch (e) {
    const message = e instanceof BingxError ? e.message : "No se pudo sincronizar. Probá de nuevo en un rato.";
    if (!(e instanceof BingxError)) console.error("[bingx sync]", e);
    // The cursor stays put: the next sync walks these windows again.
    await record({ last_sync_at: attemptedAt, last_error: message });
    return fail(message, 502);
  }
}
