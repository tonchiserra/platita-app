import { Suspense } from "react";
import { Section, Skeleton } from "@/components/ui";
import { Hero } from "@/components/dashboard/Hero";
import { BarChart, ChartCard, ChartTable, chartVars } from "@/components/charts/Charts";
import { MonthlyDonut, type DonutMonth } from "@/components/charts/MonthlyDonut";
import { MovementList } from "@/components/movements/MovementList";
import { groupByMonth } from "@/components/movements/groups";
import { getCategories, getConverter, getExpenses, getPlatforms } from "@/lib/data";
import { monthlySums, windowMonths } from "@/lib/compute";
import { categoryLabel } from "@/lib/constants/labels";
import { addMonths, currentMonthKey, formatMonthName } from "@/lib/utils/format";

export const metadata = { title: "Gastos · Platita" };

export default function ExpensesPage() {
  return (
    <Suspense fallback={<Skeleton height={520} />}>
      <ExpensesContent />
    </Suspense>
  );
}

async function ExpensesContent() {
  const [expenses, conv, categories, platforms] = await Promise.all([getExpenses(), getConverter(), getCategories(), getPlatforms()]);
  const current = currentMonthKey();
  const months = windowMonths(current, 12, expenses.map((e) => e.date));
  const series = monthlySums(expenses, months, conv);
  const last = series.ars.length - 1;
  const prevArs = series.ars[last - 1];
  const change = prevArs && prevArs > 0 ? ((series.ars[last] - prevArs) / prevArs) * 100 : null;

  // Pie: every month of the window, colours fixed per category across it.
  const icons = Object.fromEntries(categories.map((c) => [c.name, c.icon]));
  const totals = new Map<string, number>();
  const byMonth = new Map<string, Map<string, { ars: number; usd: number }>>();
  for (const e of expenses) {
    const m = e.date.slice(0, 7);
    if (m < months[0]) continue;
    const ars = conv.toArs(e);
    totals.set(e.category, (totals.get(e.category) ?? 0) + ars);
    const month = byMonth.get(m) ?? new Map();
    byMonth.set(m, month);
    const cell = month.get(e.category) ?? { ars: 0, usd: 0 };
    cell.ars += ars;
    cell.usd += conv.toUsd(e);
    month.set(e.category, cell);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  // Six named colours, then the neutral "rest" step for everything else.
  const colors = Object.fromEntries(ranked.map((name, i) => [name, chartVars.slots[Math.min(i, 6)]]));
  const donutMonths: DonutMonth[] = months.map((month) => ({
    month,
    slices: [...(byMonth.get(month)?.entries() ?? [])].map(([name, v]) => ({ name, label: categoryLabel(name), icon: icons[name], ...v })),
  }));
  // Open on the last month that has spending, not on an empty one.
  let initial = donutMonths.length - 1;
  while (initial > 0 && donutMonths[initial].slices.length === 0) initial--;

  const groups = groupByMonth(
    expenses.map((e) => ({ id: e.id, date: e.date, amount: e.amount, currency: e.currency, bucket: e.category, description: e.description, platform_id: e.platform_id })),
    conv
  );
  const monthName = formatMonthName(current);

  return (
    <>
      <Hero
        label={`Gastos de ${monthName}`}
        ars={series.ars[last] ?? 0}
        usd={series.usd[last] ?? 0}
        change={change}
        goodWhen="down"
        changeLabel={`vs. ${formatMonthName(addMonths(current, -1))}`}
      />

      <ChartCard
        title="Gastos por mes"
        subtitle="Cuánto salió cada mes. El mes en curso aparece más claro."
        table={<ChartTable months={months} columns={[{ label: "Gastos", values: series }]} />}
      >
        <BarChart
          months={months}
          current={current}
          monthChange={{ goodWhen: "down" }}
          series={[{ key: "expense", label: "Gastos", color: chartVars.expense, values: series }]}
        />
      </ChartCard>

      <ChartCard title="En qué se fue" subtitle="Los gastos de cada mes por categoría, de mayor a menor.">
        <MonthlyDonut months={donutMonths} colors={colors} initialIndex={initial} />
      </ChartCard>

      <Section label="Movimientos" title="Todos los gastos">
        <MovementList
          kind="expense"
          groups={groups}
          categories={categories}
          platforms={platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
        />
      </Section>
    </>
  );
}
