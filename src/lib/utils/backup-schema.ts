import { CURRENCIES, PLATFORM_TYPES, PLATFORM_TYPE_LABELS, ASSET_TYPES } from "@/lib/constants/currencies";
import { parseArgentineNumber } from "@/lib/utils/format";

/**
 * The shape of the backup workbook, and the validation that guards a restore.
 *
 * The spreadsheet libraries are deliberately absent here: this module only ever
 * sees plain values, so it can be unit tested as a script, and the component
 * that touches a real file loads those libraries lazily.
 *
 * Columns are read by header *name* rather than position, so reordering or
 * adding a column in the sheet does not break an import.
 */

export const SHEET = {
  platforms: "Plataformas",
  categories: "Categorías",
  expenses: "Gastos",
  incomes: "Ingresos",
  investments: "Inversiones",
  trades: "Trading",
  snapshots: "Patrimonio",
  snapshotItems: "Patrimonio detalle",
} as const;

export type SheetKey = keyof typeof SHEET;

export const INSTRUCTIONS_SHEET = "Instrucciones";

export type CellType = "text" | "number" | "date" | "boolean";

export interface ColumnDef {
  key: string;
  header: string;
  type: CellType;
  width: number;
  /** Blank is allowed and means "no value". */
  optional?: boolean;
}

export const COLUMNS: Record<SheetKey, ColumnDef[]> = {
  platforms: [
    { key: "name", header: "nombre", type: "text", width: 22 },
    { key: "type", header: "tipo", type: "text", width: 20 },
    { key: "default_currency", header: "moneda", type: "text", width: 10 },
    { key: "is_active", header: "activa", type: "boolean", width: 10 },
  ],
  categories: [
    { key: "name", header: "nombre", type: "text", width: 22 },
    { key: "icon", header: "icono", type: "text", width: 10, optional: true },
    { key: "is_fixed", header: "es fija", type: "boolean", width: 10, optional: true },
    { key: "sort_order", header: "orden", type: "number", width: 10, optional: true },
  ],
  expenses: [
    { key: "date", header: "fecha", type: "date", width: 14 },
    { key: "amount", header: "monto", type: "number", width: 16 },
    { key: "currency", header: "moneda", type: "text", width: 10 },
    { key: "category", header: "categoría", type: "text", width: 20 },
    { key: "description", header: "descripción", type: "text", width: 32, optional: true },
    { key: "platform", header: "plataforma", type: "text", width: 22, optional: true },
  ],
  incomes: [
    { key: "date", header: "fecha", type: "date", width: 14 },
    { key: "amount", header: "monto", type: "number", width: 16 },
    { key: "currency", header: "moneda", type: "text", width: 10 },
    { key: "source", header: "fuente", type: "text", width: 20 },
    { key: "description", header: "descripción", type: "text", width: 32, optional: true },
    { key: "platform", header: "plataforma", type: "text", width: 22, optional: true },
  ],
  investments: [
    { key: "date", header: "fecha", type: "date", width: 14 },
    { key: "asset", header: "activo", type: "text", width: 16 },
    { key: "asset_type", header: "tipo", type: "text", width: 14 },
    { key: "total_amount", header: "total invertido", type: "number", width: 16 },
    { key: "price_per_unit", header: "precio por unidad", type: "number", width: 18 },
    { key: "units", header: "unidades", type: "number", width: 16, optional: true },
    { key: "currency", header: "moneda", type: "text", width: 10 },
    { key: "platform", header: "plataforma", type: "text", width: 22, optional: true },
    { key: "notes", header: "notas", type: "text", width: 30, optional: true },
  ],
  trades: [
    { key: "date", header: "fecha", type: "date", width: 14 },
    { key: "asset", header: "moneda", type: "text", width: 12 },
    { key: "direction", header: "tipo", type: "text", width: 10 },
    // Signed. A minus here is the difference between an income and a loss, so
    // the sheet carries it rather than deriving it from a separate column.
    { key: "pnl_usd", header: "PnL USD", type: "number", width: 14 },
    { key: "pnl_pct", header: "PnL %", type: "number", width: 10, optional: true },
    { key: "leverage", header: "apalancamiento", type: "number", width: 16, optional: true },
    { key: "platform", header: "plataforma", type: "text", width: 22, optional: true },
    { key: "notes", header: "notas", type: "text", width: 30, optional: true },
  ],
  snapshots: [
    { key: "date", header: "fecha", type: "date", width: 14 },
    { key: "total_ars", header: "total ARS", type: "number", width: 18 },
    { key: "notes", header: "notas", type: "text", width: 30, optional: true },
  ],
  snapshotItems: [
    { key: "date", header: "fecha del cierre", type: "date", width: 16 },
    { key: "platform", header: "plataforma", type: "text", width: 22 },
    { key: "currency", header: "moneda", type: "text", width: 10 },
    { key: "amount", header: "monto", type: "number", width: 18 },
  ],
};

