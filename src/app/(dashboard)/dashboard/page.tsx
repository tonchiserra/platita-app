import dynamic from "next/dynamic";
import { VStack, SimpleGrid } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { PatrimonyHero } from "@/components/dashboard/PatrimonyHero";
import type { EquationTerm } from "@/components/dashboard/PatrimonyEquation";
import { MonthFlow } from "@/components/dashboard/MonthFlow";
import { ExchangeRates, type Rate } from "@/components/dashboard/ExchangeRates";
import { LazySection } from "@/components/shared/LazySection";
import {
  getDolarBlue,
  getEuroBlue,
  getDolarBlueHistory,
  blueRateOn,
} from "@/lib/api/exchange-rates";
import { getMonthlyInflation, inflationBetween } from "@/lib/api/inflation";
import { getCryptoPriceMap } from "@/lib/api/crypto-prices";
import { buildAlerts, seriesChangePct } from "@/lib/utils/alerts";
import { resolveCategories, iconMap, fixedCategoryNames } from "@/lib/utils/expense-categories";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { convertToArs } from "@/lib/utils/currency-conversion";
import { formatCurrency, formatTimeOfDay } from "@/lib/utils/format";
import type { ExchangeRates as Rates } from "@/types/database";

const ExpenseCategoryChart = dynamic(() =>
  import("@/components/expenses/ExpenseCategoryChart").then((m) => m.ExpenseCategoryChart)
);
const ExpenseTrendChart = dynamic(() =>
  import("@/components/expenses/ExpenseTrendChart").then((m) => m.ExpenseTrendChart)
);
const IncomeSourceChart = dynamic(() =>
  import("@/components/income/IncomeSourceChart").then((m) => m.IncomeSourceChart)
);
const IncomeTrendChart = dynamic(() =>
  import("@/components/income/IncomeTrendChart").then((m) => m.IncomeTrendChart)
);
const CashflowChart = dynamic(() =>
  import("@/components/dashboard/CashflowChart").then((m) => m.CashflowChart)
);
const PatrimonyChart = dynamic(() =>
  import("@/components/dashboard/PatrimonyChart").then((m) => m.PatrimonyChart)
);
const PatrimonyBreakdownChart = dynamic(() =>
  import("@/components/patrimony/PatrimonyBreakdownChart").then((m) => m.PatrimonyBreakdownChart)
);

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
    blueHistory,
    { data: categoryRows },
    { data: investments },
    inflationSeries,
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
      .select("amount, currency, category, date")
      .eq("user_id", user!.id)
      .gte("date", twelveAgoStr)
      .order("date", { ascending: false }),
    supabase
      .from("incomes")
      .select("amount, currency, source, date")
      .eq("user_id", user!.id)
      .gte("date", twelveAgoStr)
      .order("date", { ascending: false }),
    supabase
      .from("platforms")
      .select("id, name")
      .eq("user_id", user!.id),
    // A long window so past snapshots can be valued at the rate of their day.
    getDolarBlueHistory(400),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("user_id", user!.id)
      .order("sort_order"),
    supabase
      .from("investments")
      .select("asset, asset_type, units, total_amount, currency")
      .eq("user_id", user!.id),
    getMonthlyInflation(),
  ]);

  // Falls back to the built-in list when the user hasn't customised one.
  const categories = resolveCategories(categoryRows);
  const categoryIcons = iconMap(categories);

  const platformMap = Object.fromEntries((platforms ?? []).map((p: any) => [p.id, p.name]));

  const allExpenses = recentExpenses ?? [];
  const allIncomes = recentIncomes ?? [];

  // Exchange rates (needed for multi-currency conversion)
  const usdRate = dolarBlue?.venta ?? 0;
  const eurRate = euroBlue?.venta ?? 0;
  const btcUsd = cryptoPrices?.bitcoin?.usd ?? 0;
  const ethUsd = cryptoPrices?.ethereum?.usd ?? 0;

  const fx: Rates = { usdRate, eurRate, btcUsd, ethUsd };

  const toArs = (row: { amount: number; currency: string }) =>
    convertToArs(Number(row.amount), row.currency, fx);

  // Current + previous month filtering
  const curExpenses = allExpenses.filter((e) => buildMonthKey(e.date) === curMonth);
  const prevExpenses = allExpenses.filter((e) => buildMonthKey(e.date) === prevMonth);
  const curIncomes = allIncomes.filter((i) => buildMonthKey(i.date) === curMonth);
  const prevIncomes = allIncomes.filter((i) => buildMonthKey(i.date) === prevMonth);

  const totalExpenses = curExpenses.reduce((s, e) => s + toArs(e), 0);
  const totalIncomes = curIncomes.reduce((s, i) => s + toArs(i), 0);
  const prevTotalExpenses = prevExpenses.reduce((s, e) => s + toArs(e), 0);
  const prevTotalIncomes = prevIncomes.reduce((s, i) => s + toArs(i), 0);

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

  // Estimated patrimony
  const latestItems = latestWithItems?.patrimony_snapshot_items ?? [];
  let estimatedArs: number | null = null;
  if (latestItems.length > 0) {
    estimatedArs = latestItems.reduce((sum, item) => {
      return sum + convertToArs(Number((item as any).amount), (item as any).currency, fx);
    }, 0);
    estimatedArs += totalIncomes - totalExpenses;
  }

  // === The equation behind the estimate ===
  // Each holding is shown with the conversion chain that turns it into pesos,
  // because that chain is the calculation the user already does in their head.
  const monthName = now.toLocaleDateString("es-AR", { month: "long" });
  const equationTerms: EquationTerm[] = [];

  if (latestItems.length > 0) {
    const byCurrency: Record<string, number> = {};
    for (const item of latestItems) {
      byCurrency[(item as any).currency] =
        (byCurrency[(item as any).currency] ?? 0) + Number((item as any).amount);
    }
    const fmt = (n: number, maxDecimals = 2) =>
      n.toLocaleString("es-AR", { maximumFractionDigits: maxDecimals });

    const add = (term: Omit<EquationTerm, "op">) => {
      equationTerms.push({ ...term, op: equationTerms.length > 0 ? "+" : undefined });
    };

    if (byCurrency.ARS) add({ amount: fmt(byCurrency.ARS, 0), unit: "ARS" });
    if (byCurrency.USD)
      add({ amount: fmt(byCurrency.USD), unit: "USD", chain: [{ value: fmt(usdRate) }] });
    if (byCurrency.EUR)
      add({ amount: fmt(byCurrency.EUR), unit: "EUR", chain: [{ value: fmt(eurRate) }] });
    if (byCurrency.BTC)
      add({
        amount: fmt(byCurrency.BTC, 8),
        unit: "BTC",
        chain: [{ value: fmt(btcUsd, 0), unit: "USD" }, { value: fmt(usdRate) }],
      });
    if (byCurrency.ETH)
      add({
        amount: fmt(byCurrency.ETH, 8),
        unit: "ETH",
        chain: [{ value: fmt(ethUsd, 0), unit: "USD" }, { value: fmt(usdRate) }],
      });

    if (totalIncomes > 0)
      add({ amount: fmt(totalIncomes, 0), note: `ingresos de ${monthName}` });
    if (totalExpenses > 0)
      equationTerms.push({
        op: "−",
        amount: fmt(totalExpenses, 0),
        note: `gastos de ${monthName}`,
      });
  }

  // === Expense category breakdown (current month) ===
  const categoryMap = new Map<string, number>();
  for (const e of curExpenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + toArs(e));
  }
  const categoryData = [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // === Income source breakdown (current month, grouped by source + currency) ===
  const sourceMap = new Map<string, number>();
  for (const i of curIncomes) {
    const key = i.currency !== "ARS" ? `${i.source} (${i.currency})` : i.source;
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + toArs(i));
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
    expMonthMap.set(key, (expMonthMap.get(key) ?? 0) + toArs(e));
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
    incMonthMap.set(key, (incMonthMap.get(key) ?? 0) + toArs(i));
  }
  const incSortedMonths = [...incMonthMap.keys()].sort();
  const incTrendData = incSortedMonths.map((key, i) => {
    const total = incMonthMap.get(key)!;
    const prevKey = i > 0 ? incSortedMonths[i - 1] : undefined;
    const prev = prevKey ? incMonthMap.get(prevKey) : undefined;
    const change = prev && prev > 0 ? ((total - prev) / prev) * 100 : undefined;
    return { month: formatMonthLabel(key), total, change };
  });

  // === Alerts: comparisons the user would otherwise make by hand ===
  // Each category's totals for the months *before* this one, so "above average"
  // means above its own norm rather than above other categories.
  const historyByCategory = new Map<string, number[]>();
  {
    const perMonth = new Map<string, Map<string, number>>();
    for (const e of allExpenses) {
      const key = buildMonthKey(e.date);
      if (key === curMonth) continue;
      if (!perMonth.has(key)) perMonth.set(key, new Map());
      const m = perMonth.get(key)!;
      m.set(e.category, (m.get(e.category) ?? 0) + toArs(e));
    }
    for (const monthTotals of perMonth.values()) {
      for (const [category, amount] of monthTotals) {
        if (!historyByCategory.has(category)) historyByCategory.set(category, []);
        historyByCategory.get(category)!.push(amount);
      }
    }
  }

  const daysSinceSnapshot = latest
    ? Math.floor(
        (now.getTime() - new Date(latest.date + "T00:00:00").getTime()) / 86_400_000
      )
    : null;

  // Latest holdings split two ways: by currency (peso exposure) and by
  // platform (concentration).
  const latestByCurrency = new Map<string, number>();
  const latestByPlatform = new Map<string, number>();
  // The nested select comes back loosely typed; name the shape once here.
  const snapshotItems = latestItems as unknown as {
    platform_id: string;
    currency: string;
    amount: number;
  }[];
  for (const item of snapshotItems) {
    const amountArs = convertToArs(Number(item.amount), item.currency, fx);
    latestByCurrency.set(
      item.currency,
      (latestByCurrency.get(item.currency) ?? 0) + amountArs
    );
    const name = platformMap[item.platform_id] ?? "Sin plataforma";
    latestByPlatform.set(name, (latestByPlatform.get(name) ?? 0) + amountArs);
  }
  const usdHoldings = latestItems
    .filter((item) => (item as any).currency === "USD")
    .reduce((sum, item) => sum + Number((item as any).amount), 0);

  // Income by source over the whole window, for the concentration check.
  const sourceTotals = new Map<string, number>();
  for (const i of allIncomes) {
    sourceTotals.set(i.source, (sourceTotals.get(i.source) ?? 0) + toArs(i));
  }

  // Average purchase price per asset, in USD, mirroring the investments page.
  const byAsset: Record<string, { invested: number; units: number }> = {};
  for (const inv of investments ?? []) {
    if (inv.asset_type !== "crypto") continue;
    if (!byAsset[inv.asset]) byAsset[inv.asset] = { invested: 0, units: 0 };
    let investedUsd = Number(inv.total_amount);
    if (inv.currency === "ARS" && usdRate > 0) investedUsd /= usdRate;
    byAsset[inv.asset].invested += investedUsd;
    byAsset[inv.asset].units += Number(inv.units);
  }
  const priceMap = await getCryptoPriceMap(Object.keys(byAsset));
  const positions = Object.entries(byAsset).map(([asset, d]) => ({
    asset,
    avgPriceUsd: d.units > 0 ? d.invested / d.units : null,
    currentPriceUsd: priceMap[asset] ?? null,
  }));

  // Snapshots valued at the blue rate of their own date, so growth can be read
  // in dollars as well as in pesos.
  const snapshotList = sorted.map((s) => ({
    date: s.date as string,
    totalArs: Number(s.total_ars),
  }));
  const prevSnapshot = snapshotList[snapshotList.length - 2];
  const lastSnapshot = snapshotList[snapshotList.length - 1];

  const alerts = buildAlerts({
    today: now,
    currentMonthKey: curMonth,
    prevMonthKey: prevMonth,
    expensesByMonth: expMonthMap,
    incomesByMonth: incMonthMap,
    currentByCategory: categoryMap,
    historyByCategory,
    fixedCategories: fixedCategoryNames(categories),
    expenses: allExpenses.map((e, i) => ({
      id: `${e.date}-${i}`,
      date: e.date,
      category: e.category,
      description: "",
      amountArs: toArs(e),
    })),
    sourceTotals,
    totalIncomes,
    totalExpenses,
    snapshots: snapshotList,
    daysSinceSnapshot,
    latestByCurrency,
    latestByPlatform,
    positions,
    btcChange24h: cryptoPrices?.bitcoin?.usd_24h_change,
    ethChange24h: cryptoPrices?.ethereum?.usd_24h_change,
    blueWeekChangePct: blueHistory ? seriesChangePct(blueHistory.slice(-8)) : undefined,
    blueSeries: blueHistory ?? undefined,
    usdHoldingsArs: usdHoldings * usdRate,
    blueAtLatest:
      blueHistory && lastSnapshot ? blueRateOn(blueHistory, lastSnapshot.date) : undefined,
    blueAtPrevious:
      blueHistory && prevSnapshot ? blueRateOn(blueHistory, prevSnapshot.date) : undefined,
    inflationBetweenSnapshots:
      inflationSeries && prevSnapshot && lastSnapshot
        ? inflationBetween(inflationSeries, prevSnapshot.date, lastSnapshot.date)
        : undefined,
  });

  // === Cashflow: the two series on one scale, so the gap reads as balance ===
  const cashflowMonths = [
    ...new Set([...expMonthMap.keys(), ...incMonthMap.keys()]),
  ].sort();
  const cashflowData = cashflowMonths.map((key) => ({
    month: formatMonthLabel(key),
    income: incMonthMap.get(key) ?? 0,
    expenses: expMonthMap.get(key) ?? 0,
  }));

  // === Patrimony breakdown by platform ===
  const platformTotals = new Map<string, number>();
  for (const item of latestItems) {
    const platformId = (item as any).platform_id as string;
    const arsValue = convertToArs(Number((item as any).amount), (item as any).currency, fx);
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
  const rates: Rate[] = [];
  const timestamps: Date[] = [];
  if (dolarBlue) {
    rates.push({
      label: "Dólar blue",
      token: "cur.usd",
      compra: formatCurrency(dolarBlue.compra),
      venta: formatCurrency(dolarBlue.venta),
    });
    if (dolarBlue.fechaActualizacion) timestamps.push(new Date(dolarBlue.fechaActualizacion));
  }
  if (euroBlue) {
    rates.push({
      label: "Euro",
      token: "cur.eur",
      compra: formatCurrency(euroBlue.compra),
      venta: formatCurrency(euroBlue.venta),
    });
  }
  if (cryptoPrices?.bitcoin) {
    rates.push({
      label: "Bitcoin",
      token: "cur.btc",
      value: formatCurrency(cryptoPrices.bitcoin.usd, "USD"),
    });
    if (cryptoPrices.bitcoin.last_updated_at) timestamps.push(new Date(cryptoPrices.bitcoin.last_updated_at * 1000));
  }
  if (cryptoPrices?.ethereum) {
    rates.push({
      label: "Ethereum",
      token: "cur.eth",
      value: formatCurrency(cryptoPrices.ethereum.usd, "USD"),
    });
    if (cryptoPrices.ethereum.last_updated_at) timestamps.push(new Date(cryptoPrices.ethereum.last_updated_at * 1000));
  }
  const oldestUpdate = timestamps.length > 0
    ? new Date(Math.min(...timestamps.map((t) => t.getTime())))
    : null;
  const updatedAt = oldestUpdate ? formatTimeOfDay(oldestUpdate) : undefined;

  // === Hero figures ===
  const lastSnapshotArs = Number(latest?.total_ars ?? 0);
  const estimatedChange =
    estimatedArs !== null && lastSnapshotArs > 0
      ? ((estimatedArs - lastSnapshotArs) / lastSnapshotArs) * 100
      : undefined;
  const heroValue = estimatedArs ?? lastSnapshotArs;
  const heroTotal = heroValue.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const today = now.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <VStack gap="4" align="stretch">
      <PatrimonyHero
        total={heroTotal}
        change={estimatedArs !== null ? estimatedChange : monthlyChange}
        changeLabel={
          estimatedArs !== null ? "desde el último cierre" : "vs. cierre anterior"
        }
        terms={equationTerms}
        today={today}
        lastClose={lastSnapshotArs > 0 ? formatCurrency(lastSnapshotArs) : undefined}
      />
      <AlertsPanel alerts={alerts} />
      <MonthFlow
        income={totalIncomes}
        expenses={totalExpenses}
        incomeChange={incomeChange}
        expensesChange={expensesChange}
        balanceChange={balanceChange}
        monthLabel={monthName}
      />
      <LazySection minHeight="300px">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <ExpenseCategoryChart data={categoryData} total={totalExpenses} change={expensesChange} icons={categoryIcons} />
          <IncomeSourceChart data={sourceData} total={totalIncomes} change={incomeChange} />
        </SimpleGrid>
      </LazySection>
      <LazySection minHeight="300px">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <ExpenseTrendChart data={expTrendData} />
          <IncomeTrendChart data={incTrendData} />
        </SimpleGrid>
      </LazySection>
      <LazySection minHeight="340px">
        <CashflowChart data={cashflowData} />
      </LazySection>
      <LazySection minHeight="300px">
        <PatrimonyChart data={sorted} />
      </LazySection>
      {breakdownData.length > 0 && (
        <LazySection minHeight="300px">
          <PatrimonyBreakdownChart data={breakdownData} totalArs={breakdownTotal} />
        </LazySection>
      )}
      {rates.length > 0 && (
        <LazySection minHeight="100px">
          <ExchangeRates rates={rates} updatedAt={updatedAt} />
        </LazySection>
      )}
    </VStack>
  );
}
