import { useId, type CSSProperties, type ReactNode } from "react";
import { Delta, LineLabel, Money } from "@/components/ui";
import { formatMonthKey, formatMonthTick } from "@/lib/utils/format";
import { labelStep, lineScale, zeroScale } from "./scale";
import s from "./chart.module.css";

export type Cur = "ARS" | "USD";
type Views = { ars: (number | null)[]; usd: (number | null)[] };

const cx = (...n: (string | false | undefined)[]) => n.filter(Boolean).join(" ");
const PLOT_H = 184;

/* =====================================================================
 * Card
 * ===================================================================== */

export function ChartCard({
  label,
  title,
  subtitle,
  legend,
  toggle,
  table,
  note,
  extra,
  children,
}: {
  label?: string;
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  /** A chip that swaps `[data-toggle-view]` children: used for "vs. dolarizado". */
  toggle?: { label: string };
  table?: ReactNode;
  note?: ReactNode;
  /** Extra controls before the toggle and the currency switch (e.g. the time range). */
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cx(s.card, toggle && s.cardWithToggle)} aria-label={title}>
      <div className={s.head}>
        <div className={s.titles}>
          {label && <LineLabel>{label}</LineLabel>}
          <h3 className={s.title}>{title}</h3>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {(extra || toggle) && (
          <div className={s.controls}>
            {extra}
            {toggle && (
              <label className={s.toggle}>
                <input type="checkbox" />
                <span className={s.toggleDot} aria-hidden="true" />
                {toggle.label}
              </label>
            )}
          </div>
        )}
      </div>
      {legend}
      {children}
      {(table || note) && (
        <div className={s.foot}>
          {note ? <p className={s.note}>{note}</p> : <span />}
          {table}
        </div>
      )}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "rect" | "line" | "dash" }[] }) {
  return (
    <ul className={s.legend} aria-label="Referencias">
      {items.map((i) => (
        <li key={i.label} className={s.legendItem}>
          <span
            aria-hidden="true"
            className={i.kind === "rect" || !i.kind ? s.keyRect : cx(s.keyLine, i.kind === "dash" && s.keyDash)}
            style={i.kind === "rect" || !i.kind ? { background: i.color } : { borderTopColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* =====================================================================
 * Table view — every value reachable without hovering
 * ===================================================================== */

export function ChartTable({
  months,
  columns,
  currency = "ARS",
}: {
  months: string[];
  columns: { label: string; values: Views }[];
  currency?: Cur;
}) {
  return (
    <details className={s.details}>
      <summary>Ver tabla</summary>
      <div className={s.tableWrap}>
        {[currency === "USD" ? ("usd" as const) : ("ars" as const)].map((view) => (
          <table key={view} className={s.table}>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                {columns.map((c) => (
                  <th key={c.label} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months
                .map((m, i) => ({ m, i }))
                .reverse()
                .map(({ m, i }) => (
                  <tr key={m}>
                    <th scope="row" style={{ fontWeight: 400 }}>
                      {formatMonthKey(m)}
                    </th>
                    {columns.map((c) => {
                      const v = c.values[view][i];
                      return (
                        <td key={c.label}>
                          {v === null || v === undefined ? "—" : <Money value={v} currency={view === "ars" ? "ARS" : "USD"} decimals={0} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        ))}
      </div>
    </details>
  );
}

/* =====================================================================
 * Shared axis pieces
 * ===================================================================== */

function YAxis({ ticks, y }: { ticks: number[]; y: (v: number) => number }) {
  return (
    <>
      {ticks.map((t) => (
        <span key={t} className={s.yTick} style={{ top: y(t) }}>
          {formatAxisTick(t, ticks)}
        </span>
      ))}
    </>
  );
}

/** Compact, with one decimal whenever rounding would make two ticks look alike (22,5 M, not 23 M). */
function formatAxisTick(value: number, ticks: number[]) {
  if (value === 0) return "0";
  const max = Math.max(...ticks.map(Math.abs));
  const unit = max >= 1e9 ? 1e9 : max >= 1e6 ? 1e6 : max >= 1e3 ? 1e3 : 1;
  const suffix = unit === 1e9 ? " B" : unit === 1e6 ? " M" : unit === 1e3 ? " k" : "";
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) / unit : 1;
  const decimals = unit === 1 ? 0 : Number.isInteger(Math.round(step * 1000) / 1000) ? 0 : step < 0.1 ? 2 : 1;
  const sign = value < 0 ? "−" : "";
  return `${sign}${(Math.abs(value) / unit).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}

function Grid({ ticks, y, baseline }: { ticks: number[]; y: (v: number) => number; baseline?: number }) {
  return (
    <svg className={cx(s.svg, s.grid)} aria-hidden="true">
      {ticks.map((t) => (
        <line key={t} x1="0" x2="100%" y1={y(t)} y2={y(t)} className={t === baseline ? s.baseline : undefined} />
      ))}
    </svg>
  );
}

function XAxis({ months, current }: { months: string[]; current?: string }) {
  const step = labelStep(months.length);
  const spansYears = months.length > 0 && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
  // Count back from the newest month so the most recent one is always labelled.
  const last = months.length - 1;
  return (
    <div className={s.xAxis} aria-hidden="true">
      {months.map((m, i) =>
        (last - i) % step === 0 ? (
          <span
            key={m}
            className={cx(s.xTick, m === current && s.xTickCurrent)}
            style={{ left: `${((i + 0.5) / months.length) * 100}%` }}
          >
            {formatMonthTick(m, spansYears && (i === 0 || m.endsWith("-01")))}
          </span>
        ) : null
      )}
    </div>
  );
}

function tipAlign(i: number, n: number) {
  if (n < 3) return undefined;
  if (i < n / 4) return s.tipStart;
  if (i >= (n * 3) / 4) return s.tipEnd;
  return undefined;
}

export interface TipRow {
  label: string;
  color?: string;
  kind?: "rect" | "line" | "dash";
  value: number | null;
  strong?: boolean;
}

function Tip({
  title,
  rows,
  cur,
  note,
  className,
  change,
}: {
  title: string;
  rows: TipRow[];
  cur: Cur;
  note?: string;
  className?: string;
  /** Change against the previous month, percent, and which direction is good news. */
  change?: { value: number | null; goodWhen: "up" | "down" };
}) {
  return (
    <div className={cx(s.tip, className)} role="tooltip">
      <p className={s.tipTitle}>{title}</p>
      {rows.map((r) =>
        r.label === "—" ? (
          <div key={`sep-${r.value}`} className={s.tipSep} />
        ) : (
          <div key={r.label} className={s.tipRow}>
            <span className={s.tipName}>
              {r.color && (
                <span
                  aria-hidden="true"
                  className={r.kind === "rect" ? s.keyRect : cx(s.keyLine, r.kind === "dash" && s.keyDash)}
                  style={r.kind === "rect" ? { background: r.color } : { borderTopColor: r.color }}
                />
              )}
              {r.label}
            </span>
            <span className={s.tipValue} style={r.strong ? { fontSize: 13 } : undefined}>
              {r.value === null ? "—" : <Money value={r.value} currency={cur} decimals={0} signed={r.label === "Quedó"} />}
            </span>
          </div>
        )
      )}
      {change && change.value !== null && (
        <div className={s.tipRow} style={{ marginTop: 6 }}>
          <span className={s.tipName} style={{ whiteSpace: "nowrap" }}>
            vs. mes anterior
          </span>
          <Delta value={change.value} goodWhen={change.goodWhen} />
        </div>
      )}
      {note && <p className={s.tipNote}>{note}</p>}
    </div>
  );
}

function srSummary(month: string, rows: TipRow[], cur: Cur) {
  const fmt = (v: number | null) => (v === null ? "sin dato" : `${Math.round(v).toLocaleString("es-AR")} ${cur}`);
  return `${formatMonthKey(month)}: ${rows.filter((r) => r.label !== "—").map((r) => `${r.label} ${fmt(r.value)}`).join(", ")}`;
}

/* =====================================================================
 * Bars — one series, or two grouped (ingresos vs. gastos)
 * ===================================================================== */

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  values: Views;
}

export function BarChart({
  months,
  series,
  current,
  diffLabel,
  monthChange,
  height = PLOT_H,
}: {
  months: string[];
  series: BarSeries[];
  /** The open month: drawn lighter, because it is not over yet. */
  current?: string;
  /** With two series, add a "first − second" row to the readout. */
  diffLabel?: string;
  /** With one series, add the change against the previous month to the readout. */
  monthChange?: { goodWhen: "up" | "down" };
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  if (months.length === 0) return <div className={s.emptyPlot}>Todavía no hay movimientos para graficar.</div>;

  return (
    <>
      {(["ars"] as const).map((view) => {
        const cur: Cur = view === "ars" ? "ARS" : "USD";
        const all = series.flatMap((x) => x.values[view].map((v) => v ?? 0));
        const { domain, ticks } = zeroScale(Math.max(0, ...all));
        const top = 4;
        const y = (v: number) => top + (1 - v / domain[1]) * (height - top);
        const n = months.length;
        const colW = 100 / n;
        const groupW = Math.min(colW * 0.72, colW - 0.6);
        const gap = series.length > 1 ? Math.min(0.5, colW * 0.04) : 0;
        const barW = (groupW - gap * (series.length - 1)) / series.length;
        const clip = `bars-${uid}-${view}`;

        return (
          <div key={view} className={s.chart}>
            <div className={s.plot} style={{ height }}>
              <YAxis ticks={ticks} y={y} />
              <Grid ticks={ticks} y={y} baseline={0} />
              <svg className={s.svg} aria-hidden="true">
                <defs>
                  <clipPath id={clip}>
                    <rect x="0" y="0" width="100%" height={y(0)} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${clip})`}>
                  {months.map((m, i) =>
                    series.map((ser, j) => {
                      const v = ser.values[view][i] ?? 0;
                      if (v <= 0) return null;
                      const x = i * colW + (colW - groupW) / 2 + j * (barW + gap);
                      return (
                        <rect
                          key={`${m}-${ser.key}`}
                          className={s.bar}
                          style={{ "--i": i } as CSSProperties}
                          x={`${x}%`}
                          width={`${barW}%`}
                          y={y(v)}
                          // Taller than the bar by its radius, clipped at the
                          // baseline: rounded data end, square foot.
                          height={y(0) - y(v) + 4}
                          rx={3}
                          fill={ser.color}
                          opacity={m === current ? 0.45 : 1}
                        />
                      );
                    })
                  )}
                </g>
              </svg>
              <div className={s.cols}>
                {months.map((m, i) => {
                  const rows: TipRow[] = series.map((ser) => ({ label: ser.label, color: ser.color, kind: "rect", value: ser.values[view][i] }));
                  if (diffLabel && series.length === 2) {
                    const a = series[0].values[view][i] ?? 0;
                    const b = series[1].values[view][i] ?? 0;
                    rows.push({ label: "—", value: i }, { label: diffLabel, value: a - b, strong: true });
                  }
                  let change: { value: number | null; goodWhen: "up" | "down" } | undefined;
                  if (monthChange && series.length === 1 && i > 0) {
                    const prev = series[0].values[view][i - 1] ?? 0;
                    const now = series[0].values[view][i] ?? 0;
                    change = { value: prev > 0 ? ((now - prev) / prev) * 100 : null, goodWhen: monthChange.goodWhen };
                  }
                  const label = srSummary(m, rows, cur) + (change?.value != null ? `, ${change.value >= 0 ? "sube" : "baja"} ${Math.abs(change.value).toLocaleString("es-AR", { maximumFractionDigits: 1 })} % vs. mes anterior` : "");
                  return (
                    <div key={m} className={s.col} tabIndex={0} aria-label={label}>
                      <Tip
                        title={formatMonthKey(m)}
                        rows={rows}
                        cur={cur}
                        note={m === current ? "Mes en curso" : undefined}
                        className={tipAlign(i, n)}
                        change={change}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <XAxis months={months} current={current} />
          </div>
        );
      })}
    </>
  );
}

/* =====================================================================
 * Lines — capital growth (with its estimate) and the dollarized path
 * ===================================================================== */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: Views;
  /** A 10% wash under the line. */
  area?: boolean;
  /** Index from which the line is a projection (dashed). */
  estimateFrom?: number;
  /** Draw straight across months with no value instead of breaking the line. */
  connect?: boolean;
  /**
   * Colour by sign instead of `color`: green above zero, red below, split at
   * the zero line. The wash then fills to zero rather than to the axis floor.
   */
  bySign?: boolean;
}

const VB_W = 1000;
const SIGN = { up: "var(--up)", down: "var(--down)" } as const;

function pathFor(values: (number | null)[], n: number, y: (v: number) => number, from = 0, to = values.length - 1, connect = false) {
  let d = "";
  let pen = false;
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v === null || v === undefined) {
      if (!connect) pen = false;
      continue;
    }
    const x = ((i + 0.5) / n) * VB_W;
    d += `${pen ? "L" : "M"}${x.toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  }
  return d;
}

export function LineChart({
  months,
  series,
  current,
  height = PLOT_H,
  notes,
  currency = "ARS",
}: {
  months: string[];
  series: LineSeries[];
  current?: string;
  height?: number;
  /** Per-month footnote for the readout, e.g. "Estimado". */
  notes?: (string | undefined)[];
  /** The app charts in pesos; the trading book is the one place that stays in dollars. */
  currency?: Cur;
}) {
  const uid = useId().replace(/:/g, "");
  if (months.length === 0) return <div className={s.emptyPlot}>Cargá tu primer cierre de patrimonio para ver cómo crece.</div>;

  return (
    <>
      {[currency === "USD" ? ("usd" as const) : ("ars" as const)].map((view) => {
        const cur: Cur = view === "ars" ? "ARS" : "USD";
        const values = series.flatMap((x) => x.values[view].filter((v): v is number => v !== null));
        if (values.length === 0)
          return (
            <div key={view} className={s.emptyPlot}>
              Sin datos en {cur}.
            </div>
          );
        const signed = series.some((x) => x.bySign);
        // A sign-coloured chart always shows its zero line.
        const { domain, ticks } = lineScale(signed ? [...values, 0] : values);
        const top = 8;
        const bottom = height - 4;
        const y = (v: number) => top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (bottom - top);
        const n = months.length;
        const zeroY = Math.min(bottom, Math.max(top, y(0)));
        const zeroAt = zeroY / height;
        const gradId = `sign-${uid}-${view}`;
        const colorOf = (ser: LineSeries, v: number | null) => (ser.bySign ? (v !== null && v < 0 ? SIGN.down : SIGN.up) : ser.color);

        return (
          <div key={view} className={s.chart}>
            <div className={s.plot} style={{ height }}>
              <YAxis ticks={ticks} y={y} />
              <Grid ticks={ticks} y={y} baseline={signed ? 0 : undefined} />
              <svg className={cx(s.svg, s.lineLayer)} viewBox={`0 0 ${VB_W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
                {signed && (
                  <defs>
                    {/* Hard stop at the zero line: one paint, two colours. */}
                    <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
                      <stop offset={zeroAt} stopColor={SIGN.up} />
                      <stop offset={zeroAt} stopColor={SIGN.down} />
                    </linearGradient>
                  </defs>
                )}
                {series.map((ser) => {
                  const vals = ser.values[view];
                  const paint = ser.bySign ? `url(#${gradId})` : ser.color;
                  const solidTo = ser.estimateFrom !== undefined ? ser.estimateFrom : vals.length - 1;
                  const solid = pathFor(vals, n, y, 0, solidTo, ser.connect);
                  const dashed = ser.estimateFrom !== undefined ? pathFor(vals, n, y, ser.estimateFrom, vals.length - 1, true) : "";
                  // The wash closes down to the axis floor under the solid stretch.
                  let area = "";
                  if (ser.area && solid) {
                    const idx = vals.map((v, i) => (v !== null && i <= solidTo ? i : -1)).filter((i) => i >= 0);
                    const x0 = ((idx[0] + 0.5) / n) * VB_W;
                    const x1 = ((idx[idx.length - 1] + 0.5) / n) * VB_W;
                    const floor = ser.bySign ? zeroY : bottom;
                    area = `${solid}L${x1.toFixed(2)},${floor}L${x0.toFixed(2)},${floor}Z`;
                  }
                  return (
                    <g key={ser.key}>
                      {area && <path d={area} fill={paint} opacity={ser.bySign ? 0.14 : 0.1} className={s.area} />}
                      <path d={solid} fill="none" stroke={paint} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      {dashed && (
                        <path d={dashed} fill="none" stroke={paint} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      )}
                    </g>
                  );
                })}
              </svg>
              {/* End dots in a percentage overlay, so they stay round. */}
              <svg className={s.svg} aria-hidden="true">
                {series.map((ser) => {
                  const vals = ser.values[view];
                  let last = vals.length - 1;
                  while (last >= 0 && vals[last] === null) last--;
                  if (last < 0) return null;
                  return (
                    <circle
                      key={ser.key}
                      className={s.dot}
                      cx={`${((last + 0.5) / n) * 100}%`}
                      cy={y(vals[last]!)}
                      r={4}
                      fill={colorOf(ser, vals[last])}
                      stroke="var(--chart-surface)"
                      strokeWidth={2}
                    />
                  );
                })}
              </svg>
              <div className={s.cols}>
                {months.map((m, i) => {
                  const rows: TipRow[] = series.map((ser) => ({
                    label: ser.label,
                    color: colorOf(ser, ser.values[view][i]),
                    kind: ser.estimateFrom !== undefined && i > ser.estimateFrom ? "dash" : "line",
                    value: ser.values[view][i],
                  }));
                  if (series.length === 2 && rows[0].value !== null && rows[1].value !== null) {
                    rows.push({ label: "—", value: i }, { label: "Diferencia", value: rows[0].value - rows[1].value, strong: true });
                  }
                  return (
                    <div key={m} className={cx(s.col, s.colLine)} tabIndex={0} aria-label={srSummary(m, rows, cur)}>
                      <Tip title={formatMonthKey(m)} rows={rows} cur={cur} note={notes?.[i]} className={tipAlign(i, n)} />
                    </div>
                  );
                })}
              </div>
            </div>
            <XAxis months={months} current={current} />
          </div>
        );
      })}
    </>
  );
}

/** Wraps one of two pre-rendered variants of a chart, swapped by the card's toggle. */
export function ToggleView({ when, children }: { when: "on" | "off"; children: ReactNode }) {
  return <div data-toggle-view={when}>{children}</div>;
}

export const chartVars = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  line: "var(--chart-line)",
  line2: "var(--chart-line-2)",
  /** Six named categories, then the neutral "rest" step for everything after them. */
  slots: ["var(--chart-s1)", "var(--chart-s2)", "var(--chart-s3)", "var(--chart-s4)", "var(--chart-s5)", "var(--chart-s6)", "var(--chart-s7)"],
  neutral: "var(--chart-neutral)",
} as const;