export const SHEET_ORDER: SheetKey[] = [
  "platforms",
  "categories",
  "expenses",
  "incomes",
  "investments",
  "trades",
  "snapshots",
  "snapshotItems",
];

// ---------------------------------------------------------------------------
// The payload, in the shape the workbook carries it: platforms by name, never
// by id, because a spreadsheet cannot ask a person to type UUIDs.
// ---------------------------------------------------------------------------

export interface BackupPlatform {
  name: string;
  type: string;
  default_currency: string;
  is_active: boolean;
}
export interface BackupCategory {
  name: string;
  icon: string;
  is_fixed: boolean;
  sort_order: number;
}
export interface BackupExpense {
  date: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  platform: string | null;
}
export interface BackupIncome {
  date: string;
  amount: number;
  currency: string;
  source: string;
  description: string;
  platform: string | null;
}
export interface BackupInvestment {
  date: string;
  asset: string;
  asset_type: string;
  units: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  platform: string | null;
  notes: string | null;
}
export interface BackupTrade {
  date: string;
  asset: string;
  direction: string;
  /** Signed: negative is a loss. */
  pnl_usd: number;
  pnl_pct: number | null;
  leverage: number | null;
  platform: string | null;
  notes: string | null;
}
export interface BackupSnapshot {
  date: string;
  total_ars: number;
  notes: string | null;
}
export interface BackupSnapshotItem {
  date: string;
  platform: string;
  currency: string;
  amount: number;
}

export interface BackupData {
  platforms: BackupPlatform[];
  categories: BackupCategory[];
  expenses: BackupExpense[];
  incomes: BackupIncome[];
  investments: BackupInvestment[];
  trades: BackupTrade[];
  snapshots: BackupSnapshot[];
  snapshotItems: BackupSnapshotItem[];
}

export function emptyBackup(): BackupData {
  return {
    platforms: [],
    categories: [],
    expenses: [],
    incomes: [],
    investments: [],
    trades: [],
    snapshots: [],
    snapshotItems: [],
  };
}

export function countRows(data: BackupData): Record<SheetKey, number> {
  return {
    platforms: data.platforms.length,
    categories: data.categories.length,
    expenses: data.expenses.length,
    incomes: data.incomes.length,
    investments: data.investments.length,
    trades: data.trades.length,
    snapshots: data.snapshots.length,
    snapshotItems: data.snapshotItems.length,
  };
}

export function totalRows(data: BackupData): number {
  return Object.values(countRows(data)).reduce((sum, n) => sum + n, 0);
}

// ---------------------------------------------------------------------------
// Writing: plain values only. The component maps these onto library cells
// using `COLUMNS[sheet][i].type`.
// ---------------------------------------------------------------------------

export type CellValue = string | number | boolean | Date | null;

/** Header row plus one row per record, in `COLUMNS` order. */
export function sheetRows(sheet: SheetKey, data: BackupData): CellValue[][] {
  const columns = COLUMNS[sheet];
  const records = data[sheet] as unknown as Record<string, unknown>[];
  const header: CellValue[] = columns.map((column) => column.header);
  const body = records.map((record) =>
    columns.map((column) => {
      const value = record[column.key];
      if (value === undefined || value === null) return null;
      if (column.type === "date") return isoToUtcDate(String(value));
      return value as CellValue;
    })
  );
  return [header, ...body];
}

/**
 * `YYYY-MM-DD` to a Date at UTC midnight.
 *
 * Excel stores a date as a day number with no zone, and the reader hands it
 * back at UTC midnight. Building it the same way keeps a round trip on the same
 * calendar day — a local-midnight Date would shift a day west of Greenwich.
 */
