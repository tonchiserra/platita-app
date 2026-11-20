"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button, Money } from "@/components/ui";
import { formatMonthKey, formatPercent } from "@/lib/utils/format";
import s from "./chart.module.css";

export interface DonutSlice {
  name: string;
  /** Display label (Spanish for built-in categories). */
  label: string;
  icon?: string;
  ars: number;
  usd: number;
}

export interface DonutMonth {
  month: string;
  slices: DonutSlice[];
}

const R = 76;
const STROKE = 22;
const GAP_PX = 2;

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const p = (a: number) => `${(cx + r * Math.sin(a)).toFixed(3)},${(cy - r * Math.cos(a)).toFixed(3)}`;
  return `M${p(start)}A${r},${r} 0 ${large} 1 ${p(end)}`;
}

/**
 * The month's spending by category. Colour follows the category, not its
 * rank that month: the colours are fixed once over the whole window, so
 * Supermercado keeps its colour as you step between months.
 */
export function MonthlyDonut({
  months,
  colors,
  initialIndex,
}: {
  months: DonutMonth[];
  /** Category name → colour, fixed over every month shown. */
  colors: Record<string, string>;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex ?? months.length - 1);
  if (months.length === 0) return <div className={s.emptyPlot}>Todavía no cargaste gastos.</div>;
  const current = months[Math.min(Math.max(index, 0), months.length - 1)];

  return (
    <div className={s.wrap} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={s.monthNav} aria-live="polite">
        <Button variant="ghost" size="sm" iconOnly aria-label="Mes anterior" disabled={index <= 0} onClick={() => setIndex(index - 1)}>
          <Icon name="chevronLeft" size={18} />
        </Button>
        <span key={current.month} className={s.monthLabel}>
          {formatMonthKey(current.month)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Mes siguiente"
          disabled={index >= months.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          <Icon name="chevronRight" size={18} />
        </Button>
      </div>

      {(["ars"] as const).map((view) => {
        const cur = view === "ars" ? "ARS" : "USD";
        const slices = current.slices.filter((x) => x[view] > 0).sort((a, b) => b[view] - a[view]);
        const total = slices.reduce((sum, x) => sum + x[view], 0);
        const gap = GAP_PX / R;
        let angle = 0;

        return (
          // Keyed by month as well, so stepping to another month redraws the donut.
          <div key={`${view}-${current.month}`} className={s.donutWrap}>
            <div className={s.donut}>
              <svg viewBox="0 0 200 200" role="img" aria-label={`Gastos de ${formatMonthKey(current.month)} por categoría`}>
                {total === 0 ? (
                  <circle cx={100} cy={100} r={R} fill="none" stroke="var(--block)" strokeWidth={STROKE} />
                ) : (
                  slices.map((slice, i) => {
                    const sweep = (slice[view] / total) * Math.PI * 2;
                    const start = angle + (slices.length > 1 ? gap / 2 : 0);
                    const end = angle + sweep - (slices.length > 1 ? gap / 2 : 0);
                    angle += sweep;
                    if (slices.length === 1)
                      return <circle key={slice.name} cx={100} cy={100} r={R} fill="none" stroke={colors[slice.name]} strokeWidth={STROKE} className={s.donutSeg} />;
                    if (end <= start) return null;
                    return (
                      <path
                        key={slice.name}
                        d={arc(100, 100, R, start, end)}
                        fill="none"
                        stroke={colors[slice.name]}
                        strokeWidth={STROKE}
                        className={s.donutSeg}
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <title>{`${slice.label}: ${formatPercent((slice[view] / total) * 100, { signed: false })}`}</title>
                      </path>
                    );
                  })
                )}
              </svg>
              <div className={s.donutCenter}>
                <span className={s.donutLabel}>Total</span>
                <Money className={s.donutTotal} value={total} currency={cur} compact={total >= 1e7} decimals={0} />
              </div>
            </div>
            {slices.length === 0 ? (
              <p className="muted">Sin gastos este mes.</p>
            ) : (
              <ol className={s.rank} aria-label="Categorías de mayor a menor">
                {slices.map((slice, i) => (
                  <li key={slice.name} className={s.rankRow} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                    <span className={s.keyRect} style={{ background: colors[slice.name] }} aria-hidden="true" />
                    <span className={s.rankName}>
                      {slice.icon && <span aria-hidden="true">{slice.icon} </span>}
                      {slice.label}
                    </span>
                    <Money className={s.rankValue} value={slice[view]} currency={cur} decimals={0} />
                    <span className={s.rankPct}>{formatPercent((slice[view] / total) * 100, { signed: false, decimals: 0 })}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
