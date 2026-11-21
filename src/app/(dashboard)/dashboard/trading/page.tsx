import { Suspense } from "react";
import { Box, Money, Section, Skeleton } from "@/components/ui";
import { Hero } from "@/components/dashboard/Hero";
import { ChartCard, ChartTable, LineChart, chartVars } from "@/components/charts/Charts";
import { NewTradeButton, TradeList } from "@/components/investments/TradeClient";
import { BingxSyncBar } from "@/components/investments/BingxSync";
import { getBingxConnection, getPlatforms, getTrades } from "@/lib/data";
import { runningResultByWeek, tradeStats, type TradeStats } from "@/lib/utils/trading";
import { currentMonthKey, formatAgo, formatMonthName, formatPercent, todayKey, weekStartKey } from "@/lib/utils/format";
import s from "@/components/investments/investments.module.css";

export const metadata = { title: "Trading · Platita" };

/**
 * The trading book, in USD like the PnL it records. Its profits reach the
 * income figures and its losses the estimated patrimony through the pages that
 * own those numbers, not through anything here.
 *
 * A section of its own in the nav, not a tab of Inversiones: it is the page
 * the user opens most.
 */
export default function TradingPage() {
  return (
    <>
      <h1 className="h1">Trading</h1>
      <Suspense fallback={<Skeleton height={480} />}>
        <TradingContent />
      </Suspense>
    </>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Today, this week (Monday to today) and this month, all at once. Weeks and
 * days are Buenos Aires calendar days, like the month.
 */
function PeriodResults({ periods }: { periods: { label: string; stats: TradeStats }[] }) {
  return (
    <Box tone="grey" className={s.periods}>
      <span className={s.statLabel}>Resultado</span>
      <dl className={s.periodList}>
        {periods.map(({ label, stats }, i) => {
          const count = stats.wins + stats.losses;
          return (
            <div key={label} className={s.periodRow} style={{ "--i": i } as React.CSSProperties}>
              <dt className={s.periodName}>{label}</dt>
              <dd className={s.periodValue}>
                {count > 0 ? (
                  <Money className={stats.net >= 0 ? s.in : s.out} value={stats.net} currency="USD" signed />
                ) : (
                  <span className={s.periodEmpty}>—</span>
                )}
              </dd>
              <dd className={s.periodSub}>
                {count > 0 ? `${plural(stats.wins, "ganada", "ganadas")} · ${plural(stats.losses, "perdida", "perdidas")}` : "Sin operaciones"}
              </dd>
            </div>
          );
        })}
      </dl>
    </Box>
  );
}

async function TradingContent() {
  const [trades, platforms, bingx] = await Promise.all([getTrades(), getPlatforms(), getBingxConnection()]);
  const current = currentMonthKey();
  const today = todayKey();
  const all = tradeStats(trades);
  const monthName = formatMonthName(current);
  const periods = [
    { label: "Hoy", stats: tradeStats(trades, { from: today, to: today }) },
    { label: "Esta semana", stats: tradeStats(trades, { from: weekStartKey(today), to: today }) },
    { label: monthName.charAt(0).toUpperCase() + monthName.slice(1), stats: tradeStats(trades, current) },
  ];
  const platformOptions = platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }));

  // Running result, one point per week (by its Monday) since the first operation.
  const { weeks, usd } = runningResultByWeek(trades, today);
  // Dollars only: the peso side of the series is deliberately empty.
  const series = { usd, ars: usd.map(() => null) };

  return (
    <>
      {trades.length > 0 && (
        // One block, read top to bottom: the total, the recent periods, how it
        // got there, and the record. The book stays apart below.
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Trading is always in dollars, the unit its results are entered in — never pesos. */}
          <Hero label="Resultado acumulado" lead="USD" usd={all.net} ars={null} bySign />
          <PeriodResults periods={periods} />
          {weeks.length > 0 && (
            <ChartCard
              title="Resultado acumulado"
              subtitle="Ganancias menos pérdidas, sumadas semana a semana."
              table={<ChartTable currency="USD" period="week" months={weeks} columns={[{ label: "Acumulado", values: series }]} />}
              note="En dólares, como se cargan los resultados."
            >
              <LineChart
                currency="USD"
                period="week"
                months={weeks}
                current={weekStartKey(today)}
                series={[{ key: "net", label: "Acumulado", color: chartVars.line, values: series, area: true, bySign: true }]}
              />
            </ChartCard>
          )}
          <div className={s.tradeStats}>
            <Box tone="grey" className={s.stat}>
              <span className={s.statLabel}>Tasa de acierto</span>
              <span className={s.statValue}>{all.winRate !== null ? formatPercent(all.winRate, { signed: false, decimals: 0 }) : "—"}</span>
              <span className={s.statSub}>
                {all.wins} de {all.wins + all.losses} operaciones
              </span>
            </Box>
            <Box tone="grey" className={s.stat}>
              <span className={s.statLabel}>Operaciones</span>
              <span className={s.statValue}>{trades.length}</span>
              <span className={s.statSub}>desde {all.firstMonth ? formatMonthName(all.firstMonth) : "—"}</span>
            </Box>
          </div>
        </div>
      )}

      <Section label="Libro" title="Operaciones cerradas" aside={<NewTradeButton platforms={platformOptions} />}>
        {bingx && (
          <BingxSyncBar
            status={bingx.last_sync_at ? `BingX · sincronizado ${formatAgo(bingx.last_sync_at)}` : "BingX · todavía no se sincronizó"}
            error={bingx.last_error}
          />
        )}
        <TradeList trades={trades} platforms={platformOptions} suggestBingx={!bingx} />
      </Section>
    </>
  );
}
