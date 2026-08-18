import {
  COLUMNS,
  SHEET,
  SHEET_ORDER,
  countRows,
  PAGE_SIZE,
  emptyBackup,
  fetchAllPages,
  isoToUtcDate,
  parseBackupWorkbook,
  readBoolean,
  readDate,
  readNumber,
  sheetRows,
  totalRows,
  type BackupData,
  type RawSheet,
  type SheetKey,
} from "@/lib/utils/backup-schema";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = "") => {
  if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "  << " + x : "")); }
};
const section = (n: string) => console.log("\n" + n);
/** Key order is not meaningful here, so compare with keys sorted. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value
  );

/** A workbook built from records, so a test only names the rows it cares about. */
function workbook(overrides: Partial<Record<SheetKey, unknown[][]>>): RawSheet[] {
  return SHEET_ORDER.map((key) => ({
    sheet: SHEET[key],
    data: [COLUMNS[key].map((c) => c.header), ...(overrides[key] ?? [])],
  }));
}

const PLATFORM = ["Brubank", "bank", "ARS", true];

async function main() {
section("lectura de celdas");
{
  check("a Date cell becomes an ISO day",
    readDate(new Date(Date.UTC(2026, 7, 1))) === "2026-08-01");
  check("an ISO string passes through", readDate("2026-08-01") === "2026-08-01");
  check("a single-digit ISO string is padded", readDate("2026-8-1") === "2026-08-01");
  check("the DD/MM/YYYY a person types is read as es-AR", readDate("01/08/2026") === "2026-08-01");
  check("garbage is rejected", readDate("mañana") === null);
  check("blank is rejected", readDate("") === null);

  check("a numeric cell passes through", readNumber(45000.5) === 45000.5);
  check("plain digits parse", readNumber("500") === 500);
  check("the Argentine 1.234,56 parses", readNumber("1.234,56") === 1234.56);
  check("blank is null, not zero", readNumber("") === null);
  check("text is null", readNumber("mucho") === null);

  check("a boolean passes through", readBoolean(true, false) === true);
  check("«sí» is true", readBoolean("Sí", false) === true);
  check("«no» is false", readBoolean("no", true) === false);
  check("blank takes the fallback", readBoolean("", true) === true);
  check("an unknown word takes the fallback", readBoolean("quizá", false) === false);
}

section("fechas de ida y vuelta");
{
  const d = isoToUtcDate("2026-08-01");
  check("built at UTC midnight so no timezone shifts the day",
    d !== null && d.toISOString() === "2026-08-01T00:00:00.000Z");
  check("a round trip lands on the same day", readDate(isoToUtcDate("2026-01-01")) === "2026-01-01");
  check("an invalid string yields null", isoToUtcDate("nope") === null);
}

section("hoja vacía = plantilla");
{
  const rows = sheetRows("expenses", emptyBackup());
  check("only the header row", rows.length === 1);
  check("the headers are the declared ones",
    JSON.stringify(rows[0]) === JSON.stringify(COLUMNS.expenses.map((c) => c.header)));
}

section("un archivo válido");
{
  const result = parseBackupWorkbook(
    workbook({
      platforms: [PLATFORM],
      categories: [["Comida", "🍔", true, 1]],
      expenses: [["2026-08-01", 45000.5, "ARS", "Food", "Súper", "Brubank"]],
      incomes: [["2026-08-05", 500, "USD", "Salary", "", ""]],
      investments: [["2026-08-07", "BTC", "crypto", 650, 65000, null, "USD", "Brubank", ""]],
      snapshots: [["2026-08-31", 17562263.32, "cierre"]],
      snapshotItems: [["2026-08-31", "Brubank", "ARS", 10350995]],
    })
  );
  check("no issues", result.issues.length === 0, JSON.stringify(result.issues));
  const data = result.data!;
  check("data came back", data !== null);
  check("one row per sheet", totalRows(data) === 7);
  check("the expense platform resolved by name", data.expenses[0].platform === "Brubank");
  check("a blank platform becomes null", data.incomes[0].platform === null);
  check("blank units are derived from total / price", data.investments[0].units === 0.01,
    String(data.investments[0].units));
  check("a blank note becomes null", data.investments[0].notes === null);
  check("counts line up", countRows(data).snapshotItems === 1);
}

section("las referencias por nombre tienen que existir");
{
  const unknown = parseBackupWorkbook(
    workbook({
      platforms: [PLATFORM],
      expenses: [["2026-08-01", 100, "ARS", "Food", "", "Banco Fantasma"]],
    })
  );
  check("an unknown platform is an error", unknown.issues.length === 1);
  check("and nothing is returned", unknown.data === null);
  check("the message names the platform and the sheet",
    unknown.issues[0].message.includes("Banco Fantasma") && unknown.issues[0].message.includes("Plataformas"),
    unknown.issues[0].message);
  check("and points at the spreadsheet row number", unknown.issues[0].row === 2);

  // A breakdown row has a not-null platform, so blank cannot degrade to null.
  const blank = parseBackupWorkbook(
    workbook({
      platforms: [PLATFORM],
      snapshots: [["2026-08-31", 100, ""]],
      snapshotItems: [["2026-08-31", "", "ARS", 100]],
    })
  );
  check("a breakdown row without a platform is an error", blank.issues.length === 1);

  const orphan = parseBackupWorkbook(
    workbook({ platforms: [PLATFORM], snapshotItems: [["2026-07-31", "Brubank", "ARS", 100]] })
  );
  check("a breakdown row with no matching close is an error", orphan.issues.length === 1);
  check("and says which date is missing", orphan.issues[0].message.includes("2026-07-31"));
}

section("validación fila por fila");
{
  const cases: [string, Partial<Record<SheetKey, unknown[][]>>, string][] = [
    ["a zero amount is rejected", { platforms: [PLATFORM], expenses: [["2026-08-01", 0, "ARS", "Food", "", ""]] }, "mayor a cero"],
    ["a negative amount is rejected", { platforms: [PLATFORM], expenses: [["2026-08-01", -5, "ARS", "Food", "", ""]] }, "mayor a cero"],
    ["an unknown currency is rejected", { platforms: [PLATFORM], expenses: [["2026-08-01", 10, "GBP", "Food", "", ""]] }, "inválida"],
    ["a bad date is rejected", { platforms: [PLATFORM], expenses: [["ayer", 10, "ARS", "Food", "", ""]] }, "Fecha inválida"],
    ["a missing category is rejected", { platforms: [PLATFORM], expenses: [["2026-08-01", 10, "ARS", "", "", ""]] }, "obligatorio"],
    ["a bad platform type is rejected", { platforms: [["Brubank", "banco-raro", "ARS", true]] }, "inválido"],
    ["a bad asset type is rejected", { platforms: [PLATFORM], investments: [["2026-08-01", "BTC", "nft", 10, 5, null, "USD", "", ""]] }, "inválido"],
  ];
  for (const [name, sheets, fragment] of cases) {
    const out = parseBackupWorkbook(workbook(sheets));
    check(name, out.data === null && out.issues.some((i) => i.message.includes(fragment)),
      JSON.stringify(out.issues));
  }
}

section("duplicados");
{
  const platforms = parseBackupWorkbook(
    workbook({ platforms: [PLATFORM, ["brubank", "bank", "ARS", true]] })
  );
  check("two platforms with the same name (any case) is an error",
    platforms.issues.some((i) => i.message.includes("repetida")));

  const categories = parseBackupWorkbook(
    workbook({ categories: [["Comida", "🍔", false, 1], ["Comida", "🍕", false, 2]] })
  );
  check("a repeated category is an error, since the table is unique per user",
    categories.issues.some((i) => i.message.includes("repetida")));

  const snapshots = parseBackupWorkbook(
    workbook({ snapshots: [["2026-08-31", 1, ""], ["2026-08-31", 2, ""]] })
  );
  check("two closes on one date is an error, since the breakdown binds by date",
    snapshots.issues.some((i) => i.message.includes("Ya hay un cierre")));
}

section("estructura del archivo");
{
  const missing = parseBackupWorkbook(
    workbook({}).filter((s) => s.sheet !== SHEET.expenses)
  );
  check("a missing sheet is an error, because a restore would wipe that table",
    missing.issues.some((i) => i.message.includes("Falta la hoja")));

  const noHeader = workbook({});
  noHeader[2] = { sheet: SHEET.expenses, data: [] };
  check("a sheet with no header row is an error",
    parseBackupWorkbook(noHeader).issues.some((i) => i.message.includes("no tiene encabezados")));

  const noColumn = workbook({});
  noColumn[2] = { sheet: SHEET.expenses, data: [["fecha", "monto"]] };
  check("a missing column is named",
    parseBackupWorkbook(noColumn).issues.some((i) => i.message.includes("Falta la columna")));

  // Reading by header name is what makes this work.
  const reordered: RawSheet[] = workbook({ platforms: [PLATFORM] }).map((s) =>
    s.sheet !== SHEET.expenses
      ? s
      : {
          sheet: s.sheet,
          data: [
            ["moneda", "descripción", "fecha", "plataforma", "monto", "categoría"],
            ["ARS", "Súper", "2026-08-01", "Brubank", 999, "Food"],
          ],
        }
  );
  const out = parseBackupWorkbook(reordered);
  check("columns in a different order still import", out.data !== null, JSON.stringify(out.issues));
  check("and land in the right fields",
    out.data?.expenses[0].amount === 999 && out.data?.expenses[0].category === "Food");
}

section("un archivo ajeno no se confunde con una plantilla");
{
  const foreign: RawSheet[] = [{ sheet: "Hoja1", data: [["a", "b"], [1, 2]] }];
  const out = parseBackupWorkbook(foreign);
  check("nothing is returned", out.data === null);
  check("every sheet is reported missing", out.issues.length === SHEET_ORDER.length);
}

section("varios problemas se informan juntos");
{
  const out = parseBackupWorkbook(
    workbook({
      platforms: [PLATFORM],
      expenses: [
        ["2026-08-01", 0, "ARS", "Food", "", ""],
        ["nunca", 10, "ARS", "Food", "", ""],
        ["2026-08-03", 10, "GBP", "Food", "", ""],
      ],
    })
  );
  check("three bad rows produce three issues", out.issues.length === 3, String(out.issues.length));
  check("each one points at its own row",
    JSON.stringify(out.issues.map((i) => i.row)) === "[2,3,4]");
}

section("filas en blanco se ignoran");
{
  const out = parseBackupWorkbook(
    workbook({
      platforms: [PLATFORM],
      expenses: [
        ["2026-08-01", 10, "ARS", "Food", "", ""],
        [null, null, null, null, null, null],
        ["", "", "", "", "", ""],
      ],
    })
  );
  check("a wholly blank row is not an error", out.issues.length === 0, JSON.stringify(out.issues));
  check("and is not imported", out.data?.expenses.length === 1);
}

section("etiquetas en español para tipo de plataforma");
{
  const out = parseBackupWorkbook(workbook({ platforms: [["Efectivo", "Efectivo", "ARS", true]] }));
  check("the label the UI shows is accepted", out.data !== null, JSON.stringify(out.issues));
  check("and stored as the key the database uses", out.data?.platforms[0].type === "cash");
}

section("todo lo exportado se puede volver a importar");
{
  // The round trip the whole design rests on: build a payload, write it as
  // sheet rows, read those rows back, and get the same payload.
  const original: BackupData = {
    platforms: [{ name: "Brubank", type: "bank", default_currency: "ARS", is_active: true },
                { name: "Lemon", type: "crypto_exchange", default_currency: "USD", is_active: false }],
    categories: [{ name: "Comida", icon: "🍔", is_fixed: false, sort_order: 0 }],
    expenses: [{ date: "2026-08-01", amount: 45000.5, currency: "ARS", category: "Food", description: "Súper", platform: "Brubank" },
               { date: "2026-08-02", amount: 12, currency: "USD", category: "Subscriptions", description: "", platform: null }],
    incomes: [{ date: "2026-08-05", amount: 500, currency: "USD", source: "Salary", description: "", platform: "Brubank" }],
    investments: [{ date: "2026-08-07", asset: "BTC", asset_type: "crypto", units: 0.01, price_per_unit: 65000, total_amount: 650, currency: "USD", platform: "Lemon", notes: null }],
    snapshots: [{ date: "2026-08-31", total_ars: 17562263.32, notes: null }],
    snapshotItems: [{ date: "2026-08-31", platform: "Brubank", currency: "ARS", amount: 10350995 },
                    { date: "2026-08-31", platform: "Lemon", currency: "USD", amount: 4743.49 }],
  };

  const written: RawSheet[] = SHEET_ORDER.map((key) => ({
    sheet: SHEET[key],
    data: sheetRows(key, original),
  }));
  const back = parseBackupWorkbook(written);
  check("it reads back with no issues", back.issues.length === 0, JSON.stringify(back.issues));
  check("and is identical", canonical(back.data) === canonical(original), canonical(back.data));
}

section("leer una tabla entera");
{
  /** A fake table of `total` rows, served in pages like PostgREST does. */
  const table = (total: number) => {
    const calls: [number, number][] = [];
    const read = async (from: number, to: number) => {
      calls.push([from, to]);
      const rows = Array.from({ length: total }, (_, i) => ({ i })).slice(from, to + 1);
      return { data: rows, error: null };
    };
    return { read, calls };
  };

  const small = table(3);
  const a = await fetchAllPages(small.read, "gastos", { pageSize: 10 });
  check("a table smaller than a page reads in one call", small.calls.length === 1);
  check("and returns every row", a.rows.length === 3);

  const many = table(25);
  const b = await fetchAllPages(many.read, "gastos", { pageSize: 10 });
  check("a table larger than a page keeps reading", many.calls.length === 3, JSON.stringify(many.calls));
  check("and returns every row, not just the first page", b.rows.length === 25, String(b.rows.length));
  check("the ranges are contiguous and inclusive",
    JSON.stringify(many.calls) === "[[0,9],[10,19],[20,29]]", JSON.stringify(many.calls));

  // The off-by-one that a naive pager gets wrong: a table that is an exact
  // multiple of the page size looks full on the last page.
  const exact = table(20);
  const c = await fetchAllPages(exact.read, "gastos", { pageSize: 10 });
  check("an exact multiple of the page size is not truncated", c.rows.length === 20, String(c.rows.length));
  check("and costs one extra read to confirm the end", exact.calls.length === 3);

  const empty = await fetchAllPages(async () => ({ data: [], error: null }), "gastos");
  check("an empty table is not an error", empty.rows.length === 0 && empty.missing === false);

  check("the default page matches PostgREST's cap", PAGE_SIZE === 1000);
}

section("una consulta que falla no puede parecer una tabla vacía");
{
  // This is the defect that let a partial export look complete: a failed query
  // returns no rows, and an empty sheet restored later deletes the real rows.
  let threw: string | null = null;
  try {
    await fetchAllPages(
      async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
      "gastos"
    );
  } catch (caught) {
    threw = caught instanceof Error ? caught.message : String(caught);
  }
  check("it throws instead of returning zero rows", threw !== null);
  check("and the message names the table", threw!.includes("gastos"), String(threw));
  check("and carries the underlying reason", threw!.includes("permission denied"));

  // A page that fails midway must not return the pages already read.
  let partial: string | null = null;
  let call = 0;
  try {
    await fetchAllPages(
      async () => {
        call++;
        if (call === 1) return { data: Array.from({ length: 10 }, (_, i) => ({ i })), error: null };
        return { data: null, error: { message: "se cortó la red" } };
      },
      "gastos",
      { pageSize: 10 }
    );
  } catch (caught) {
    partial = caught instanceof Error ? caught.message : String(caught);
  }
  check("a failure on a later page throws too, rather than returning a short table",
    partial !== null && partial.includes("se cortó la red"), String(partial));
}

section("la única falla tolerada: falta la migración 002");
{
  const MISSING = ["PGRST205", "42P01"] as const;

  // The code the REST API actually returns. Tolerating only the raw Postgres
  // `42P01` let a real export fail outright on an account without migration 002.
  const cached = await fetchAllPages(
    async () => ({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.expense_categories' in the schema cache",
      },
    }),
    "expense_categories",
    { tolerateMissingCodes: MISSING }
  );
  check("PostgREST's schema-cache miss is tolerated", cached.missing === true);
  check("and yields no rows", cached.rows.length === 0);

  const raw = await fetchAllPages(
    async () => ({ data: null, error: { code: "42P01", message: 'relation "expense_categories" does not exist' } }),
    "expense_categories",
    { tolerateMissingCodes: MISSING }
  );
  check("the raw Postgres code is tolerated too", raw.missing === true);

  // Tolerating those must not tolerate anything else.
  let other: string | null = null;
  try {
    await fetchAllPages(
      async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
      "expense_categories",
      { tolerateMissingCodes: MISSING }
    );
  } catch (caught) {
    other = caught instanceof Error ? caught.message : String(caught);
  }
  check("a different error still throws", other !== null);

  // And a table with no tolerance configured must never swallow a missing table.
  let strict: string | null = null;
  try {
    await fetchAllPages(
      async () => ({ data: null, error: { code: "PGRST205", message: "no está" } }),
      "expenses"
    );
  } catch (caught) {
    strict = caught instanceof Error ? caught.message : String(caught);
  }
  check("without tolerance, a missing table throws", strict !== null && strict.includes("expenses"));
}

}

main().then(() => {
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
});
