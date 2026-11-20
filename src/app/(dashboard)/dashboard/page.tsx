import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { Equation, Hero, closeMeta } from "@/components/dashboard/Hero";
import { CashflowChart, GrowthChart, MonthSummary, Rates, type RateTile } from "@/components/dashboard/Blocks";
import { Money } from "@/components/ui";
import { getConverter, getExpenses, getIncomes, getRates, getSnapshots, getTrades } from "@/lib/data";
import { allIncomes, buildGrowth, estimatePatrimony, monthlySums, windowMonths } from "@/lib/compute";
import { addMonths, currentMonthKey, formatDayMonth, formatMonthName } from "@/lib/utils/format";
import { closeEndsPreviousMonth } from "@/lib/utils/patrimony-estimate";
import { tradeLossesUsd } from "@/lib/utils/trading";

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroBlock />
      </Suspense>
      <Suspense fallback={<Skeleton height={380} />}>
        <ChartsBlock />
      </Suspense>
      <Suspense fallback={<Skeleton height={160} />}>
        <RatesBlock />
      </Suspense>
    </>
  );
}

function HeroSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={18} width={180} />
      <Skeleton height={64} width="70%" />
      <Skeleton height={32} width={200} radius={999} />
      <Skeleton height={150} />
    </div>
  );
}

async function HeroBlock() {
  const [{ fx }, snapshots, expenses, incomes, trades, conv] = await Promise.all([
    getRates(),
    getSnapshots(),
    getExpenses(),
    getIncomes(),
    getTrades(),
    getConverter(),
  ]);
  const current = currentMonthKey();
  const previous = addMonths(current, -1);
  const incomeRows = allIncomes(incomes, trades);

  const est = estimatePatrimony({ snapshots, incomes: incomeRows, expenses, trades, fx, currentMonth: current });
  const last = est.lastClose;
  const heroArs = est.estimatedArs ?? last?.total_ars ?? 0;
  const heroUsd = est.estimatedUsd ?? (fx.usdRate > 0 ? heroArs / fx.usdRate : null);
  const change =
    est.estimatedArs !== null && last && last.total_ars > 0
      ? ((est.estimatedArs - last.total_ars) / last.total_ars) * 100
      : last && est.previousClose && est.previousClose.total_ars > 0
        ? ((last.total_ars - est.previousClose.total_ars) / est.previousClose.total_ars) * 100
        : null;

  const months = [previous, current];
  const inc = monthlySums(incomeRows, months, conv);
  const exp = monthlySums(expenses, months, conv);
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  const monthName = formatMonthName(current);
  const windowLabel = last && !closeEndsPreviousMonth(last.date, current) ? `desde el cierre del ${formatDayMonth(last.date)}` : `de ${monthName}`;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Hero
          label={est.estimatedArs !== null ? "Patrimonio estimado" : "Patrimonio"}
          shareName="hero-figure"
          ars={heroArs}
          usd={heroUsd}
          change={change}
          changeLabel={est.estimatedArs !== null ? "desde el último cierre" : "vs. cierre anterior"}
          meta={last ? closeMeta(last.date, last.total_ars) : "Cargá tu primer cierre en Patrimonio para ver el estimado."}
        />
        {est.estimatedArs !== null && (
          <Equation
            byCurrency={est.byCurrency}
            fx={fx}
            sinceIncomesArs={est.sinceIncomesArs}
            sinceExpensesArs={est.sinceExpensesArs}
            sinceLossesArs={est.sinceLossesArs}
            windowLabel={windowLabel}
            totalArs={est.estimatedArs}
          />
        )}
      </div>
      <MonthSummary
        monthName={monthName}
        income={{ ars: inc.ars[1], usd: inc.usd[1] }}
        expense={{ ars: exp.ars[1], usd: exp.usd[1] }}
        incomeChange={pct(inc.ars[1], inc.ars[0])}
        expenseChange={pct(exp.ars[1], exp.ars[0])}
        lossUsd={tradeLossesUsd(trades, current)}
      />
    </>
  );
}

async function ChartsBlock() {
  const [{ fx }, snapshots, expenses, incomes, trades, conv] = await Promise.all([
    getRates(),
    getSnapshots(),
    getExpenses(),
    getIncomes(),
    getTrades(),
    getConverter(),
  ]);
  const current = currentMonthKey();
  const incomeRows = allIncomes(incomes, trades);
  const months = windowMonths(current, 12, [...incomeRows.map((r) => r.date), ...expenses.map((r) => r.date)]);
  const income = monthlySums(incomeRows, months, conv);
  const expense = monthlySums(expenses, months, conv);

  const est = estimatePatrimony({ snapshots, incomes: incomeRows, expenses, trades, fx, currentMonth: current });
  const growth = buildGrowth({
    snapshots,
    incomes: incomeRows,
    expenses,
    estimatedArs: est.estimatedArs,
    conv,
    history: conv.history,
    currentMonth: current,
  });

  return (
    <>
      <CashflowChart months={months} income={income} expense={expense} current={current} />
      <GrowthChart growth={growth} current={current} />
    </>
  );
}

async function RatesBlock() {
  const { blue, euro, crypto } = await getRates();
  const tiles: RateTile[] = [];
  const stamps: Date[] = [];
  if (blue) {
    tiles.push({
      label: "Dólar blue",
      figure: <Money value={blue.venta} currency="ARS" decimals={0} />,
      foot: (
        <>
          <span>Compra</span>
          <span>$ {blue.compra.toLocaleString("es-AR")}</span>
        </>
      ),
    });
    if (blue.fechaActualizacion) stamps.push(new Date(blue.fechaActualizacion));
  }
  if (euro) {
    tiles.push({
      label: "Euro",
      figure: <Money value={euro.venta} currency="ARS" decimals={0} />,
      foot: (
        <>
          <span>Compra</span>
          <span>$ {euro.compra.toLocaleString("es-AR")}</span>
        </>
      ),
    });
  }
  if (crypto?.bitcoin) {
    tiles.push({ label: "Bitcoin", figure: <Money value={crypto.bitcoin.usd} currency="USD" decimals={0} />, change: crypto.bitcoin.change24h, foot: <span>24 h</span> });
    stamps.push(new Date(crypto.bitcoin.last_updated_at * 1000));
  }
  if (crypto?.ethereum) {
    tiles.push({ label: "Ethereum", figure: <Money value={crypto.ethereum.usd} currency="USD" decimals={0} />, change: crypto.ethereum.change24h, foot: <span>24 h</span> });
  }
  const oldest = stamps.length ? new Date(Math.min(...stamps.map((d) => d.getTime()))) : null;
  return <Rates tiles={tiles} updatedAt={oldest} />;
}
