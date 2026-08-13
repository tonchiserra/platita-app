"use client";

import { BreakdownPanel } from "@/components/shared/BreakdownPanel";
import { CATEGORY_COLORS } from "@/lib/constants/colors";

interface SourceData {
  source: string;
  amount: number;
  percentage: number;
}

interface IncomeSourceChartProps {
  data: SourceData[];
  total: number;
  change?: number;
}

export function IncomeSourceChart({ data, total, change }: IncomeSourceChartProps) {
  return (
    <BreakdownPanel
      title="Ingresos por fuente"
      items={data.map((d) => ({
        label: d.source,
        amount: d.amount,
        percentage: d.percentage,
      }))}
      total={total}
      totalLabel="en total"
      change={change}
      palette={CATEGORY_COLORS}
      emptyMessage="Sin ingresos este mes"
    />
  );
}
