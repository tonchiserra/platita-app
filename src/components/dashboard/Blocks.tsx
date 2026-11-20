import { Box, Delta, Money, Section } from "@/components/ui";
import { BarChart, ChartCard, ChartTable, Legend, chartVars } from "@/components/charts/Charts";
import { formatTimeOfDay, formatPercent } from "@/lib/utils/format";
import type { MonthlySeries } from "@/lib/compute";
import s from "./dashboard.module.css";

/* ---------- Month summary: entró / salió / quedó ---------- */

export function MonthSummary({
  monthName,
  income,
  expense,
  incomeChange,
  expenseChange,
  lossUsd,
}: {
  monthName: string;
  income: { ars: number; usd: number };
  expense: { ars: number; usd: number };
  incomeChange?: number | null;
  expenseChange?: number | null;
  lossUsd?: number;
}) {
  const left = { ars: income.ars - expense.ars, usd: income.usd - expense.usd };
  // The legacy home's bar: of what came in, the share spent and the share kept.
  const spentPct = income.ars > 0 ? Math.min((expense.ars / income.ars) * 100, 100) : 0;
  const keptPct = 100 - spentPct;
  const overspentPct = income.ars > 0 && expense.ars > income.ars ? (expense.ars / income.ars - 1) * 100 : 0;
  const pct = (v: number) => formatPercent(v, { signed: false, decimals: 1 });
  return (
    <Section label={`Tu ${monthName}`}>
      <div className={s.summary}>
        <Box tone="grey" className={s.stat}>
          <span className={s.statLabel}>Entró</span>
          <Money className={s.statValue} value={income.ars} currency="ARS" />
          <Money className={s.statUsd} value={income.usd} currency="USD" decimals={0} />
          <Delta value={incomeChange} suffix="vs. mes anterior" />
        </Box>
        <Box tone="grey" className={s.stat}>
          <span className={s.statLabel}>Salió</span>
          <Money className={s.statValue} value={expense.ars} currency="ARS" />
          <Money className={s.statUsd} value={expense.usd} currency="USD" decimals={0} />
          <Delta value={expenseChange} goodWhen="down" suffix="vs. mes anterior" />
        </Box>
        <Box tone={left.ars >= 0 ? "up" : "down"} className={s.stat}>
          <span className={s.statLabel}>Quedó</span>
          <Money className={s.statValue} value={left.ars} currency="ARS" signed />
          <Money className={s.statUsd} value={left.usd} currency="USD" decimals={0} signed />
          {!!lossUsd && lossUsd > 0 && (
            <span className={s.statNote}>
              Además, el trading perdió <Money value={lossUsd} currency="USD" decimals={0} />
            </span>
          )}
        </Box>
      </div>
      {income.ars > 0 && (
        <div className={s.flow}>
          <div
            className={s.flowBar}
            role="img"
            aria-label={
              overspentPct > 0
                ? `Gastaste ${pct(overspentPct)} más de lo que entró`
                : `${pct(spentPct)} se fue en gastos y ${pct(keptPct)} quedó`
            }
          >
            {spentPct > 0 && <span className={s.flowSpent} style={{ width: `${spentPct}%` }} />}
            {keptPct > 0 && <span className={s.flowKept} style={{ width: `${keptPct}%` }} />}
          </div>
          <div className={s.flowLegend} aria-hidden="true">
            {overspentPct > 0 ? (
              <span className={s.flowItem}>
                <span className={s.flowKey} style={{ background: "var(--chart-expense)" }} />
                <span className={s.flowOut}>Gastaste {pct(overspentPct)} más de lo que entró</span>
              </span>
            ) : (
              <>
                <span className={s.flowItem}>
                  <span className={s.flowKey} style={{ background: "var(--chart-expense)" }} />
                  <span className={s.flowOut}>{pct(spentPct)} se fue en gastos</span>
                </span>
                <span className={s.flowItem}>
                  <span className={s.flowKey} style={{ background: "var(--chart-income)" }} />
                  <span className={s.flowIn}>{pct(keptPct)} quedó</span>
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ---------- Chart 3: ingresos vs. gastos ---------- */

export function CashflowChart({ months, income, expense, current }: { months: string[]; income: MonthlySeries; expense: MonthlySeries; current: string }) {
  return (
    <ChartCard
      title="Ingresos vs. gastos"
      subtitle="Lo que entró y lo que salió cada mes. La diferencia es lo que quedó."
      legend={
        <Legend
          items={[
            { label: "Ingresos", color: chartVars.income },
            { label: "Gastos", color: chartVars.expense },
          ]}
        />
      }
      table={
        <ChartTable
          months={months}
          columns={[
            { label: "Ingresos", values: income },
            { label: "Gastos", values: expense },
            {
              label: "Quedó",
              values: { ars: income.ars.map((v, i) => v - expense.ars[i]), usd: income.usd.map((v, i) => v - expense.usd[i]) },
            },
          ]}
        />
      }
      note="Los movimientos en dólares se pasan a pesos al blue de su fecha."
    >
      <BarChart
        months={months}
        current={current}
        diffLabel="Quedó"
        series={[
          { key: "income", label: "Ingresos", color: chartVars.income, values: income },
          { key: "expense", label: "Gastos", color: chartVars.expense, values: expense },
        ]}
      />
    </ChartCard>
  );
}

/* ---------- Chart 4/5: crecimiento de capital, vs. dolarizado, with its time range ---------- */

export { GrowthChart } from "@/components/charts/GrowthChart";

/* ---------- Cotizaciones ---------- */

export interface RateTile {
  label: string;
  figure: React.ReactNode;
  foot?: React.ReactNode;
  change?: number | null;
}

export function Rates({ tiles, updatedAt }: { tiles: RateTile[]; updatedAt?: Date | null }) {
  if (tiles.length === 0) return null;
  return (
    <Section label="Cotizaciones" aside={updatedAt ? <span className={s.ratesNote}>Actualizado {formatTimeOfDay(updatedAt)}</span> : undefined}>
      <div className={s.rates}>
        {tiles.map((t) => (
          <article key={t.label} className={s.rate}>
            <div className={s.rateHead}>
              <span>{t.label}</span>
              {t.change !== undefined && t.change !== null && (
                <span>
                  {t.change > 0 ? "▲" : t.change < 0 ? "▼" : "="} {formatPercent(Math.abs(t.change), { signed: false })}
                </span>
              )}
            </div>
            <div className={s.rateFigure}>{t.figure}</div>
            {t.foot && <div className={s.rateFoot}>{t.foot}</div>}
          </article>
        ))}
      </div>
    </Section>
  );
}