export function isoToUtcDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export const INSTRUCTIONS: string[][] = [
  ["Cómo usar esta plantilla"],
  [],
  ["1.", "Llená una fila por movimiento en cada hoja. No borres la fila de encabezados."],
  ["2.", "En Ajustes, tocá «Importar datos» y elegí este archivo."],
  [
    "3.",
    "La importación REEMPLAZA todos tus datos por los de este archivo. Antes de borrar nada se descarga un respaldo de lo que tenías.",
  ],
  [],
  ["Referencias entre hojas"],
  [
    "",
    "La columna «plataforma» tiene que coincidir con un nombre de la hoja Plataformas. Si la dejás vacía, el movimiento queda sin plataforma.",
  ],
  [
    "",
    "En «Patrimonio detalle», la «fecha del cierre» tiene que coincidir con una fecha de la hoja Patrimonio, y la plataforma es obligatoria.",
  ],
  [],
  ["Formatos"],
  ["", "Fechas: 2026-08-01 (año-mes-día). También se acepta 01/08/2026."],
  ["", "Montos: solo números, mayores a cero en gastos e ingresos."],
  ["", "En Inversiones, «unidades» se calcula solo si la dejás vacía (total ÷ precio por unidad)."],
  [],
  ["Hoja Trading"],
  [
    "",
    "«PnL USD» va con signo: positivo es ganancia, negativo es pérdida. Cero no se acepta.",
  ],
  [
    "",
    "Las ganancias se cuentan como ingreso solas, con fuente «Investment Returns». No las cargues también en la hoja Ingresos o van a contarse dos veces.",
  ],
  [
    "",
    "Las pérdidas no son gastos. Sólo bajan el patrimonio estimado, así que no van en la hoja Gastos.",
  ],
  ["", "«moneda» es el activo que operaste (BTC, ETH, SOL), no la moneda del PnL."],
  [],
  ["Valores válidos"],
  ["", "Monedas", CURRENCIES.join(", ")],
  ["", "Tipo de plataforma", PLATFORM_TYPES.join(", ")],
  ["", "", PLATFORM_TYPES.map((type) => PLATFORM_TYPE_LABELS[type]).join(", ")],
  ["", "Tipo de activo", ASSET_TYPES.join(", ")],
  ["", "Tipo de operación", "long, short"],
  ["", "Categoría y fuente", "Texto libre. Usá los mismos nombres que ves en la app."],
];

// ---------------------------------------------------------------------------
// Reading every row out of a table
// ---------------------------------------------------------------------------

/** PostgREST's default page. A project with `db-max-rows` set caps at this. */
export const PAGE_SIZE = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: { code?: string; message: string } | null;
}

/**
 * Reads every page of a table and refuses to return a short answer.
 *
 * Both halves are load-bearing for a backup. Without paging, a project that
 * caps rows returns the first page and nothing says so. Without the error
 * check, a failed query is an empty array — which gets written to the sheet as
 * "you have no expenses", and a restore from that file then deletes them.
 *
 * The page reader is injected so this can be tested without a database, which
 * is the whole reason it lives here rather than inside the component.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  label: string,
  options: { tolerateMissingCodes?: readonly string[]; pageSize?: number } = {}
): Promise<{ rows: T[]; missing: boolean }> {
  const size = options.pageSize ?? PAGE_SIZE;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) {
      if (error.code && options.tolerateMissingCodes?.includes(error.code)) {
        return { rows: [], missing: true };
      }
      throw new Error(`No se pudo leer «${label}»: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    // A full page might be the last one; the next read settles it.
    if (page.length < size) return { rows, missing: false };
  }
}

// ---------------------------------------------------------------------------
// Reading and validating
// ---------------------------------------------------------------------------

export interface RawSheet {
  sheet: string;
  data: unknown[][];
}

export interface BackupIssue {
  sheet: string;
  /** 1-based row as the spreadsheet numbers it, so it can be found by eye. */
  row: number | null;
  message: string;
}

export interface ParseResult {
  data: BackupData | null;
  issues: BackupIssue[];
}

