import { VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/server";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { PatrimonyChart } from "@/components/dashboard/PatrimonyChart";
import { ExchangeRates } from "@/components/dashboard/ExchangeRates";
import { getDolarBlue, getEuroBlue } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { formatCurrency } from "@/lib/utils/format";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Month boundaries
  const now = new Date();
  const curMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const curMonthEnd = (() => {
    const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
    const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return `${y}-${String(m).padStart(2, "0")}-01`;
  })();
  const prevMonthStart = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12-01`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;

  // Fetch data in parallel
  const [
    { data: snapshots },
    dolarBlue,
    cryptoPrices,
    { data: expenses },
    { data: incomes },
    { data: prevExpenses },
    { data: prevIncomes },
    euroBlue,
    { data: latestWithItems },
  ] = await Promise.all([
    supabase
      .from("patrimony_snapshots")
      .select("date, total_ars")
      .eq("user_id", user!.id)
      .order("date", { ascending: true }),
    getDolarBlue(),
    getCryptoPrices(),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", curMonthStart)
      .lt("date", curMonthEnd),
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", curMonthStart)
      .lt("date", curMonthEnd),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", prevMonthStart)
      .lt("date", curMonthStart),
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", prevMonthStart)
      .lt("date", curMonthStart),
    getEuroBlue(),
    supabase
      .from("patrimony_snapshots")
      .select("id, patrimony_snapshot_items(currency, amount)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Process data
  const sorted = snapshots ?? [];
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const monthlyChange =
    latest && previous && Number(previous.total_ars) > 0
      ? ((Number(latest.total_ars) - Number(previous.total_ars)) /
          Number(previous.total_ars)) *
        100
      : undefined;

  const totalExpenses = (expenses ?? []).reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const totalIncomes = (incomes ?? []).reduce(
    (sum, i) => sum + Number(i.amount),
    0
  );
  const prevTotalExpenses = (prevExpenses ?? []).reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const prevTotalIncomes = (prevIncomes ?? []).reduce(
    (sum, i) => sum + Number(i.amount),
    0
  );

  const expensesChange =
    prevTotalExpenses > 0
      ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
      : undefined;
  const incomeChange =
    prevTotalIncomes > 0
      ? ((totalIncomes - prevTotalIncomes) / prevTotalIncomes) * 100
      : undefined;
  const prevBalance = prevTotalIncomes - prevTotalExpenses;
  const curBalance = totalIncomes - totalExpenses;
  const balanceChange =
    prevBalance !== 0
      ? ((curBalance - prevBalance) / Math.abs(prevBalance)) * 100
      : undefined;

  // Compute estimated current patrimony from latest snapshot items + current rates
  const latestItems = latestWithItems?.patrimony_snapshot_items ?? [];
  let estimatedArs: number | null = null;
  if (latestItems.length > 0) {
    const usdRate = dolarBlue?.venta ?? 0;
    const eurRate = euroBlue?.venta ?? 0;
    const btcUsd = cryptoPrices?.bitcoin?.usd ?? 0;
    const ethUsd = cryptoPrices?.ethereum?.usd ?? 0;

    estimatedArs = latestItems.reduce((sum, item) => {
      const amount = Number(item.amount);
      switch (item.currency) {
        case "ARS": return sum + amount;
        case "USD": return sum + amount * usdRate;
        case "EUR": return sum + amount * eurRate;
        case "BTC": return sum + amount * btcUsd * usdRate;
        case "ETH": return sum + amount * ethUsd * usdRate;
        default: return sum;
      }
    }, 0);

    estimatedArs += totalIncomes - totalExpenses;
  }

  // Build equation string for tooltip
  let estimatedEquation: string | null = null;
  if (latestItems.length > 0) {
    const byCurrency: Record<string, number> = {};
    for (const item of latestItems) {
      byCurrency[item.currency] =
        (byCurrency[item.currency] ?? 0) + Number(item.amount);
    }

    const usdRate = dolarBlue?.venta ?? 0;
    const eurRate = euroBlue?.venta ?? 0;
    const btcUsd = cryptoPrices?.bitcoin?.usd ?? 0;
    const ethUsd = cryptoPrices?.ethereum?.usd ?? 0;

    const fmt = (n: number, maxDecimals = 2) =>
      n.toLocaleString("es-AR", { maximumFractionDigits: maxDecimals });

    const parts: string[] = [];
    if (byCurrency.ARS) parts.push(`${fmt(byCurrency.ARS)} ARS`);
    if (byCurrency.USD)
      parts.push(`(${fmt(byCurrency.USD)} USD × ${fmt(usdRate)} ARS)`);
    if (byCurrency.EUR)
      parts.push(`(${fmt(byCurrency.EUR)} EUR × ${fmt(eurRate)} ARS)`);
    if (byCurrency.BTC)
      parts.push(
        `(${fmt(byCurrency.BTC, 8)} BTC × ${fmt(btcUsd)} USD × ${fmt(usdRate)} ARS)`
      );
    if (byCurrency.ETH)
      parts.push(
        `(${fmt(byCurrency.ETH, 8)} ETH × ${fmt(ethUsd)} USD × ${fmt(usdRate)} ARS)`
      );

    estimatedEquation = parts.join(" + ");
    if (totalIncomes > 0)
      estimatedEquation += ` + ${fmt(totalIncomes)} ingresos`;
    if (totalExpenses > 0)
      estimatedEquation += ` − ${fmt(totalExpenses)} gastos`;
  }

  // Build exchange rates + find most recent update timestamp
  const rates = [];
  const timestamps: Date[] = [];

  if (dolarBlue) {
    rates.push({
      label: "USD Blue (venta)",
      value: formatCurrency(dolarBlue.venta),
    });
    rates.push({
      label: "USD Blue (compra)",
      value: formatCurrency(dolarBlue.compra),
    });
    if (dolarBlue.fechaActualizacion) {
      timestamps.push(new Date(dolarBlue.fechaActualizacion));
    }
  }
  if (cryptoPrices?.bitcoin) {
    rates.push({
      label: "BTC",
      value: formatCurrency(cryptoPrices.bitcoin.usd, "USD"),
    });
    if (cryptoPrices.bitcoin.last_updated_at) {
      timestamps.push(new Date(cryptoPrices.bitcoin.last_updated_at * 1000));
    }
  }
  if (cryptoPrices?.ethereum) {
    rates.push({
      label: "ETH",
      value: formatCurrency(cryptoPrices.ethereum.usd, "USD"),
    });
    if (cryptoPrices.ethereum.last_updated_at) {
      timestamps.push(new Date(cryptoPrices.ethereum.last_updated_at * 1000));
    }
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
      <PatrimonyChart data={sorted} />
      {rates.length > 0 && <ExchangeRates rates={rates} updatedAt={updatedAt} />}
    </VStack>
  );
}
