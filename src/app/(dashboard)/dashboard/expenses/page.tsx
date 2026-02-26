import dynamic from "next/dynamic";
import { VStack, Heading, SimpleGrid } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { LazySection } from "@/components/shared/LazySection";
import { getDolarBlue } from "@/lib/api/exchange-rates";

const ExpenseCategoryChart = dynamic(() =>
  import("@/components/expenses/ExpenseCategoryChart").then((m) => m.ExpenseCategoryChart)
);
const ExpenseTrendChart = dynamic(() =>
  import("@/components/expenses/ExpenseTrendChart").then((m) => m.ExpenseTrendChart)
);

function buildMonthKey(date: string) {
  return date.slice(0, 7);
}

function formatMonthLabel(key: string) {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

export default async function ExpensesPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: expenses }, dolarBlue] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, platform:platforms(*)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
    getDolarBlue(),
  ]);

  const allExpenses = expenses ?? [];

  const usdRate = dolarBlue?.venta ?? 0;
  const toArs = (row: { amount: number; currency: string }) => {
    const amount = Number(row.amount);
    if (row.currency === "USD") return amount * usdRate;
    if (row.currency === "EUR") return amount * usdRate;
    return amount;
  };

  // Current and previous month keys
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // Category breakdown for current month
  const curMonthExpenses = allExpenses.filter((e) => buildMonthKey(e.date) === curMonth);
  const categoryMap = new Map<string, number>();
  for (const e of curMonthExpenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + toArs(e));
  }
  const categoryTotal = curMonthExpenses.reduce((s, e) => s + toArs(e), 0);
  const categoryData = [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Previous month total for % change
  const prevMonthTotal = allExpenses
    .filter((e) => buildMonthKey(e.date) === prevMonth)
    .reduce((s, e) => s + toArs(e), 0);
  const categoryChange = prevMonthTotal > 0
    ? ((categoryTotal - prevMonthTotal) / prevMonthTotal) * 100
    : undefined;

  // Monthly trend (last 12 months)
  const monthMap = new Map<string, number>();
  for (const e of allExpenses) {
    const key = buildMonthKey(e.date);
    monthMap.set(key, (monthMap.get(key) ?? 0) + toArs(e));
  }
  const sortedMonths = [...monthMap.keys()].sort();
  const last12 = sortedMonths.slice(-12);
  const trendData = last12.map((key, i) => {
    const total = monthMap.get(key)!;
    const prevKey = i > 0 ? last12[i - 1] : sortedMonths[sortedMonths.indexOf(key) - 1];
    const prev = prevKey ? monthMap.get(prevKey) : undefined;
    const change = prev && prev > 0 ? ((total - prev) / prev) * 100 : undefined;
    return { month: formatMonthLabel(key), total, change };
  });

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Gastos
      </Heading>
      <ExpenseForm />
      <LazySection minHeight="300px">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <ExpenseCategoryChart data={categoryData} total={categoryTotal} change={categoryChange} />
          <ExpenseTrendChart data={trendData} />
        </SimpleGrid>
      </LazySection>
      <LazySection minHeight="200px">
        <ExpenseList expenses={allExpenses} />
      </LazySection>
    </VStack>
  );
}