const PLATFORM_TYPE_BY_LABEL = new Map(
  PLATFORM_TYPES.map((type) => [PLATFORM_TYPE_LABELS[type].toLowerCase(), type as string])
);

function normalise(value: unknown): string {
  return String(value ?? "").trim();
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || normalise(value) === "";
}

/** A date cell: a real Date, `YYYY-MM-DD`, or the `DD/MM/YYYY` people type. */
export function readDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const text = normalise(value);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

/** A number cell, tolerating the `1.234,56` a person types into a spreadsheet. */
export function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = normalise(value);
  if (text === "") return null;
  const parsed = /[.,]/.test(text) ? parseArgentineNumber(text) : Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A boolean cell. Blank counts as true for `activa`, which is the DB default. */
export function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  const text = normalise(value).toLowerCase();
  if (text === "") return fallback;
  if (["sí", "si", "true", "verdadero", "1", "x", "yes"].includes(text)) return true;
  if (["no", "false", "falso", "0"].includes(text)) return false;
  return fallback;
}

/** Maps header names to column indices, so column order does not matter. */
function headerIndex(headerRow: unknown[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const name = normalise(cell).toLowerCase();
    if (name && !index.has(name)) index.set(name, i);
  });
  return index;
}

/**
 * Validates the whole workbook and returns the payload only when nothing is
 * wrong with it. Nothing may be deleted on the strength of a partial read, so
 * this deliberately has no "import what parsed" mode.
 */
