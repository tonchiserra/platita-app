import { Box, Money, Section } from "@/components/ui";
import { ChartCard, ChartTable, LineChart, chartVars } from "@/components/charts/Charts";
import { formatDayMonth, formatPercent, monthRange } from "@/lib/utils/format";
import type { ReturnsView } from "@/lib/compute";
import s from "./dashboard.module.css";

/** `▲ 6,6 %`: a gain or a loss always carries its triangle as well as its colour. */
function Rate({ value, className }: { value: number; className?: string }) {
  const pct = value * 100;
  const flat = Math.abs(pct) < 0.05;
  const tone = flat ? undefined : pct > 0 ? s.heroUp : s.heroDown;
  return (
    <span className={[className, tone].filter(Boolean).join(" ")}>
      <span aria-hidden="true">{flat ? "= " : pct > 0 ? "▲ " : "▼ "}</span>
      <span className="visually-hidden">{flat ? "sin cambios " : pct > 0 ? "sube " : "baja "}</span>
      {formatPercent(Math.abs(pct), { signed: false })}
    </span>
  );
}

/**
 * Rendimiento: how much the net worth grew beyond what was saved into it, in
 * dollars. Savings (salary and other income minus expenses) are put aside, so
 * what is left is what the money itself did: the dollar, investments,
 * interest and trading.
 */
export function ReturnsSection({ view }: { view: ReturnsView | null }) {
  if (!view) {
    return (
      <Section label="Rendimiento" title="Lo que generó tu plata">
        <Box tone="grey">
          <p className={s.statNote}>
            Hacen falta dos cierres con ingresos y gastos cargados entre ellos para separar lo que ahorraste de lo que rindió tu
            plata.
          </p>
        </Box>
      </Section>
    );
  }

  const since = formatDayMonth(view.startDate);
  const otherUsd = view.gainUsd - view.tradingUsd;
  const changeUsd = view.endUsd - view.startUsd;

  // One column per month from the opening close, which sits at zero.
  const first = view.startDate.slice(0, 7);
  const lastMonth = view.months[view.months.length - 1].month;
  const months = monthRange(first, lastMonth);
  const byMonth = new Map(view.months.map((m) => [m.month, m]));
  const cumulative = months.map((m) => (m === first ? 0 : byMonth.get(m)?.cumulativeGainUsd ?? null));
  const monthly = months.map((m) => (m === first ? null : byMonth.get(m)?.gainUsd ?? null));
  const saved = months.map((m) => (m === first ? null : byMonth.get(m)?.savedUsd ?? null));
  const notes = months.map((m) => {
    if (m === first) return `Cierre del ${since}: punto de partida`;
    const row = byMonth.get(m);
    if (!row) return undefined;
    const rate = row.rate === null ? "" : `${formatPercent(row.rate * 100)} en el mes`;
    return row.estimate ? `${rate} · Estimado a hoy` : rate;
  });
  const estimateFrom = view.estimate ? months.length - 2 : undefined;
  const none = months.map(() => null);
  const usd = (values: (number | null)[]) => ({ ars: none, usd: values });

  return (
    <Section label="Rendimiento" title="Lo que generó tu plata">
      <div className={s.summary}>
        <Box tone={view.gainUsd >= 0 ? "up" : "down"} className={s.stat}>
          <span className={s.statLabel}>Rendimiento</span>
          <Rate className={s.statValue} value={view.rate} />
          <Money className={s.statUsd} value={view.gainUsd} currency="USD" decimals={0} signed />
          <span className={s.statNote}>
            Desde el {since}
            {view.estimate ? ", estimado a hoy" : ""}
          </span>
        </Box>
        <Box tone="grey" className={s.stat}>
          <span className={s.statLabel}>Ahorraste</span>
          <Money className={s.statValue} value={view.savedUsd} currency="USD" decimals={0} />
          <span className={s.statNote}>Ingresos menos gastos. No es rendimiento: es plata que pusiste.</span>
        </Box>
        <Box tone="grey" className={s.stat}>
          <span className={s.statLabel}>De dónde salió</span>
          <span className={s.statUsd}>
            Trading <Money value={view.tradingUsd} currency="USD" decimals={0} signed />
          </span>
          <span className={s.statUsd}>
            Dólar, inversiones e intereses <Money value={otherUsd} currency="USD" decimals={0} signed />
          </span>
        </Box>
      </div>

      <p className={s.statNote}>
        Tu patrimonio pasó de <Money value={view.startUsd} currency="USD" decimals={0} /> a{" "}
        <Money value={view.endUsd} currency="USD" decimals={0} /> (<Money value={changeUsd} currency="USD" decimals={0} signed />
        ): <Money value={view.savedUsd} currency="USD" decimals={0} signed /> de ahorro y{" "}
        <Money value={view.gainUsd} currency="USD" decimals={0} signed /> de rendimiento.
      </p>

      <ChartCard
        title="Rendimiento acumulado"
        subtitle="Lo que ganó o perdió tu plata sumado mes a mes, sin contar lo que ahorraste."
        table={
          <ChartTable
            currency="USD"
            months={months.filter((m) => m !== first)}
            columns={[
              { label: "Rendimiento", values: usd(monthly.slice(1)) },
              { label: "Ahorro", values: usd(saved.slice(1)) },
              { label: "Acumulado", values: usd(cumulative.slice(1)) },
            ]}
          />
        }
        note={
          <>
            En dólares, cada cierre y cada movimiento al blue de su fecha: en pesos la inflación haría parecer ganancia cualquier
            saldo. El rendimiento es lo que creció el patrimonio menos lo que ahorraste. El porcentaje de cada mes es esa ganancia
            sobre el capital que estuvo trabajando (un sueldo que entra a fin de mes casi no cuenta), y los meses se encadenan.
            Empieza en el {since} porque antes no hay ingresos y gastos cargados.
            {view.estimate ? " El último punto es el patrimonio estimado de hoy." : ""}
          </>
        }
      >
        <LineChart
          currency="USD"
          months={months}
          current={view.estimate ? lastMonth : undefined}
          notes={notes}
          series={[
            { key: "gain", label: "Rendimiento acumulado", color: chartVars.line, values: usd(cumulative), area: true, bySign: true, connect: true, estimateFrom },
          ]}
        />
      </ChartCard>
    </Section>
  );
}
