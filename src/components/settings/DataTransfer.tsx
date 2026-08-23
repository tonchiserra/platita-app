"use client";

import { useRef, useState } from "react";
import { Box, Button, Flex, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type {
  Expense,
  ExpenseCategoryRow,
  Income,
  Investment,
  PatrimonySnapshot,
  Platform,
  Trade,
} from "@/types/database";
import {
  COLUMNS,
  INSTRUCTIONS,
  INSTRUCTIONS_SHEET,
  SHEET,
  SHEET_ORDER,
  countRows,
  emptyBackup,
  fetchAllPages,
  parseBackupWorkbook,
  sheetRows,
  totalRows,
  type BackupData,
  type BackupIssue,
  type CellValue,
  type SheetKey,
} from "@/lib/utils/backup-schema";

/**
 * "That table does not exist" — the case of a migration not being applied yet,
 * which is true of `expense_categories` (002) and `trades` (003).
 *
 * Two codes, because they come from different layers: PostgREST answers
 * `PGRST205` when the table is absent from its schema cache, which is what the
 * REST API actually returns, while `42P01` is the raw Postgres code that
 * surfaces when the cache is stale but the query still reaches the database.
 */
const MISSING_TABLE_CODES = ["PGRST205", "42P01"] as const;

const SHEET_LABEL: Record<SheetKey, { one: string; many: string }> = {
  platforms: { one: "plataforma", many: "plataformas" },
  categories: { one: "categoría", many: "categorías" },
  expenses: { one: "gasto", many: "gastos" },
  incomes: { one: "ingreso", many: "ingresos" },
  investments: { one: "inversión", many: "inversiones" },
  trades: { one: "operación", many: "operaciones" },
  snapshots: { one: "cierre de patrimonio", many: "cierres de patrimonio" },
  snapshotItems: { one: "fila de detalle", many: "filas de detalle" },
};

/** "1 ingreso" rather than "1 ingresos". */
function tally(counts: Record<SheetKey, number>): string {
  return SHEET_ORDER.filter((key) => counts[key] > 0)
    .map((key) => `${counts[key]} ${counts[key] === 1 ? SHEET_LABEL[key].one : SHEET_LABEL[key].many}`)
    .join(", ");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds the workbook and hands it to the browser as a download.
 *
 * The spreadsheet libraries are imported here rather than at module scope so
 * they stay out of the settings page's initial bundle.
 */
async function downloadWorkbook(data: BackupData, fileName: string, withInstructions: boolean) {
  // The package has no root export, only `/browser`, `/node` and `/universal`.
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  interface WorkbookSheet {
    sheet: string;
    data: unknown[][];
    columns: { width: number }[];
    stickyRowsCount: number;
  }

  const sheets: WorkbookSheet[] = SHEET_ORDER.map((key) => {
    const columns = COLUMNS[key];
    const rows = sheetRows(key, data);
    return {
      sheet: SHEET[key],
      // Row 0 is the header; the rest carry the column's declared type so
      // numbers and dates arrive as numbers and dates, not text.
      data: rows.map((row, rowIndex) =>
        row.map((value: CellValue, columnIndex) => {
          if (rowIndex === 0) return { value, fontWeight: "bold" as const };
          const type = columns[columnIndex].type;
          if (type === "date") {
            return { value: value as Date | null, type: Date, format: "yyyy-mm-dd" };
          }
          if (type === "number") return { value: value as number | null, type: Number };
          if (type === "boolean") return { value: value as boolean | null, type: Boolean };
          return { value: value === null ? null : String(value), type: String };
        })
      ),
      columns: columns.map((column) => ({ width: column.width })),
      stickyRowsCount: 1,
    };
  });

  if (withInstructions) {
    sheets.push({
      sheet: INSTRUCTIONS_SHEET,
      data: INSTRUCTIONS.map((row) =>
        row.map((value) => ({ value: String(value), type: String }))
      ),
      columns: [{ width: 6 }, { width: 30 }, { width: 70 }],
      stickyRowsCount: 1,
    });
  }

  await writeXlsxFile(sheets as Parameters<typeof writeXlsxFile>[0]).toFile(fileName);
}

/** One table, read whole, through the tested pager. */
function fetchAll<T>(
  table: string,
  columns: string,
  order: string,
  filter?: { column: string; value: string },
  tolerateMissing = false
) {
  const supabase = createClient();
  return fetchAllPages<T>(
    async (from, to) => {
      let query = supabase.from(table).select(columns).order(order).range(from, to);
      if (filter) query = query.eq(filter.column, filter.value);
      const { data, error } = await query;
      return { data: data as T[] | null, error };
    },
    table,
    // The one tolerated failure: `expense_categories` before migration 002.
    tolerateMissing ? { tolerateMissingCodes: MISSING_TABLE_CODES } : {}
  );
}

/** Everything the account holds, with platforms resolved to their names. */
async function fetchBackup(): Promise<{
  data: BackupData;
  missingCategories: boolean;
  missingTrades: boolean;
  droppedItems: number;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  const id = user.id;

  // The breakdown is fetched on its own rather than nested under the closes: a
  // nested select is subject to its own row cap, and losing breakdown rows
  // silently is the same failure this function exists to prevent. Its RLS
  // already scopes it to rows whose parent close belongs to this user.
  const [platforms, categories, expenses, incomes, investments, trades, snapshots, items] =
    await Promise.all([
      fetchAll<Platform>("platforms", "*", "name", { column: "user_id", value: id }),
      fetchAll<ExpenseCategoryRow>(
        "expense_categories",
        "*",
        "sort_order",
        { column: "user_id", value: id },
        true
      ),
      fetchAll<Expense>("expenses", "*", "date", { column: "user_id", value: id }),
      fetchAll<Income>("incomes", "*", "date", { column: "user_id", value: id }),
      fetchAll<Investment>("investments", "*", "date", { column: "user_id", value: id }),
      // Tolerated like the categories above: migration 003 may not be applied.
      fetchAll<Trade>("trades", "*", "date", { column: "user_id", value: id }, true),
      fetchAll<PatrimonySnapshot>("patrimony_snapshots", "*", "date", {
        column: "user_id",
        value: id,
      }),
      fetchAll<{ snapshot_id: string; platform_id: string; currency: string; amount: number }>(
        "patrimony_snapshot_items",
        "snapshot_id, platform_id, currency, amount",
        "snapshot_id"
      ),
    ]);

  const nameById = new Map<string, string>(platforms.rows.map((row) => [row.id, row.name]));

  const data = emptyBackup();
  data.platforms = platforms.rows.map((row) => ({
    name: row.name,
    type: row.type,
    default_currency: row.default_currency,
    is_active: row.is_active,
  }));
  data.categories = categories.rows.map((row) => ({
    name: row.name,
    icon: row.icon,
    is_fixed: row.is_fixed,
    sort_order: row.sort_order,
  }));
  data.expenses = expenses.rows.map((row) => ({
    date: row.date,
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category,
    description: row.description ?? "",
    platform: row.platform_id ? nameById.get(row.platform_id) ?? null : null,
  }));
  data.incomes = incomes.rows.map((row) => ({
    date: row.date,
    amount: Number(row.amount),
    currency: row.currency,
    source: row.source,
    description: row.description ?? "",
    platform: row.platform_id ? nameById.get(row.platform_id) ?? null : null,
  }));
  data.investments = investments.rows.map((row) => ({
    date: row.date,
    asset: row.asset,
    asset_type: row.asset_type,
    units: Number(row.units),
    price_per_unit: Number(row.price_per_unit),
    total_amount: Number(row.total_amount),
    currency: row.currency,
    platform: row.platform_id ? nameById.get(row.platform_id) ?? null : null,
    notes: row.notes ?? null,
  }));
  data.trades = trades.rows.map((row) => ({
    date: row.date,
    asset: row.asset,
    direction: row.direction,
    pnl_usd: Number(row.pnl_usd),
    pnl_pct: row.pnl_pct === null ? null : Number(row.pnl_pct),
    leverage: row.leverage === null ? null : Number(row.leverage),
    platform: row.platform_id ? nameById.get(row.platform_id) ?? null : null,
    notes: row.notes ?? null,
  }));

  const dateBySnapshotId = new Map<string, string>();
  for (const snapshot of snapshots.rows) {
    dateBySnapshotId.set(snapshot.id, snapshot.date);
    data.snapshots.push({
      date: snapshot.date,
      total_ars: Number(snapshot.total_ars),
      notes: snapshot.notes ?? null,
    });
  }
  for (const item of items.rows) {
    const date = dateBySnapshotId.get(item.snapshot_id);
    const platform = nameById.get(item.platform_id);
    // A breakdown row whose close or platform is not in this backup cannot be
    // written as a row that would import, so it is counted as dropped instead
    // of quietly disappearing.
    if (!date || !platform) continue;
    data.snapshotItems.push({
      date,
      platform,
      currency: item.currency,
      amount: Number(item.amount),
    });
  }
  const droppedItems = items.rows.length - data.snapshotItems.length;

  return {
    data,
    missingCategories: categories.missing,
    missingTrades: trades.missing,
    droppedItems,
  };
}

export function DataTransfer() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<null | "export" | "template" | "read" | "import">(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [issues, setIssues] = useState<BackupIssue[]>([]);
  const [pending, setPending] = useState<BackupData | null>(null);
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setError("");
    setNotice("");
    setIssues([]);
  };

  const handleExport = async () => {
    reset();
    setBusy("export");
    try {
      const { data, missingCategories, missingTrades, droppedItems } = await fetchBackup();
      await downloadWorkbook(data, `platita-datos-${today()}.xlsx`, false);
      const counts = countRows(data);
      setNotice(
        `Se exportaron ${totalRows(data)} filas: ` +
          SHEET_ORDER.map(
            (key) => `${counts[key]} ${counts[key] === 1 ? SHEET_LABEL[key].one : SHEET_LABEL[key].many}`
          ).join(", ") +
          "." +
          (missingCategories
            ? " Tus categorías no se incluyeron porque la migración 002 todavía no está aplicada."
            : "") +
          (missingTrades
            ? " Tu libro de trading no se incluyó porque la migración 003 todavía no está aplicada."
            : "") +
          (droppedItems > 0
            ? ` Se omitieron ${droppedItems} filas de detalle cuyo cierre o plataforma ya no existe.`
            : "")
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo exportar.");
    }
    setBusy(null);
  };

  const handleTemplate = async () => {
    reset();
    setBusy("template");
    try {
      await downloadWorkbook(emptyBackup(), "platita-plantilla.xlsx", true);
      setNotice("Plantilla descargada. Llenala y volvé con «Importar datos».");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar la plantilla.");
    }
    setBusy(null);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear it so choosing the same file twice fires a change event again.
    event.target.value = "";
    if (!file) return;

    reset();
    setPending(null);
    setBusy("read");
    try {
      const readXlsxFile = (await import("read-excel-file/browser")).default;
      // One read returns every sheet as `{ sheet, data }`.
      const sheets = (await readXlsxFile(file)) as unknown as {
        sheet: string;
        data: unknown[][];
      }[];
      const result = parseBackupWorkbook(sheets);
      if (!result.data) {
        setIssues(result.issues);
        setBusy(null);
        return;
      }
      if (totalRows(result.data) === 0) {
        setError("El archivo no tiene ninguna fila para importar.");
        setBusy(null);
        return;
      }
      setPending(result.data);
      setConfirming(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `No se pudo leer el archivo: ${caught.message}`
          : "No se pudo leer el archivo."
      );
    }
    setBusy(null);
  };

  /**
   * Replaces everything. There are no transactions from the browser, so the
   * order matters and a backup is downloaded first: if this breaks halfway, the
   * previous state is already on disk.
   */
  const handleImport = async () => {
    if (!pending) return;
    reset();
    setBusy("import");
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const id = user!.id;

      const { data: before } = await fetchBackup();
      if (totalRows(before) > 0) {
        await downloadWorkbook(before, `platita-respaldo-antes-de-importar-${today()}.xlsx`, false);
      }

      const fail = (step: string, message: string) => {
        throw new Error(`${step}: ${message}`);
      };

      // Closes first — their breakdown goes with them by cascade. Platforms
      // last, because deleting one cascades away the breakdown rows too.
      for (const table of [
        "patrimony_snapshots",
        "expenses",
        "incomes",
        "investments",
        "trades",
        "expense_categories",
        "platforms",
      ] as const) {
        const { error: deleteError } = await supabase.from(table).delete().eq("user_id", id);
        if (deleteError && !MISSING_TABLE_CODES.includes(deleteError.code)) {
          fail(`Borrando ${table}`, deleteError.message);
        }
      }

      // Platforms come back first: everything else references them by id.
      const platformIdByName = new Map<string, string>();
      if (pending.platforms.length > 0) {
        const { data: inserted, error: platformError } = await supabase
          .from("platforms")
          .insert(pending.platforms.map((row) => ({ ...row, user_id: id })))
          .select("id, name");
        if (platformError) fail("Insertando plataformas", platformError.message);
        for (const row of (inserted ?? []) as { id: string; name: string }[]) {
          platformIdByName.set(row.name.toLowerCase(), row.id);
        }
      }
      const platformId = (name: string | null) =>
        name ? platformIdByName.get(name.toLowerCase()) ?? null : null;

      if (pending.categories.length > 0) {
        const { error: categoryError } = await supabase
          .from("expense_categories")
          .insert(pending.categories.map((row) => ({ ...row, user_id: id })));
        if (categoryError && !MISSING_TABLE_CODES.includes(categoryError.code)) {
          fail("Insertando categorías", categoryError.message);
        }
      }

      if (pending.expenses.length > 0) {
        const { error: expenseError } = await supabase.from("expenses").insert(
          pending.expenses.map(({ platform, ...row }) => ({
            ...row,
            user_id: id,
            platform_id: platformId(platform),
          }))
        );
        if (expenseError) fail("Insertando gastos", expenseError.message);
      }

      if (pending.incomes.length > 0) {
        const { error: incomeError } = await supabase.from("incomes").insert(
          pending.incomes.map(({ platform, ...row }) => ({
            ...row,
            user_id: id,
            platform_id: platformId(platform),
          }))
        );
        if (incomeError) fail("Insertando ingresos", incomeError.message);
      }

      if (pending.investments.length > 0) {
        const { error: investmentError } = await supabase.from("investments").insert(
          pending.investments.map(({ platform, ...row }) => ({
            ...row,
            user_id: id,
            platform_id: platformId(platform),
          }))
        );
        if (investmentError) fail("Insertando inversiones", investmentError.message);
      }

      if (pending.trades.length > 0) {
        const { error: tradeError } = await supabase.from("trades").insert(
          pending.trades.map(({ platform, ...row }) => ({
            ...row,
            user_id: id,
            platform_id: platformId(platform),
          }))
        );
        // Same tolerance as the categories: without migration 003 there is no
        // table to put these in, and that must not abort the whole restore.
        if (tradeError && !MISSING_TABLE_CODES.includes(tradeError.code)) {
          fail("Insertando operaciones", tradeError.message);
        }
      }

      if (pending.snapshots.length > 0) {
        const { data: inserted, error: snapshotError } = await supabase
          .from("patrimony_snapshots")
          .insert(pending.snapshots.map((row) => ({ ...row, user_id: id })))
          .select("id, date");
        if (snapshotError) fail("Insertando cierres", snapshotError.message);

        const snapshotIdByDate = new Map<string, string>(
          ((inserted ?? []) as { id: string; date: string }[]).map((row) => [row.date, row.id])
        );
        const items = pending.snapshotItems
          .map((item) => ({
            snapshot_id: snapshotIdByDate.get(item.date),
            platform_id: platformId(item.platform),
            currency: item.currency,
            amount: item.amount,
          }))
          // Both are guaranteed by validation; this keeps a bad row from
          // becoming a null that the not-null constraint would reject anyway.
          .filter((item) => item.snapshot_id && item.platform_id);
        if (items.length > 0) {
          const { error: itemError } = await supabase
            .from("patrimony_snapshot_items")
            .insert(items);
          if (itemError) fail("Insertando detalle de cierres", itemError.message);
        }
      }

      setNotice(`Datos reemplazados: ${tally(countRows(pending))}.`);
      setPending(null);
      router.refresh();
    } catch (caught) {
      setError(
        (caught instanceof Error ? caught.message : "Falló la importación.") +
          " Se descargó un respaldo con tus datos anteriores antes de empezar."
      );
    }
    setBusy(null);
  };

  const counts = pending ? countRows(pending) : null;

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading" mb="1">
        Tus datos
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="4">
        Exportá todo a una planilla, o cargá movimientos en masa con la plantilla
      </Text>

      <Flex gap="3" wrap="wrap">
        <Button
          size="sm"
          borderRadius="l2"
          bg="bg.sunk"
          color="fg.heading"
          _hover={{ bg: "bg.hover" }}
          loading={busy === "export"}
          disabled={busy !== null}
          onClick={handleExport}
        >
          Exportar datos
        </Button>
        <Button
          size="sm"
          borderRadius="l2"
          bg="bg.sunk"
          color="fg.heading"
          _hover={{ bg: "bg.hover" }}
          loading={busy === "template"}
          disabled={busy !== null}
          onClick={handleTemplate}
        >
          Descargar plantilla
        </Button>
        <Button
          size="sm"
          borderRadius="l2"
          bg="bg.sunk"
          color="fg.heading"
          _hover={{ bg: "bg.hover" }}
          loading={busy === "read" || busy === "import"}
          disabled={busy !== null}
          onClick={() => fileInput.current?.click()}
        >
          Importar datos
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx"
          hidden
          onChange={handleFile}
          aria-label="Elegir la planilla a importar"
        />
      </Flex>

      <Text fontSize="2xs" color="fg.muted" mt="3">
        Importar reemplaza todos tus datos por los del archivo. Antes de borrar nada se descarga un
        respaldo de lo que tenías.
      </Text>

      {notice && (
        <Text fontSize="xs" color="trend.up" mt="3">
          {notice}
        </Text>
      )}
      {error && (
        <Text fontSize="xs" color="trend.down" mt="3">
          {error}
        </Text>
      )}

      {issues.length > 0 && (
        <Box mt="4" bg="bg.sunk" borderRadius="lg" border="1px solid" borderColor="border.card" p="4">
          <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="2">
            No se importó nada. Revisá {issues.length === 1 ? "este problema" : `estos ${issues.length} problemas`}:
          </Text>
          <VStack align="stretch" gap="1">
            {issues.slice(0, 15).map((issue, i) => (
              <Text key={i} fontSize="xs" color="fg.body">
                <Text as="span" fontFamily="mono" color="fg.muted" data-num>
                  {issue.sheet}
                  {issue.row !== null ? `, fila ${issue.row}` : ""}
                </Text>
                {" — "}
                {issue.message}
              </Text>
            ))}
            {issues.length > 15 && (
              <Text fontSize="xs" color="fg.muted">
                …y {issues.length - 15} más.
              </Text>
            )}
          </VStack>
        </Box>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleImport}
        title="¿Reemplazar todos tus datos?"
        confirmLabel="Reemplazar"
        description={
          counts
            ? `Se van a borrar todos tus datos actuales y quedar únicamente los del archivo: ${tally(counts)}. Antes de borrar se descarga un respaldo de lo que tenés ahora. Esta acción no se puede deshacer desde la app.`
            : undefined
        }
      />
    </Box>
  );
}
