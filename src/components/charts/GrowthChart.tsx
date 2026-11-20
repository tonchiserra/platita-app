"use client";

import { useState, type CSSProperties } from "react";
import { ChartCard, ChartTable, Legend, LineChart, ToggleView, chartVars } from "./Charts";
import { ui } from "@/components/ui";
import type { GrowthSeries } from "@/lib/compute";

/**
 * The time range only crops the series — it never recomputes it. The
 * dollarized line is built once over the whole history, anchored at the first
 * movement; re-basing it per range would make 3M, 6M and 1A three different
 * charts instead of three windows onto one.
 */
const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "3A", months: 36 },
  { label: "5A", months: 60 },
  { label: "Todo", months: 0 },
] as const;

type RangeLabel = (typeof RANGES)[number]["label"];

function crop<T>(values: T[], start: number) {
  return values.slice(start);
}

export function GrowthChart({ growth, current }: { growth: GrowthSeries; current: string }) {
  const total = growth.months.length;
  // Only the ranges shorter than the history make sense, plus "Todo".
  const ranges = RANGES.filter((r) => r.months === 0 || r.months < total - 1);
  const [range, setRange] = useState<RangeLabel>(ranges.some((r) => r.label === "1A") ? "1A" : "Todo");

  const months = RANGES.find((r) => r.label === range)?.months ?? 0;
  // `months` back from today, inclusive of today's month: 3M is four points.
  const start = months === 0 ? 0 : Math.max(0, total - (months + 1));
  const view = {
    months: crop(growth.months, start),
    patrimony: { ars: crop(growth.patrimony.ars, start), usd: crop(growth.patrimony.usd, start) },
    dollarized: { ars: crop(growth.dollarized.ars, start), usd: crop(growth.dollarized.usd, start) },
    notes: crop(growth.notes, start),
    estimateFrom: growth.estimateFrom === undefined ? undefined : Math.max(0, growth.estimateFrom - start),
  };

  const patrimony = {
    key: "patrimony",
    label: "Patrimonio",
    color: chartVars.line,
    values: view.patrimony,
    area: true,
    connect: true,
    estimateFrom: view.estimateFrom,
  };
  const dollarized = { key: "dollarized", label: "Si me dolarizaba", color: chartVars.line2, values: view.dollarized };
  const activeIndex = Math.max(0, ranges.findIndex((r) => r.label === range));

  const rangeControl =
    ranges.length > 1 ? (
      <div
        className={ui.segmented}
        role="group"
        aria-label="Período"
        style={{ "--seg-n": ranges.length, "--seg-i": activeIndex } as CSSProperties}
      >
        <span className={ui.segThumb} aria-hidden="true" />
        {ranges.map((r) => (
          <button
            key={r.label}
            type="button"
            className={ui.segButton}
            aria-pressed={range === r.label}
            onClick={() => setRange(r.label)}
            style={{ minWidth: 36, height: 28, padding: "0 8px", fontSize: 12 }}
          >
            {r.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <ChartCard
      title="Crecimiento de capital"
      subtitle="Tus cierres de patrimonio mes a mes. El tramo punteado es el estimado de hoy."
      extra={rangeControl}
      toggle={growth.hasDollarized ? { label: "vs. dolarizado" } : undefined}
      legend={
        <>
          <ToggleView when="off">
            <Legend
              items={[
                { label: "Patrimonio", color: chartVars.line, kind: "line" },
                ...(view.estimateFrom !== undefined ? [{ label: "Estimado", color: chartVars.line, kind: "dash" as const }] : []),
              ]}
            />
          </ToggleView>
          <ToggleView when="on">
            <Legend
              items={[
                { label: "Patrimonio", color: chartVars.line, kind: "line" },
                { label: "Si cada mes hubieras pasado tu ahorro a dólares", color: chartVars.line2, kind: "line" },
              ]}
            />
          </ToggleView>
        </>
      }
      table={
        <ChartTable
          months={view.months}
          columns={[
            { label: "Patrimonio", values: view.patrimony },
            ...(growth.hasDollarized ? [{ label: "Dolarizado", values: view.dollarized }] : []),
          ]}
        />
      }
      note={growth.hasDollarized ? "Dolarizado: el patrimonio inicial y el ahorro de cada mes pasados a dólares al blue de ese mes, sin rendimientos." : undefined}
    >
      {/* Keyed by range, so a new window redraws instead of jumping. */}
      <ToggleView when="off">
        <LineChart key={`off-${range}`} months={view.months} current={current} series={[patrimony]} notes={view.notes} />
      </ToggleView>
      {growth.hasDollarized && (
        <ToggleView when="on">
          <LineChart key={`on-${range}`} months={view.months} current={current} series={[patrimony, dollarized]} notes={view.notes} />
        </ToggleView>
      )}
    </ChartCard>
  );
}
