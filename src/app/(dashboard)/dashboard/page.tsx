import { VStack, SimpleGrid } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { PatrimonyChart } from "@/components/dashboard/PatrimonyChart";
import { ExchangeRates } from "@/components/dashboard/ExchangeRates";
import { ExpenseCategoryChart } from "@/components/expenses/ExpenseCategoryChart";
import { ExpenseTrendChart } from "@/components/expenses/ExpenseTrendChart";
import { IncomeSourceChart } from "@/components/income/IncomeSourceChart";
import { IncomeTrendChart } from "@/components/income/IncomeTrendChart";
import { PatrimonyBreakdownChart } from "@/components/patrimony/PatrimonyBreakdownChart";
import { getDolarBlue, getEuroBlue } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { formatCurrency } from "@/lib/utils/format";

function buildMonthKey(date: string) {
  return date.slice(0, 7);
}

function formatMonthLabel(key: string) {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  // Month boundaries
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // 12 months ago boundary for trend charts
  const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const twelveAgoStr = `${twelveAgo.getFullYear()}-${String(twelveAgo.getMonth() + 1).padStart(2, "0")}-01`;

  // Fetch all data in parallel
  const [
    { data: snapshots },
    dolarBlue,
    cryptoPrices,
    euroBlue,
    { data: latestWithItems },
    { data: recentExpenses },
    { data: recentIncomes },
    { data: platforms },
  ] = await Promise.all([
    supabase
      .from("patrimony_snapshots")
      .select("date, total_ars")
      .eq("user_id", user!.id)
      .order("date", { ascending: true }),
    getDolarBlue(),
    getCryptoPrices(),
    getEuroBlue(),
    supabase
      .from("patrimony_snapshots")
      .select("id, patrimony_snapshot_items(platform_id, currency, amount)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("expenses")
      .select("amount, category, date")
      .eq("user_id", user!.id)
      .gte("date", twelveAgoStr)
      .order("date", { ascending: false }),
    supabase
      .from("incomes")
      .select("amount, source, date")
      .eq("user_id", user!.id)
      .gte("date", twelveAgoStr)
      .order("date", { ascending: false }),
    supabase
      .from("platforms")
      .select("id, name")
      .eq("user_id", user!.id),
  ]);

  const allExpenses = recentExpenses ?? [];
  const allIncomes = recentIncomes ?? [];

  // Current + previous month filtering
  const curExpenses = allExpenses.filter((e) => buildMonthKey(e.date) === curMonth);
  const prevExpenses = allExpenses.filter((e) => buildMonthKey(e.date) === prevMonth);
  const curIncomes = allIncomes.filter((i) => buildMonthKey(i.date) === curMonth);
  const prevIncomes = allIncomes.filter((i) => buildMonthKey(i.date) === prevMonth);

  const totalExpenses = curExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncomes = curIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const prevTotalExpenses = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotalIncomes = prevIncomes.reduce((s, i) => s + Number(i.amount), 0);

  const expensesChange = prevTotalExpenses > 0
    ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
    : undefined;
  const incomeChange = prevTotalIncomes > 0
    ? ((totalIncomes - prevTotalIncomes) / prevTotalIncomes) * 100
    : undefined;
  const prevBalance = prevTotalIncomes - prevTotalExpenses;
  const curBalance = totalIncomes - totalExpenses;
  const balanceChange = prevBalance !== 0
    ? ((curBalance - prevBalance) / Math.abs(prevBalance)) * 100
    : undefined;

  // Patrimony
  const sorted = snapshots ?? [];
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const monthlyChange =
    latest && previous && Number(previous.total_ars) > 0
      ? ((Number(latest.total_ars) - Number(previous.total_ars)) / Number(previous.total_ars)) * 100
      : undefined;

  // Exchange rates
  const usdRate = dolarBlue?.venta ?? 0;
  const eurRate = euroBlue?.venta ?? 0;
  const btcUsd = cryptoPrices?.bitcoin?.usd ?? 0;
  const ethUsd = cryptoPrices?.ethereum?.usd ?? 0;

  function convertToArs(amount: number, currency: string): number {
    switch (currency) {
      case "ARS": return amount;
      case "USD": return amount * usdRate;
      case "EUR": return amount * eurRate;
      case "BTC": return amount * btcUsd * usdRate;
      case "ETH": return amount * ethUsd * usdRate;
      default: return amount;
    }
  }

  // Estimated patrimony
  const latestItems = latestWithItems?.patrimony_snapshot_items ?? [];
  let estimatedArs: number | null = null;
  if (latestItems.length > 0) {
    estimatedArs = latestItems.reduce((sum, item) => {
      return sum + convertToArs(Number((item as any).amount), (item as any).currency);
    }, 0);
    estimatedArs += totalIncomes - totalExpenses;
  }

  // Estimated equation
  let estimatedEquation: string | null = null;
  if (latestItems.length > 0) {
    const byCurrency: Record<string, number> = {};
    for (const item of latestItems) {
      byCurrency[(item as any).currency] =
        (byCurrency[(item as any).currency] ?? 0) + Number((item as any).amount);
    }
    const fmt = (n: number, maxDecimals = 2) =>
      n.toLocaleString("es-AR", { maximumFractionDigits: maxDecimals });
    const parts: string[] = [];
    if (byCurrency.ARS) parts.push(`${fmt(byCurrency.ARS)} ARS`);
    if (byCurrency.USD) parts.push(`(${fmt(byCurrency.USD)} USD × ${fmt(usdRate)} ARS)`);
    if (byCurrency.EUR) parts.push(`(${fmt(byCurrency.EUR)} EUR × ${fmt(eurRate)} ARS)`);
    if (byCurrency.BTC) parts.push(`(${fmt(byCurrency.BTC, 8)} BTC × ${fmt(btcUsd)} USD × ${fmt(usdRate)} ARS)`);
    if (byCurrency.ETH) parts.push(`(${fmt(byCurrency.ETH, 8)} ETH × ${fmt(ethUsd)} USD × ${fmt(usdRate)} ARS)`);
    estimatedEquation = parts.join(" + ");
    if (totalIncomes > 0) estimatedEquation += ` + ${fmt(totalIncomes)} ingresos`;
    if (totalExpenses > 0) estimatedEquation += ` − ${fmt(totalExpenses)} gastos`;
  }

  // === Expense category breakdown (current month) ===
  const categoryMap = new Map<string, number>();
  for (const e of curExpenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + Number(e.amount));
  }
  const categoryData = [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // === Income source breakdown (current month) ===
  const sourceMap = new Map<string, number>();
  for (const i of curIncomes) {
    sourceMap.set(i.source, (sourceMap.get(i.source) ?? 0) + Number(i.amount));
  }
  const sourceData = [...sourceMap.entries()]
    .map(([source, amount]) => ({
      source,
      amount,
      percentage: totalIncomes > 0 ? (amount / totalIncomes) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // === Expense trend (monthly) ===
  const expMonthMap = new Map<string, number>();
  for (const e of allExpenses) {
    const key = buildMonthKey(e.date);
    expMonthMap.set(key, (expMonthMap.get(key) ?? 0) + Number(e.amount));
  }
  const expSortedMonths = [...expMonthMap.keys()].sort();
  const expTrendData = expSortedMonths.map((key, i) => {
    const total = expMonthMap.get(key)!;
    const prevKey = i > 0 ? expSortedMonths[i - 1] : undefined;
    const prev = prevKey ? expMonthMap.get(prevKey) : undefined;
    const change = prev && prev > 0 ? ((total - prev) / prev) * 100 : undefined;
    return { month: formatMonthLabel(key), total, change };
  });

  // === Income trend (monthly) ===
  const incMonthMap = new Map<string, number>();
  for (const i of allIncomes) {
    const key = buildMonthKey(i.date);
    incMonthMap.set(key, (incMonthMap.get(key) ?? 0) + Number(i.amount));
  }
  const incSortedMonths = [...incMonthMap.keys()].sort();
  const incTrendData = incSortedMonths.map((key, i) => {
    const total = incMonthMap.get(key)!;
    const prevKey = i > 0 ? incSortedMonths[i - 1] : undefined;
    const prev = prevKey ? incMonthMap.get(prevKey) : undefined;
    const change = prev && prev > 0 ? ((total - prev) / prev) * 100 : undefined;
    return { month: formatMonthLabel(key), total, change };
  });

  // === Patrimony breakdown by platform ===
  const platformMap = Object.fromEntries((platforms ?? []).map((p: any) => [p.id, p.name]));
  const platformTotals = new Map<string, number>();
  for (const item of latestItems) {
    const platformId = (item as any).platform_id as string;
    const arsValue = convertToArs(Number((item as any).amount), (item as any).currency);
    platformTotals.set(platformId, (platformTotals.get(platformId) ?? 0) + arsValue);
  }
  const breakdownTotal = [...platformTotals.values()].reduce((s, v) => s + v, 0);
  const breakdownData = [...platformTotals.entries()]
    .map(([id, valueArs]) => ({
      platform: platformMap[id] || "Desconocida",
      valueArs,
      percentage: breakdownTotal > 0 ? (valueArs / breakdownTotal) * 100 : 0,
    }))
    .sort((a, b) => b.valueArs - a.valueArs);

  // === Exchange rates display ===
  const rates = [];
  const timestamps: Date[] = [];
  if (dolarBlue) {
    rates.push({ label: "USD Blue (venta)", value: formatCurrency(dolarBlue.venta) });
    rates.push({ label: "USD Blue (compra)", value: formatCurrency(dolarBlue.compra) });
    if (dolarBlue.fechaActualizacion) timestamps.push(new Date(dolarBlue.fechaActualizacion));
  }
  if (cryptoPrices?.bitcoin) {
    rates.push({ label: "BTC", value: formatCurrency(cryptoPrices.bitcoin.usd, "USD") });
    if (cryptoPrices.bitcoin.last_updated_at) timestamps.push(new Date(cryptoPrices.bitcoin.last_updated_at * 1000));
  }
  if (cryptoPrices?.ethereum) {
    rates.push({ label: "ETH", value: formatCurrency(cryptoPrices.ethereum.usd, "USD") });
    if (cryptoPrices.ethereum.last_updated_at) timestamps.push(new Date(cryptoPrices.ethereum.last_updated_at * 1000));
  }
  const oldestUpdate = timestamps.length > 0
    ? new Date(Math.min(...timestamps.map((t) => t.getTime())))
    : null;
  const updatedAt = oldestUpdate
    ? `Actualizado ${oldestUpdate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${oldestUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
    : undefined;

  return (
    <VStack gap="6" align="stretch">
      <SummaryCards
        lastSnapshotArs={Number(latest?.total_ars ?? 0)}
        estimatedArs={estimatedArs}
        estimatedEquation={estimatedEquation}
        monthlyChange={monthlyChange}
        totalExpensesMonth={totalExpenses}
        totalIncomeMonth={totalIncomes}
        expensesChange={expensesChange}
        incomeChange={incomeChange}
        balanceChange={balanceChange}
      />
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <ExpenseCategoryChart data={categoryData} total={totalExpenses} change={expensesChange} />
        <IncomeSourceChart data={sourceData} total={totalIncomes} change={incomeChange} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <ExpenseTrendChart data={expTrendData} />
        <IncomeTrendChart data={incTrendData} />
      </SimpleGrid>
      <PatrimonyChart data={sorted} />
      {breakdownData.length > 0 && (
        <PatrimonyBreakdownChart data={breakdownData} totalArs={breakdownTotal} />
      )}
      {rates.length > 0 && <ExchangeRates rates={rates} updatedAt={updatedAt} />}
    </VStack>
  );
}
