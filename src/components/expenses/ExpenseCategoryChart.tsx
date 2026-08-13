"use client";

import { BreakdownPanel } from "@/components/shared/BreakdownPanel";
import { CATEGORY_COLORS } from "@/lib/constants/colors";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface ExpenseCategoryChartProps {
  data: CategoryData[];
  total: number;
  change?: number;
  /** Category name → glyph, resolved from the user's own list. */
  icons?: Record<string, string>;
}

export function ExpenseCategoryChart({ data, total, change, icons }: ExpenseCategoryChartProps) {
  return (
    <BreakdownPanel
      title="Gastos por categoría"
      items={data.map((d) => ({
        label: d.category,
        amount: d.amount,
        percentage: d.percentage,
      }))}
      total={total}
      totalLabel="en total"
      change={change}
      invertChange
      palette={CATEGORY_COLORS}
      emptyMessage="Sin gastos este mes"
      iconFor={(label) => icons?.[label]}
    />
  );
}
