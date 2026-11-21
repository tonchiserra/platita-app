import {
  BACKFILL_MS,
  INCOME_RETENTION_MS,
  MAX_SPAN_MS,
  OVERLAP_MS,
  buildQuery,
  dropManualDuplicates,
  explainBingxError,
  hasIpWhitelist,
  hmacHex,
  incomeWindow,
  isReadOnly,
  positionToTrade,
  signQuery,
  symbolsFromIncome,
  syncWindows,
  type BingxPosition,
  type ImportedTrade,
} from "@/lib/utils/bingx-sync";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

const ms = (iso: string) => Date.parse(iso);
const DAY = 86_400_000;

/** A real position from the test account (2026-11-21); only the id is made up. */
const REAL: BingxPosition = {
  positionId: "1991514470580734210",
  symbol: "BTC-USDT",
  positionSide: "LONG",
  openTime: ms("2026-11-21T13:07:23Z"),
  updateTime: ms("2026-11-21T15:18:07Z"),
  avgPrice: "59195.5",
  positionAmt: "0.0158",
  closePositionAmt: "0.0158",
  leverage: 48,
  closeAllPositions: true,
  realisedProfit: "8.9191",
  netProfit: "7.9794",
  positionCommission: "-0.93974845",
  totalFunding: "0",
};

const pos = (over: Partial<BingxPosition>): BingxPosition => ({ ...REAL, ...over });

section("firma");
{
  // The docs' example, signed with openssl:
  // echo -n 'recvWindow=0&symbol=BTC-USDT&timestamp=1696751141337' | openssl dgst -sha256 -hmac 'SECRET_KEY' -hex
  const q = signQuery({ timestamp: 1696751141337, symbol: "BTC-USDT", recvWindow: 0 }, "SECRET_KEY");
  check("ordena las claves en ASCII", q.startsWith("recvWindow=0&symbol=BTC-USDT&timestamp=1696751141337&"), q);
  check("coincide con openssl", q.endsWith("signature=fe041f159118c90ac13eab4d32f9e2d75b80ca6fe17ca8acd290aba864753ce2"), q);
  const { payload, encoded } = buildQuery({ timestamp: 1696751141337, symbol: "BTC-USDT", recvWindow: 0 });
  check("el payload es lo que firma Postgres", payload === "recvWindow=0&symbol=BTC-USDT&timestamp=1696751141337");
  check("hmacHex igual que openssl", hmacHex(payload, "SECRET_KEY") === "fe041f159118c90ac13eab4d32f9e2d75b80ca6fe17ca8acd290aba864753ce2");
  check("sin caracteres especiales, encoded = payload", encoded === payload);
}

section("ventanas");
{
  const importFrom = ms("2026-11-21T12:00:00Z");
  const now = ms("2026-11-21T18:00:00Z");
  const first = syncWindows({ importFrom, syncedUntil: null, now });
  check("sin cursor arranca en importFrom, una sola ventana", first.windows.length === 1 && first.span.from === importFrom && first.span.to === now);

  const later = syncWindows({ importFrom, syncedUntil: ms("2026-11-21T17:00:00Z"), now });
  check("con cursor relee una hora", later.span.from === ms("2026-11-21T17:00:00Z") - OVERLAP_MS);

  const early = syncWindows({ importFrom, syncedUntil: ms("2026-11-21T12:30:00Z"), now });
  check("el solapamiento nunca cruza importFrom", early.span.from === importFrom);

  const fresh = syncWindows({ importFrom: now, syncedUntil: null, now });
  check("recién conectado «a partir de ahora»: nada que pedir", fresh.windows.length === 0);

  const all = syncWindows({ importFrom: now - BACKFILL_MS, syncedUntil: null, now });
  check("«todas»: varias ventanas", all.windows.length === Math.ceil(BACKFILL_MS / MAX_SPAN_MS), String(all.windows.length));
  check("cada ventana entra en el tope de 90 días de BingX", all.windows.every((w) => w.to - w.from <= MAX_SPAN_MS && w.to - w.from < 90 * DAY));
  check("de la más vieja a la más nueva, sin huecos", all.windows.every((w, i) => i === 0 || w.from === all.windows[i - 1].to));
  check("cubren todo el período", all.windows[0].from === now - BACKFILL_MS && all.windows[all.windows.length - 1].to === now);

  const ancient = syncWindows({ importFrom: now - 3 * BACKFILL_MS, syncedUntil: null, now });
  check("nunca más de un año para atrás", ancient.span.from === now - BACKFILL_MS);

  const inc = incomeWindow(all.span);
  check("el income se pide solo en lo que BingX guarda", inc.from === now - INCOME_RETENTION_MS && inc.to === now);
  check("…o en el período, si es más corto", incomeWindow(first.span).from === importFrom);
}

