import { Suspense } from "react";
import { Section, Skeleton } from "@/components/ui";
import { Hero } from "@/components/dashboard/Hero";
import { BarChart, ChartCard, ChartTable, chartVars } from "@/components/charts/Charts";
import { MovementList } from "@/components/movements/MovementList";
import { groupByMonth } from "@/components/movements/groups";
import { getCategories, getConverter, getIncomes, getPlatforms, getTrades } from "@/lib/data";
import { allIncomes, monthlySums, windowMonths } from "@/lib/compute";
import { addMonths, currentMonthKey, formatMonthName } from "@/lib/utils/format";

export const metadata = { title: "Ingresos · Platita" };

export default function IncomePage() {
  return (
    <Suspense fallback={<Skeleton height={520} />}>
      <IncomeContent />
    </Suspense>
  );
}

async function IncomeContent() {
  const [incomes, trades, conv, categories, platforms] = await Promise.all([getIncomes(), getTrades(), getConverter(), getCategories(), getPlatforms()]);
  // Trading profits are income: they count here and list here, but are edited in Trading.
  const rows = allIncomes(incomes, trades);
  const current = currentMonthKey();
  const months = windowMonths(current, 12, rows.map((r) => r.date));
  const series = monthlySums(rows, months, conv);
  const last = series.ars.length - 1;
  const prevArs = series.ars[last - 1];
  const change = prevArs && prevArs > 0 ? ((series.ars[last] - prevArs) / prevArs) * 100 : null;

  const groups = groupByMonth(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      currency: r.currency,
      bucket: r.source,
      description: r.description,
      platform_id: r.platform_id,
      readonly: r.fromTrade ? "Trading" : undefined,
    })),
    conv
  );

  return (
    <>
      <Hero
        label={`Ingresos de ${formatMonthName(current)}`}
        ars={series.ars[last] ?? 0}
        usd={series.usd[last] ?? 0}
        change={change}
        changeLabel={`vs. ${formatMonthName(addMonths(current, -1))}`}
      />

      <ChartCard
        title="Ingresos por mes"
        subtitle="Cuánto entró cada mes, ganancias de trading incluidas."
        table={<ChartTable months={months} columns={[{ label: "Ingresos", values: series }]} />}
        note="Los ingresos en dólares se pasan a pesos al blue de su fecha."
      >
        <BarChart
          months={months}
          current={current}
          monthChange={{ goodWhen: "up" }}
          series={[{ key: "income", label: "Ingresos", color: chartVars.income, values: series }]}
        />
      </ChartCard>

      <Section label="Movimientos" title="Todos los ingresos">
        <MovementList
          kind="income"
          groups={groups}
          categories={categories}
          platforms={platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
        />
      </Section>
    </>
  );
}
