import { Suspense } from "react";
import { Box, Money, Section, Skeleton } from "@/components/ui";
import { Hero } from "@/components/dashboard/Hero";
import { ChartCard, ChartTable, LineChart, chartVars } from "@/components/charts/Charts";
import { NewTradeButton, TradeList } from "@/components/investments/TradeClient";
import { BingxSyncBar } from "@/components/investments/BingxSync";
import { getBingxConnection, getPlatforms, getTrades } from "@/lib/data";
import { tradeStats } from "@/lib/utils/trading";
import { currentMonthKey, formatAgo, formatMonthName, formatPercent, monthRange } from "@/lib/utils/format";
import s from "@/components/investments/investments.module.css";

export const metadata = { title: "Trading · Platita" };

/**
 * The trading book, in USD like the PnL it records. Its profits reach the
 * income figures and its losses the estimated patrimony through the pages that
 * own those numbers, not through anything here.
 */
export default function TradingPage() {
  return (
    <Suspense fallback={<Skeleton height={480} />}>
      <TradingContent />
    </Suspense>
  );
}

async function TradingContent() {
  const [trades, platforms, bingx] = await Promise.all([getTrades(), getPlatforms(), getBingxConnection()]);
  const current = currentMonthKey();
  const month = tradeStats(trades, current);
  const all = tradeStats(trades);
  const platformOptions = platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }));

  // Running result, one point per calendar month since the first operation.
  const months = all.firstMonth ? monthRange(all.firstMonth, current) : [];
  const netByMonth = new Map<string, number>();
  for (const t of trades) netByMonth.set(t.date.slice(0, 7), (netByMonth.get(t.date.slice(0, 7)) ?? 0) + t.pnl_usd);
  const usd: number[] = [];
  for (const m of months) usd.push((usd[usd.length - 1] ?? 0) + (netByMonth.get(m) ?? 0));
  // Dollars only: the peso side of the series is deliberately empty.
  const series = { usd, ars: usd.map(() => null) };

  return (
    <>
      {trades.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Trading is always in dollars, the unit its results are entered in — never pesos. */}
          <Hero label="Resultado acumulado" lead="USD" usd={all.net} ars={null} bySign />
          <div className={s.summary}>
            <Box tone={month.net >= 0 ? "up" : "down"} className={s.stat}>
              <span className={s.statLabel}>Resultado de {formatMonthName(current)}</span>
              <Money className={s.statValue} value={month.net} currency="USD" signed />
              <span className={s.statSub}>
                {month.wins} ganadas · {month.losses} perdidas
              </span>
            </Box>
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

      {months.length > 0 && (
        <ChartCard
          title="Resultado acumulado"
          subtitle="Ganancias menos pérdidas, sumadas mes a mes."
          table={<ChartTable currency="USD" months={months} columns={[{ label: "Acumulado", values: series }]} />}
          note="En dólares, como se cargan los resultados."
        >
          <LineChart
            currency="USD"
            months={months}
            current={current}
            series={[{ key: "net", label: "Acumulado", color: chartVars.line, values: series, area: true, bySign: true }]}
          />
        </ChartCard>
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
