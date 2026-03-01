import dynamic from "next/dynamic";
import { VStack, Heading, SimpleGrid } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeList } from "@/components/income/IncomeList";
import { LazySection } from "@/components/shared/LazySection";
import { getDolarBlue } from "@/lib/api/exchange-rates";

const IncomeSourceChart = dynamic(() =>
  import("@/components/income/IncomeSourceChart").then((m) => m.IncomeSourceChart)
);
const IncomeTrendChart = dynamic(() =>
  import("@/components/income/IncomeTrendChart").then((m) => m.IncomeTrendChart)
);

function buildMonthKey(date: string) {
  return date.slice(0, 7);
}

function formatMonthLabel(key: string) {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

export default async function IncomePage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: incomes }, dolarBlue] = await Promise.all([
    supabase
      .from("platforms")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("incomes")
      .select("*, platform:platforms(*)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
    getDolarBlue(),
  ]);

  const allIncomes = incomes ?? [];

  const usdRate = dolarBlue?.venta ?? 0;
  const toArs = (row: { amount: number; currency: string }) => {
    const amount = Number(row.amount);
    if (row.currency === "USD") return amount * usdRate;
    if (row.currency === "EUR") return amount * usdRate; // EUR≈USD approximation
    return amount;
  };

  // Current and previous month keys
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // Source breakdown for current month (grouped by source + currency)
  const curMonthIncomes = allIncomes.filter((i) => buildMonthKey(i.date) === curMonth);
  const sourceMap = new Map<string, number>();
  for (const i of curMonthIncomes) {
    const key = i.currency !== "ARS" ? `${i.source} (${i.currency})` : i.source;
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + toArs(i));
  }
  const sourceTotal = curMonthIncomes.reduce((s, i) => s + toArs(i), 0);
  const sourceData = [...sourceMap.entries()]
    .map(([source, amount]) => ({
      source,
      amount,
      percentage: sourceTotal > 0 ? (amount / sourceTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Previous month total for % change
  const prevMonthTotal = allIncomes
    .filter((i) => buildMonthKey(i.date) === prevMonth)
    .reduce((s, i) => s + toArs(i), 0);
  const sourceChange = prevMonthTotal > 0
    ? ((sourceTotal - prevMonthTotal) / prevMonthTotal) * 100
    : undefined;

  // Monthly trend (last 12 months)
  const monthMap = new Map<string, number>();
  for (const i of allIncomes) {
    const key = buildMonthKey(i.date);
    monthMap.set(key, (monthMap.get(key) ?? 0) + toArs(i));
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
        Ingresos
      </Heading>
      <IncomeForm platforms={platforms ?? []} />
      <LazySection minHeight="300px">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <IncomeSourceChart data={sourceData} total={sourceTotal} change={sourceChange} />
          <IncomeTrendChart data={trendData} />
        </SimpleGrid>
      </LazySection>
      <LazySection minHeight="200px">
        <IncomeList incomes={allIncomes} usdRate={usdRate} />
      </LazySection>
    </VStack>
  );
}
