import { Suspense } from "react";
import { Section, Skeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { Hero } from "@/components/dashboard/Hero";
import { ChartCard, ChartTable, Legend, LineChart, chartVars } from "@/components/charts/Charts";
import { NewOperationButton, OperationList } from "@/components/investments/PortfolioClient";
import { PortfolioSummaryBoxes, PositionCards } from "@/components/investments/Positions";
import { getPlatforms, hasSidesColumn } from "@/lib/data";
import { getPerformance, getPortfolio } from "@/lib/compute/portfolio";
import { currentMonthKey } from "@/lib/utils/format";
import s from "@/components/investments/investments.module.css";

export const metadata = { title: "Inversiones · Platita" };

export default function InvestmentsPage() {
  return (
    <>
      <h1 className="h1">Inversiones</h1>
      <Suspense fallback={<Skeleton height={520} />}>
        <PortfolioContent />
      </Suspense>
    </>
  );
}

async function PortfolioContent() {
  const [{ ops, positions, summary, manualByKey, manualAvailable, conv }, platforms, canSell] = await Promise.all([
    getPortfolio(),
    getPlatforms(),
    hasSidesColumn(),
  ]);
  const platformOptions = platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }));
  const known = positions.map((p) => ({ asset: p.asset, assetType: p.assetType, units: p.units }));
  const usdRate = conv.fx.usdRate;
  const gainPct = summary.unrealizedPct;

  return (
    <>
      {!canSell && (
        <p className={s.banner} role="note">
          <Icon name="info" size={20} />
          <span>
            Para registrar ventas y precios manuales, aplicá la migración <code>004_performance_and_investments.sql</code> en el SQL editor de Supabase.
          </span>
        </p>
      )}

      {ops.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Hero
            label="Valor de la cartera"
            usd={summary.valueUsd}
            ars={usdRate > 0 ? summary.valueUsd * usdRate : null}
            change={gainPct}
            changeLabel="sobre lo invertido"
            meta={summary.unpricedAssets.length > 0 ? `Sin precio, valuados al costo: ${summary.unpricedAssets.join(", ")}.` : undefined}
          />
          <PortfolioSummaryBoxes summary={summary} usdRate={usdRate} />
        </div>
      )}

      {ops.length > 0 && (
        <Suspense fallback={<Skeleton height={340} />}>
          <PerformanceChart />
        </Suspense>
      )}

      {ops.length > 0 && (
        <PositionCards positions={positions} manual={new Map([...manualByKey].map(([k, r]) => [k, { price: r.price, currency: r.currency }]))} manualAvailable={manualAvailable} />
      )}

      <Section label="Operaciones" title="Compras y ventas" aside={<NewOperationButton platforms={platformOptions} assets={known} canSell={canSell} />}>
        <OperationList
          operations={ops.map((o) => ({ ...o }))}
          platforms={platformOptions}
          assets={known}
          canSell={canSell}
        />
      </Section>
    </>
  );
}

async function PerformanceChart() {
  const perf = await getPerformance();
  if (!perf) return null;
  const current = currentMonthKey();
  const notes = perf.atCost.map((c) => (c ? "Algún activo sin precio ese mes: va al costo" : undefined));
  return (
    <ChartCard
      title="Rendimiento"
      subtitle="Lo que pusiste contra lo que vale, mes a mes."
      legend={
        <Legend
          items={[
            { label: "Valor de mercado", color: chartVars.line, kind: "line" },
            { label: "Capital invertido", color: chartVars.line2, kind: "line" },
          ]}
        />
      }
      table={
        <ChartTable
          months={perf.months}
          columns={[
            { label: "Valor", values: perf.value },
            { label: "Invertido", values: perf.invested },
          ]}
        />
      }
      note="Invertido: compras menos lo cobrado por ventas. En ARS, el valor se pasa al blue de cada mes."
    >
      <LineChart
        months={perf.months}
        current={current}
        notes={notes}
        series={[
          { key: "value", label: "Valor", color: chartVars.line, values: perf.value, area: true },
          { key: "invested", label: "Invertido", color: chartVars.line2, values: perf.invested },
        ]}
      />
    </ChartCard>
  );
}
