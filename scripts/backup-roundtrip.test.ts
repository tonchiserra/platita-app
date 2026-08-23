import writeXlsxFile from "write-excel-file/node";
import readXlsxFile from "read-excel-file/node";
import {
  COLUMNS, INSTRUCTIONS, INSTRUCTIONS_SHEET, SHEET, SHEET_ORDER,
  parseBackupWorkbook, sheetRows, totalRows, emptyBackup,
  type BackupData, type CellValue,
} from "@/lib/utils/backup-schema";

const data: BackupData = {
  platforms: [{ name: "Brubank", type: "bank", default_currency: "ARS", is_active: true },
              { name: "Lemon", type: "crypto_exchange", default_currency: "USD", is_active: false }],
  categories: [{ name: "Comida", icon: "🍔", is_fixed: true, sort_order: 0 }],
  expenses: [{ date: "2026-01-01", amount: 45000.5, currency: "ARS", category: "Food", description: 'Súper "raro"; con ; y ,', platform: "Brubank" },
             { date: "2026-08-02", amount: 12.34, currency: "USD", category: "Subscriptions", description: "", platform: null }],
  incomes: [{ date: "2026-08-05", amount: 500, currency: "USD", source: "Salary", description: "", platform: "Brubank" }],
  investments: [{ date: "2026-08-07", asset: "BTC", asset_type: "crypto", units: 0.01, price_per_unit: 65000, total_amount: 650, currency: "USD", platform: "Lemon", notes: null }],
  // Both signs, because the sign is the one thing this column has to survive.
  trades: [{ date: "2026-08-19", asset: "BTC", direction: "long", pnl_usd: 420.5, pnl_pct: 12.4, leverage: 10, platform: "Lemon", notes: "Breakout post-FOMC" },
           { date: "2026-08-14", asset: "ETH", direction: "short", pnl_usd: -150, pnl_pct: -6.8, leverage: null, platform: null, notes: null }],
  snapshots: [{ date: "2026-08-31", total_ars: 17562263.32, notes: null }],
  snapshotItems: [{ date: "2026-08-31", platform: "Brubank", currency: "ARS", amount: 10350995 },
                  { date: "2026-08-31", platform: "Lemon", currency: "USD", amount: 4743.49 }],
};

function build(payload: BackupData, withInstructions: boolean) {
  const sheets: unknown[] = SHEET_ORDER.map((key) => {
    const columns = COLUMNS[key];
    return {
      sheet: SHEET[key],
      data: sheetRows(key, payload).map((row, r) =>
        row.map((value: CellValue, c) => {
          if (r === 0) return { value, fontWeight: "bold" };
          const t = columns[c].type;
          if (t === "date") return { value: value as Date | null, type: Date, format: "yyyy-mm-dd" };
          if (t === "number") return { value: value as number | null, type: Number };
          if (t === "boolean") return { value: value as boolean | null, type: Boolean };
          return { value: value === null ? null : String(value), type: String };
        })),
      columns: columns.map((c) => ({ width: c.width })),
      stickyRowsCount: 1,
    };
  });
  if (withInstructions) {
    sheets.push({
      sheet: INSTRUCTIONS_SHEET,
      data: INSTRUCTIONS.map((row) => row.map((v) => ({ value: String(v), type: String }))),
      columns: [{ width: 6 }, { width: 30 }, { width: 70 }],
      stickyRowsCount: 1,
    });
  }
  return sheets;
}

const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value);

let bad = 0;
const ok = (n: string, c: boolean, x = "") => { console.log((c ? "  ok   " : "  FAIL ") + n + (c ? "" : "  << " + x)); if (!c) bad++; };

async function main() {
  // 1. Exportación -> lectura -> mismo payload
  await writeXlsxFile(build(data, false) as never).toFile("/tmp/export.xlsx");
  const back = parseBackupWorkbook((await readXlsxFile("/tmp/export.xlsx")) as never);
  ok("el archivo exportado se relee sin problemas", back.issues.length === 0, JSON.stringify(back.issues));
  ok("y da exactamente el mismo payload", canonical(back.data) === canonical(data), canonical(back.data));

  // 2. La plantilla vacía es válida y no importa nada
  await writeXlsxFile(build(emptyBackup(), true) as never).toFile("/tmp/plantilla.xlsx");
  const tpl = parseBackupWorkbook((await readXlsxFile("/tmp/plantilla.xlsx")) as never);
  ok("la plantilla vacía no tiene errores de estructura", tpl.issues.length === 0, JSON.stringify(tpl.issues));
  ok("y no trae ninguna fila", tpl.data !== null && totalRows(tpl.data) === 0);
  const sheetNames = ((await readXlsxFile("/tmp/plantilla.xlsx")) as never as {sheet:string}[]).map(s => s.sheet);
  // Derived from SHEET_ORDER rather than a literal: adding a table has to grow
  // this count on its own, or the assertion just breaks on the next migration.
  ok(`tiene las ${SHEET_ORDER.length} hojas más Instrucciones`,
    sheetNames.length === SHEET_ORDER.length + 1, sheetNames.join(", "));
  ok("la hoja de instrucciones está presente", sheetNames.includes(INSTRUCTIONS_SHEET));
  ok("y una hoja por tabla, sin faltar ninguna",
    SHEET_ORDER.every((key) => sheetNames.includes(SHEET[key])), sheetNames.join(", "));

  // 3. La plantilla llenada a mano (fechas y números como texto es-AR)
  const filled = (await readXlsxFile("/tmp/plantilla.xlsx")) as never as {sheet:string; data:unknown[][]}[];
  for (const s of filled) {
    if (s.sheet === SHEET.platforms) s.data.push(["Efectivo", "Efectivo", "ARS", "sí"]);
    if (s.sheet === SHEET.expenses) s.data.push(["01/08/2026", "1.234,56", "ars", "Food", "a mano", "Efectivo"]);
  }
  const hand = parseBackupWorkbook(filled as never);
  ok("una plantilla llenada a mano se acepta", hand.issues.length === 0, JSON.stringify(hand.issues));
  ok("la fecha DD/MM/YYYY se interpreta es-AR", hand.data?.expenses[0].date === "2026-08-01", String(hand.data?.expenses[0].date));
  ok("el monto 1.234,56 se lee como 1234.56", hand.data?.expenses[0].amount === 1234.56, String(hand.data?.expenses[0].amount));
  ok("la moneda en minúscula se normaliza", hand.data?.expenses[0].currency === "ARS");
  ok("la etiqueta «Efectivo» se guarda como «cash»", hand.data?.platforms[0].type === "cash");

  console.log(bad ? `\n${bad} fallos\n` : "\ntodo ok\n");
  process.exit(bad ? 1 : 0);

}
main();
