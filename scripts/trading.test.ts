import {
  tradeIncomes,
  tradeLossesUsd,
  tradeProfitsUsd,
  tradePnlByMonth,
  tradeStats,
  runningResultByWeek,
  defaultLabel,
  type TradeLike,
} from "@/lib/utils/trading";
import { RETURN_SOURCES, TRADE_INCOME_SOURCE } from "@/lib/constants/sources";
import { buildTimeline } from "@/lib/utils/patrimony-timeline";
import { formatWeekKey, formatWeekTick, weekRange, weekStartKey } from "@/lib/utils/format";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);

const trade = (over: Partial<TradeLike> & { pnl_usd: number | string }): TradeLike => ({
  date: "2026-08-19",
  asset: "BTC",
  direction: "long",
  ...over,
});

/** The month from the design doc: three wins, two losses, +1.240 net. */
const BOOK: TradeLike[] = [
  trade({ date: "2026-08-19", asset: "BTC", pnl_usd: 420, notes: "Breakout post-FOMC" }),
  trade({ date: "2026-08-14", asset: "ETH", direction: "short", pnl_usd: -150 }),
  trade({ date: "2026-08-11", asset: "SOL", pnl_usd: 265 }),
  trade({ date: "2026-08-07", asset: "BTC", direction: "short", pnl_usd: -47 }),
  trade({ date: "2026-08-04", asset: "ETH", pnl_usd: 752 }),
  trade({ date: "2026-07-22", asset: "BTC", pnl_usd: -310 }),
];

section("la mitad que es ingreso");
{
  const rows = tradeIncomes(BOOK);
  check("sólo las ganadoras se vuelven ingreso", rows.length === 3);
  check("y suman 1.437", rows.reduce((s, r) => s + r.amount, 0) === 1437);
  check("todas en USD", rows.every((r) => r.currency === "USD"));
  check("con la fuente de retorno", rows.every((r) => r.source === TRADE_INCOME_SOURCE));

  // This is the whole mechanism by which the alternatives chart stays correct
  // without knowing trades exist.
  check("que es una fuente que el gráfico de alternativas excluye",
    rows.every((r) => RETURN_SOURCES.has(r.source)));

  check("la nota es la descripción", rows[0].description === "Breakout post-FOMC");
  check("sin nota, se arma una", tradeIncomes([trade({ asset: "SOL", pnl_usd: 10 })])[0].description === "Long en SOL");
  check("el id no puede chocar con un ingreso real", rows.every((r) => r.id.startsWith("trade:")));
  check("conserva la fecha de la operación", rows[0].date === "2026-08-19");
}

section("la mitad que no es gasto");
{
  check("las pérdidas del libro suman 507", tradeLossesUsd(BOOK) === 507);
  check("las de agosto, 197", tradeLossesUsd(BOOK, "2026-08") === 197);
  check("son positivas, porque quien las usa las resta",
    tradeLossesUsd(BOOK) > 0);
  check("un libro sin pérdidas devuelve cero",
    tradeLossesUsd([trade({ pnl_usd: 100 })]) === 0);
  check("las ganancias de agosto suman 1.437", tradeProfitsUsd(BOOK, "2026-08") === 1437);

  // Neither half may leak into the other: this is the rule the whole feature
  // rests on, stated as arithmetic.
  const net = tradeProfitsUsd(BOOK) - tradeLossesUsd(BOOK);
  check("ganancias menos pérdidas es el neto", net === tradeStats(BOOK).net);
}

section("los números del libro");
{
  const month = tradeStats(BOOK, "2026-08");
  check("el neto de agosto es +1.240", month.net === 1240);
  check("3 ganadas", month.wins === 3);
  check("2 perdidas", month.losses === 2);
  check("60 % de acierto", month.winRate === 60);

  const all = tradeStats(BOOK);
  check("el acumulado es +930", all.net === 930);
  check("el primer mes es julio", all.firstMonth === "2026-07");
  check("sin operaciones no hay tasa", tradeStats([]).winRate === null);
  check("ni primer mes", tradeStats([]).firstMonth === null);

  const empty = tradeStats(BOOK, "2026-06");
  check("un mes sin operaciones da cero y sin tasa",
    empty.net === 0 && empty.winRate === null);
}

section("PostgREST devuelve números como texto");
{
  const asText: TradeLike[] = [
    trade({ date: "2026-08-19", pnl_usd: "420.00" }),
    trade({ date: "2026-08-14", pnl_usd: "-150.00", leverage: "5" }),
  ];
  check("las cadenas se suman como números", tradeStats(asText).net === 270);
  check("la pérdida en texto también", tradeLossesUsd(asText) === 150);
  check("el apalancamiento en texto llega como número",
    tradeIncomes([trade({ pnl_usd: "10", leverage: "5" })])[0].trade.leverage === 5);
}

section("hoy y la semana");
{
  const day = tradeStats(BOOK, { from: "2026-08-19", to: "2026-08-19" });
  check("un día: solo sus operaciones", day.net === 420 && day.wins === 1 && day.losses === 0);
  // The week of Wednesday 2026-08-19 runs Monday 17 to Sunday 23; to date is 17–19.
  const week = tradeStats(BOOK, { from: weekStartKey("2026-08-19"), to: "2026-08-19" });
  check("la semana a la fecha", week.net === 420 && week.wins + week.losses === 1);
  const lastWeek = tradeStats(BOOK, { from: "2026-08-10", to: "2026-08-16" });
  check("la semana anterior, completa", lastWeek.net === 265 - 150 && lastWeek.wins === 1 && lastWeek.losses === 1);
  const none = tradeStats(BOOK, { from: "2026-08-20", to: "2026-08-20" });
  check("un día sin operaciones da cero", none.net === 0 && none.wins === 0 && none.losses === 0 && none.winRate === null);
  check("el mes sigue funcionando igual", tradeStats(BOOK, "2026-08").net === 1240);
  check("el primer mes no depende del período", tradeStats(BOOK, { from: "2026-08-19", to: "2026-08-19" }).firstMonth === "2026-07");
}