section("pares del income");
{
  const symbols = symbolsFromIncome([
    { symbol: "BTC-USDT", incomeType: "REALIZED_PNL", income: "8.9", time: 1 },
    { symbol: "BTC-USDT", incomeType: "TRADING_FEE", income: "-0.9", time: 2 },
    { symbol: "SOL-USDT", incomeType: "INSURANCE_CLEAR", income: "-40", time: 3 },
    { symbol: "", incomeType: "TRANSFER", income: "100", time: 4 },
    { symbol: "eth-usdc", incomeType: "FUNDING_FEE", income: "-0.1", time: 5 },
  ]);
  check("únicos y ordenados", JSON.stringify(symbols) === JSON.stringify(["BTC-USDT", "ETH-USDC", "SOL-USDT"]), JSON.stringify(symbols));
  check("una liquidación también descubre el par", symbols.includes("SOL-USDT"));
}

section("posición → operación");
{
  const span = { from: ms("2026-11-21T12:00:00Z"), to: ms("2026-11-21T18:00:00Z") };
  const ctx = { span, importFrom: ms("2026-11-21T12:00:00Z"), platformId: "plat-1" };

  const t = positionToTrade(REAL, ctx);
  check("entra", t !== null);
  check("resultado neto", t?.pnl_usd === 7.98, String(t?.pnl_usd));
  check("% sobre el margen inicial (7,98 ÷ 19,49)", t?.pnl_pct === 40.95, String(t?.pnl_pct));
  check("mercado es la base del par", t?.asset === "BTC");
  check("dirección", t?.direction === "long");
  check("apalancamiento", t?.leverage === 48);
  check("fecha del cierre en Buenos Aires", t?.date === "2026-11-21");
  check("origen e id externo", t?.source === "bingx" && t?.external_id === "1991514470580734210");
  check("plataforma de la conexión", t?.platform_id === "plat-1");
  check("sin notas", t?.notes === null);

  check("short", positionToTrade(pos({ positionSide: "SHORT" }), ctx)?.direction === "short");
  check("one-way: el signo decide", positionToTrade(pos({ positionSide: "BOTH", positionAmt: "-0.01" }), ctx)?.direction === "short");
  check("pérdida queda negativa", positionToTrade(pos({ netProfit: "-19.9917" }), ctx)?.pnl_usd === -19.99);

  check("cierre parcial no entra", positionToTrade(pos({ closeAllPositions: false }), ctx) === null);
  check("neto cero no entra", positionToTrade(pos({ netProfit: "0.004" }), ctx) === null);
  check("cerrada antes del período no entra", positionToTrade(pos({ updateTime: span.from - 1 }), ctx) === null);
  check("cerrada antes de importFrom no entra", positionToTrade(pos({ updateTime: ms("2026-11-21T13:00:00Z") }), { ...ctx, importFrom: ms("2026-11-21T14:00:00Z") }) === null);

  // 01:00 UTC is 22:00 of the previous day in Buenos Aires.
  const lateNight = positionToTrade(pos({ updateTime: ms("2026-11-22T01:00:00Z") }), {
    ...ctx,
    span: { ...span, to: ms("2026-11-22T02:00:00Z") },
  });
  check("un cierre a la 01:00 UTC es del día anterior", lateNight?.date === "2026-11-21", lateNight?.date);

  check("sin apalancamiento no hay %", positionToTrade(pos({ leverage: 0 }), ctx)?.pnl_pct === null);
}

