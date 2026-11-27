import { Suspense } from "react";
import { Section, Skeleton } from "@/components/ui";
import { Hero, Equation, closeMeta } from "@/components/dashboard/Hero";
import { GrowthChart } from "@/components/dashboard/Blocks";
import { ReturnsSection } from "@/components/dashboard/Returns";
import { CloseList, NewCloseButton, type CloseRow } from "@/components/patrimony/Closes";
import { getConverter, getExpenses, getIncomes, getPlatforms, getRates, getSnapshots, getTrades } from "@/lib/data";
import { allIncomes, buildGrowth, buildReturnsView, estimatePatrimony } from "@/lib/compute";
import { currentMonthKey, formatDayMonth, formatMonthName, todayKey } from "@/lib/utils/format";
import { closeEndsPreviousMonth } from "@/lib/utils/patrimony-estimate";

export const metadata = { title: "Patrimonio · Platita" };

export default function PatrimonyPage() {
  return (
    <Suspense fallback={<Skeleton height={560} />}>
      <PatrimonyContent />
    </Suspense>
  );
}

async function PatrimonyContent() {
  const [{ fx }, snapshots, expenses, incomes, trades, conv, platforms] = await Promise.all([
    getRates(),
    getSnapshots(),
    getExpenses(),
    getIncomes(),
    getTrades(),
    getConverter(),
    getPlatforms(),
  ]);
  const current = currentMonthKey();
  const incomeRows = allIncomes(incomes, trades);
  const est = estimatePatrimony({ snapshots, incomes: incomeRows, expenses, trades, fx, currentMonth: current });
  const growth = buildGrowth({ snapshots, incomes: incomeRows, expenses, estimatedArs: est.estimatedArs, conv, history: conv.history, currentMonth: current });
  const returns = buildReturnsView({ snapshots, incomes: incomeRows, expenses, trades, estimatedArs: est.estimatedArs, fx, conv, today: todayKey() });

  const last = est.lastClose;
  const heroArs = est.estimatedArs ?? last?.total_ars ?? 0;
  const change = est.estimatedArs !== null && last && last.total_ars > 0 ? ((est.estimatedArs - last.total_ars) / last.total_ars) * 100 : null;
  const windowLabel = last && !closeEndsPreviousMonth(last.date, current) ? `desde el cierre del ${formatDayMonth(last.date)}` : `de ${formatMonthName(current)}`;

  const formPlatforms = platforms.map((p) => ({ id: p.id, name: p.name, default_currency: p.default_currency }));
  const activePlatforms = platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name, default_currency: p.default_currency }));
  const closes: CloseRow[] = [...snapshots].reverse().map((sn) => {
    const rate = conv.blue(sn.date);
    return {
      id: sn.id,
      date: sn.date,
      notes: sn.notes,
      items: sn.items.map((i) => ({ platform_id: i.platform_id, currency: i.currency, amount: i.amount })),
      total_ars: sn.total_ars,
      total_usd: rate > 0 ? sn.total_ars / rate : null,
    };
  });

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Hero
          label={est.estimatedArs !== null ? "Patrimonio estimado" : "Patrimonio"}
          shareName="hero-figure"
          ars={heroArs}
          usd={fx.usdRate > 0 ? heroArs / fx.usdRate : null}
          change={change}
          changeLabel="desde el último cierre"
          meta={last ? closeMeta(last.date, last.total_ars) : undefined}
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

      <GrowthChart growth={growth} current={current} />

      <ReturnsSection view={returns} />

      <Section
        label="Cierres"
        title="Tus fotos de fin de mes"
        aside={<NewCloseButton platforms={activePlatforms} fx={fx} base={closes[0]} />}
      >
        <CloseList closes={closes} platforms={formPlatforms} fx={fx} />
      </Section>
    </>
  );
}