section("lunes de la semana");
{
  check("miércoles → lunes", weekStartKey("2026-11-25") === "2026-11-23");
  check("lunes → el mismo lunes", weekStartKey("2026-11-23") === "2026-11-23");
  check("domingo → el lunes anterior", weekStartKey("2026-11-29") === "2026-11-23");
  check("cruza el mes", weekStartKey("2026-12-02") === "2026-11-30");
  check("cruza el año", weekStartKey("2027-01-01") === "2026-12-28");
}

section("el acumulado semana a semana");
{
  // BOOK runs from Wednesday 2026-07-22 to Wednesday 2026-08-19.
  const { weeks, usd } = runningResultByWeek(BOOK, "2026-08-26");
  check("arranca el lunes de la primera operación", weeks[0] === "2026-07-20");
  check("llega a la semana de hoy", weeks[weeks.length - 1] === "2026-08-24");
  check("una semana por lunes, sin huecos", weeks.length === 6 && weeks.every((w, i) => i === 0 || Date.parse(w) - Date.parse(weeks[i - 1]) === 7 * 86_400_000));
  check("la primera semana: la pérdida de julio", usd[0] === -310);
  check("una semana sin operaciones repite el total", usd[1] === -310);
  check("cierra en el total del libro", usd[usd.length - 1] === tradeStats(BOOK).net, String(usd[usd.length - 1]));
  // Weeks: 20 Jul, 27 Jul, 3 Aug, 10 Aug, 17 Aug, 24 Aug.
  check("3–9 ago: ETH +752, BTC −47", usd[2] - usd[1] === 705, String(usd[2] - usd[1]));
  check("10–16 ago: SOL +265, ETH −150", usd[3] - usd[2] === 115, String(usd[3] - usd[2]));
  check("17–23 ago: BTC +420", usd[4] - usd[3] === 420, String(usd[4] - usd[3]));
  check("sin operaciones no hay serie", runningResultByWeek([], "2026-08-26").weeks.length === 0);
}

section("rango y rótulos de semanas");
{
  check("rango de lunes a lunes", weekRange("2026-11-02", "2026-11-23").join() === "2026-11-02,2026-11-09,2026-11-16,2026-11-23");
  check("cruza el año", weekRange("2026-12-21", "2027-01-04").join() === "2026-12-21,2026-12-28,2027-01-04");
  check("un solo lunes", weekRange("2026-11-23", "2026-11-23").length === 1);
  const now = new Date("2026-11-21T15:00:00Z");
  check("título de la semana", formatWeekKey("2026-11-16", now) === "Semana del 16 nov", formatWeekKey("2026-11-16", now));
  check("con el año si no es este", formatWeekKey("2025-12-29", now) === "Semana del 29 dic 2025", formatWeekKey("2025-12-29", now));
  check("marca del eje", formatWeekTick("2026-11-16") === "16 nov" && formatWeekTick("2025-12-29", true) === "29 dic 25", formatWeekTick("2025-12-29", true));
}

section("la serie por mes");
{
  const byMonth = tradePnlByMonth(BOOK);
  check("un renglón por mes con operaciones", byMonth.length === 2);
  check("ascendente", byMonth[0].month === "2026-07" && byMonth[1].month === "2026-08");
  check("julio cerró en −310", byMonth[0].net === -310);
  check("agosto en +1.240", byMonth[1].net === 1240);

  // A month with no operation is absent rather than zero: a zero bar would read
  // as "I traded and broke even".
  const gap = tradePnlByMonth([
    trade({ date: "2026-05-02", pnl_usd: 100 }),
    trade({ date: "2026-08-02", pnl_usd: 100 }),
  ]);
  check("los meses sin operar no aparecen", gap.length === 2);
  check("no se rellenan con cero", gap.every((row) => row.net !== 0));
}

section("etiqueta por defecto");
{
  check("long", defaultLabel({ asset: "BTC", direction: "long" }) === "Long en BTC");
  check("short", defaultLabel({ asset: "ETH", direction: "short" }) === "Short en ETH");
}

section("las ganancias no mueven el gráfico de alternativas");
{
  // The same assertion `return-sources.test.ts` makes for manual rows, now for
  // rows the trade book derives: filtering by RETURN_SOURCES has to drop them.
  const manual = [{ date: "2026-02-10", amount: 500_000, currency: "ARS", source: "Salary" }];
  const derived = tradeIncomes([trade({ date: "2026-02-20", pnl_usd: 420 })]);
  const all = [...manual, ...derived];

  const kept = all.filter((row) => !RETURN_SOURCES.has(row.source));
  check("la fila derivada queda afuera del filtro", kept.length === 1);
  check("y la manual no", kept[0].source === "Salary");

  const common = {
    snapshots: [{ date: "2026-01-31", totalArs: 10_000_000 }],
    blueSeries: null,
    inflationSeries: null,
  };
  const withReturn = buildTimeline({
    ...common,
    flows: all.map((row) => ({ date: row.date, amountArs: row.amount, sign: 1 as const })),
  });
  const without = buildTimeline({
    ...common,
    flows: kept.map((row) => ({ date: row.date, amountArs: row.amount, sign: 1 as const })),
  });
  check("con el retorno adentro, febrero suma más",
    withReturn[0].netSavingsArs > without[0].netSavingsArs);
  check("sin él, suma sólo el sueldo", without[0].netSavingsArs === 500_000);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