section("operaciones ya cargadas a mano");
{
  const imp = (date: string, asset: string, direction: "long" | "short", pnl_usd: number, id: string): ImportedTrade => ({
    date, asset, direction, pnl_usd, pnl_pct: null, leverage: 15, platform_id: null, notes: null, source: "bingx", external_id: id,
  });
  // Pairs from the real book (2026-11-21): BingX net vs what was typed.
  const imported = [
    imp("2026-11-19", "BTC", "long", -230.02, "a"), // typed −230,01
    imp("2026-11-13", "BTC", "long", -1849.93, "b"), // typed 0,07 off
    imp("2026-10-21", "BTC", "short", 9.19, "c"), // typed the next day
    imp("2026-11-20", "BTC", "short", 4.97, "d"),
    imp("2026-11-20", "BTC", "short", -19.99, "e"),
    imp("2026-11-21", "BTC", "long", 7.98, "f"), // not typed
  ];
  const manual = [
    { date: "2026-11-19", asset: "BTC", direction: "long", pnl_usd: "-230.01" },
    { date: "2026-11-13", asset: "btc", direction: "long", pnl_usd: -1850 },
    { date: "2026-10-22", asset: "BTC", direction: "short", pnl_usd: 9.19 },
    { date: "2026-11-20", asset: "BTC", direction: "short", pnl_usd: 4.97 },
    { date: "2026-11-20", asset: "BTC", direction: "short", pnl_usd: -19.99 },
    { date: "2026-11-21", asset: "BTC", direction: "short", pnl_usd: 7.98 }, // other direction
    { date: "2026-11-21", asset: "ETH", direction: "long", pnl_usd: 7.98 }, // other market
  ];
  const { fresh, duplicates } = dropManualDuplicates(imported, manual);
  check("las cargadas a mano no se importan", duplicates.map((t) => t.external_id).sort().join() === "a,b,c,d,e", duplicates.map((t) => t.external_id).join());
  check("lo que no está cargado entra", fresh.length === 1 && fresh[0].external_id === "f");

  const twins = dropManualDuplicates(
    [imp("2026-11-20", "BTC", "long", 5.0, "x"), imp("2026-11-20", "BTC", "long", 5.03, "y")],
    [{ date: "2026-11-20", asset: "BTC", direction: "long", pnl_usd: 5.03 }]
  );
  check("una fila manual tapa una sola posición, la más parecida", twins.duplicates.length === 1 && twins.duplicates[0].external_id === "y");
  check("dos días de diferencia no es la misma", dropManualDuplicates([imp("2026-11-20", "BTC", "long", 5, "z")], [{ date: "2026-11-18", asset: "BTC", direction: "long", pnl_usd: 5 }]).fresh.length === 1);
  check("un resultado distinto no es la misma", dropManualDuplicates([imp("2026-11-20", "BTC", "long", 5, "z")], [{ date: "2026-11-20", asset: "BTC", direction: "long", pnl_usd: 5.2 }]).fresh.length === 1);
}

section("permisos y errores");
{
  check("solo lectura", isReadOnly([2]));
  check("lectura + futuros no", !isReadOnly([2, 3]));
  check("retiros no", !isReadOnly([2, 5]));
  check("vacío no", !isReadOnly([]));
  check("sin lista blanca", !hasIpWhitelist([]) && !hasIpWhitelist([""]) && !hasIpWhitelist(undefined));
  check("con lista blanca", hasIpWhitelist(["1.2.3.4"]));
  check("key inexistente en español", explainBingxError(100413, "Incorrect apiKey").includes("API Key"));
  check("secret equivocado en español", explainBingxError(100001, "Signature verification failed").includes("Secret Key"));
  check("desconocido conserva el mensaje", explainBingxError(123, "boom").includes("boom"));
}

console.log(`\n${pass} ok, ${fail} fallas`);
if (fail) process.exit(1);