export function parseBackupWorkbook(sheets: RawSheet[]): ParseResult {
  const issues: BackupIssue[] = [];
  const bySheetName = new Map(sheets.map((sheet) => [sheet.sheet.trim().toLowerCase(), sheet]));
  const data = emptyBackup();

  // Every sheet has to be present. A restore replaces everything, so a missing
  // sheet would silently wipe that table instead of leaving it alone.
  const found: Partial<Record<SheetKey, { rows: unknown[][]; index: Map<string, number> }>> = {};
  for (const key of SHEET_ORDER) {
    const name = SHEET[key];
    const sheet = bySheetName.get(name.toLowerCase());
    if (!sheet) {
      issues.push({ sheet: name, row: null, message: `Falta la hoja «${name}».` });
      continue;
    }
    const rows = sheet.data ?? [];
    if (rows.length === 0) {
      issues.push({ sheet: name, row: null, message: `La hoja «${name}» no tiene encabezados.` });
      continue;
    }
    const index = headerIndex(rows[0]);
    for (const column of COLUMNS[key]) {
      if (!index.has(column.header.toLowerCase())) {
        issues.push({
          sheet: name,
          row: 1,
          message: `Falta la columna «${column.header}».`,
        });
      }
    }
    found[key] = { rows, index };
  }
  if (issues.length > 0) return { data: null, issues };

  const cell = (key: SheetKey, row: unknown[], header: string): unknown => {
    const i = found[key]!.index.get(header.toLowerCase())!;
    return row[i];
  };
  /** Body rows, skipping ones that are entirely blank. */
  const body = (key: SheetKey): { row: unknown[]; line: number }[] =>
    found[key]!.rows.slice(1)
      .map((row, i) => ({ row, line: i + 2 }))
      .filter(({ row }) => row.some((value) => !isBlank(value)));

  const add = (key: SheetKey, line: number, message: string) =>
    issues.push({ sheet: SHEET[key], row: line, message });

  // --- Platforms: everything else resolves against these names -------------
  const platformNames = new Set<string>();
  for (const { row, line } of body("platforms")) {
    const name = normalise(cell("platforms", row, "nombre"));
    if (!name) {
      add("platforms", line, "El nombre es obligatorio.");
      continue;
    }
    if (platformNames.has(name.toLowerCase())) {
      add("platforms", line, `La plataforma «${name}» está repetida.`);
      continue;
    }
    const rawType = normalise(cell("platforms", row, "tipo"));
    const type =
      (PLATFORM_TYPES as readonly string[]).includes(rawType)
        ? rawType
        : PLATFORM_TYPE_BY_LABEL.get(rawType.toLowerCase());
    if (!type) {
      add("platforms", line, `Tipo «${rawType}» inválido. Válidos: ${PLATFORM_TYPES.join(", ")}.`);
      continue;
    }
    const currency = normalise(cell("platforms", row, "moneda")).toUpperCase() || "ARS";
    if (!(CURRENCIES as readonly string[]).includes(currency)) {
      add("platforms", line, `Moneda «${currency}» inválida.`);
      continue;
    }
    platformNames.add(name.toLowerCase());
    data.platforms.push({
      name,
      type,
      default_currency: currency,
      is_active: readBoolean(cell("platforms", row, "activa"), true),
    });
  }

  /** Resolves an optional platform reference; null when the cell is blank. */
  const platformRef = (
    key: SheetKey,
    row: unknown[],
    line: number,
    required: boolean
  ): string | null | undefined => {
    const name = normalise(cell(key, row, "plataforma"));
    if (!name) {
      if (required) {
        add(key, line, "La plataforma es obligatoria.");
        return undefined;
      }
      return null;
    }
    if (!platformNames.has(name.toLowerCase())) {
      add(key, line, `La plataforma «${name}» no está en la hoja «${SHEET.platforms}».`);
      return undefined;
    }
    return name;
  };

  // --- Categories ---------------------------------------------------------
  const categoryNames = new Set<string>();
  for (const { row, line } of body("categories")) {
    const name = normalise(cell("categories", row, "nombre"));
    if (!name) {
      add("categories", line, "El nombre es obligatorio.");
      continue;
    }
    if (categoryNames.has(name.toLowerCase())) {
      add("categories", line, `La categoría «${name}» está repetida.`);
      continue;
    }
    categoryNames.add(name.toLowerCase());
    data.categories.push({
      name,
      icon: normalise(cell("categories", row, "icono")) || "📌",
      is_fixed: readBoolean(cell("categories", row, "es fija"), false),
      sort_order: readNumber(cell("categories", row, "orden")) ?? data.categories.length,
    });
  }

  // --- Expenses and incomes ----------------------------------------------
  for (const kind of ["expenses", "incomes"] as const) {
    const labelColumn = kind === "expenses" ? "categoría" : "fuente";
    for (const { row, line } of body(kind)) {
      const date = readDate(cell(kind, row, "fecha"));
      if (!date) {
        add(kind, line, "Fecha inválida. Usá 2026-08-01.");
        continue;
      }
      const amount = readNumber(cell(kind, row, "monto"));
      if (amount === null) {
        add(kind, line, "Monto inválido.");
        continue;
      }
      if (amount <= 0) {
        add(kind, line, "El monto tiene que ser mayor a cero.");
        continue;
      }
      const currency = normalise(cell(kind, row, "moneda")).toUpperCase();
      if (!(CURRENCIES as readonly string[]).includes(currency)) {
        add(kind, line, `Moneda «${currency}» inválida. Válidas: ${CURRENCIES.join(", ")}.`);
        continue;
      }
      const label = normalise(cell(kind, row, labelColumn));
      if (!label) {
        add(kind, line, `«${labelColumn}» es obligatorio.`);
        continue;
      }
      const platform = platformRef(kind, row, line, false);
      if (platform === undefined) continue;
      const record = {
        date,
        amount,
        currency,
        description: normalise(cell(kind, row, "descripción")),
        platform,
      };
      if (kind === "expenses") data.expenses.push({ ...record, category: label });
      else data.incomes.push({ ...record, source: label });
    }
  }

  // --- Investments -------------------------------------------------------
  for (const { row, line } of body("investments")) {
    const date = readDate(cell("investments", row, "fecha"));
    if (!date) {
      add("investments", line, "Fecha inválida. Usá 2026-08-01.");
      continue;
    }
    const asset = normalise(cell("investments", row, "activo"));
    if (!asset) {
      add("investments", line, "El activo es obligatorio.");
      continue;
    }
    const assetType = normalise(cell("investments", row, "tipo")).toLowerCase();
    if (!(ASSET_TYPES as readonly string[]).includes(assetType)) {
      add("investments", line, `Tipo «${assetType}» inválido. Válidos: ${ASSET_TYPES.join(", ")}.`);
      continue;
    }
    const total = readNumber(cell("investments", row, "total invertido"));
    const price = readNumber(cell("investments", row, "precio por unidad"));
    if (total === null || price === null) {
      add("investments", line, "«total invertido» y «precio por unidad» son obligatorios.");
      continue;
    }
    const currency = normalise(cell("investments", row, "moneda")).toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(currency)) {
      add("investments", line, `Moneda «${currency}» inválida.`);
      continue;
    }
    const platform = platformRef("investments", row, line, false);
    if (platform === undefined) continue;
    // Same derivation the investment form uses, so a blank cell behaves as if
    // the row had been typed into the app.
    const units = readNumber(cell("investments", row, "unidades")) ?? (price > 0 ? total / price : 0);
    data.investments.push({
      date,
      asset,
      asset_type: assetType,
      units,
      price_per_unit: price,
      total_amount: total,
      currency,
      platform,
      notes: normalise(cell("investments", row, "notas")) || null,
    });
  }

  // --- Trading book ------------------------------------------------------
  for (const { row, line } of body("trades")) {
    const date = readDate(cell("trades", row, "fecha"));
    if (!date) {
      add("trades", line, "Fecha inválida. Usá 2026-08-01.");
      continue;
    }
    const asset = normalise(cell("trades", row, "moneda"));
    if (!asset) {
      add("trades", line, "La moneda operada es obligatoria.");
      continue;
    }
    const direction = normalise(cell("trades", row, "tipo")).toLowerCase();
    if (direction !== "long" && direction !== "short") {
      add("trades", line, `Tipo «${direction}» inválido. Válidos: long, short.`);
      continue;
    }
    const pnl = readNumber(cell("trades", row, "PnL USD"));
    if (pnl === null) {
      add("trades", line, "«PnL USD» es obligatorio.");
      continue;
    }
    // The sign is the whole point of the column, and zero has no side.
    if (pnl === 0) {
      add("trades", line, "El PnL tiene que ser distinto de cero. Usá un menos para una pérdida.");
      continue;
    }
    const leverage = readNumber(cell("trades", row, "apalancamiento"));
    if (leverage !== null && leverage <= 0) {
      add("trades", line, "El apalancamiento tiene que ser mayor a cero.");
      continue;
    }
    const platform = platformRef("trades", row, line, false);
    if (platform === undefined) continue;
    data.trades.push({
      date,
      asset,
      direction,
      pnl_usd: pnl,
      pnl_pct: readNumber(cell("trades", row, "PnL %")),
      leverage,
      platform,
      notes: normalise(cell("trades", row, "notas")) || null,
    });
  }

  // --- Snapshots and their breakdown -------------------------------------
  const snapshotDates = new Set<string>();
  for (const { row, line } of body("snapshots")) {
    const date = readDate(cell("snapshots", row, "fecha"));
    if (!date) {
      add("snapshots", line, "Fecha inválida. Usá 2026-08-01.");
      continue;
    }
    if (snapshotDates.has(date)) {
      add("snapshots", line, `Ya hay un cierre con fecha ${date}.`);
      continue;
    }
    const total = readNumber(cell("snapshots", row, "total ARS"));
    if (total === null) {
      add("snapshots", line, "«total ARS» es obligatorio.");
      continue;
    }
    snapshotDates.add(date);
    data.snapshots.push({
      date,
      total_ars: total,
      notes: normalise(cell("snapshots", row, "notas")) || null,
    });
  }

  for (const { row, line } of body("snapshotItems")) {
    const date = readDate(cell("snapshotItems", row, "fecha del cierre"));
    if (!date) {
      add("snapshotItems", line, "Fecha inválida. Usá 2026-08-01.");
      continue;
    }
    if (!snapshotDates.has(date)) {
      add("snapshotItems", line, `No hay un cierre con fecha ${date} en la hoja «${SHEET.snapshots}».`);
      continue;
    }
    const platform = platformRef("snapshotItems", row, line, true);
    if (platform === undefined) continue;
    const currency = normalise(cell("snapshotItems", row, "moneda")).toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(currency)) {
      add("snapshotItems", line, `Moneda «${currency}» inválida.`);
      continue;
    }
    const amount = readNumber(cell("snapshotItems", row, "monto"));
    if (amount === null) {
      add("snapshotItems", line, "Monto inválido.");
      continue;
    }
    data.snapshotItems.push({ date, platform: platform!, currency, amount });
  }

  if (issues.length > 0) return { data: null, issues };
  return { data, issues: [] };
}
