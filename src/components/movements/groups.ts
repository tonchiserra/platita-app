import type { HistoricalConverter } from "@/lib/utils/currency-conversion";
import type { ListRow, MonthGroup } from "./MovementList";

/** Rows newest first → one group per month with its totals in ARS and USD. */
export function groupByMonth(rows: readonly ListRow[], conv: Pick<HistoricalConverter, "toArs" | "toUsd">): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    let g = groups.get(month);
    if (!g) {
      g = { month, totalArs: 0, totalUsd: 0, rows: [] };
      groups.set(month, g);
    }
    g.rows.push(row);
    g.totalArs += conv.toArs(row);
    g.totalUsd += conv.toUsd(row);
  }
  return [...groups.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}
