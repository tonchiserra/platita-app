# Patrimonio contra las alternativas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chart to the Patrimony page comparing actual net worth against three counterfactuals built from the same contributions: pesos under the mattress, keeping pace with inflation, and buying dollars.

**Architecture:** The server builds a compact per-snapshot timeline (actual value, net savings since the previous point, that date's blue rate, inflation since the previous point). A pure isomorphic function turns that timeline into four series. The client component re-runs that function whenever the range changes, because re-basing to a different anchor changes the result rather than shifting it.

**Tech Stack:** Next.js 16 App Router, React 19, Chakra UI v3, Recharts, TypeScript. Design doc: [`docs/plans/2026-08-14-patrimony-alternatives-design.md`](2026-08-14-patrimony-alternatives-design.md).

## Global Constraints

- **All user-facing copy is Spanish (es-AR).** Code, comments and identifiers are English.
- **No test framework is configured.** Tests are standalone `tsx` scripts run with `npx tsx --tsconfig tsconfig.json <path>`, asserting with a local `check()` helper and exiting non-zero on failure. Do not add Jest/Vitest.
- **No Server Actions, no API routes for mutations.** Reads happen in `async` Server Components.
- Every Supabase query filters `.eq("user_id", user!.id)` explicitly.
- **Money figures** use `fontFamily="mono"` plus the `data-num` attribute. Amounts use `formatCurrency`/`formatCurrencyWhole` from `src/lib/utils/format.ts`.
- **Colour comes from tokens only.** `src/lib/constants/colors.ts` is the single source for chart colour; charts must not branch on `useTheme()`/`isDark`.
- **A currency hue only marks a currency.** Of the four lines, only the dollarized one may use `cur.usd`.
- Every displayed amount is wrapped in `mask(...)` from `useMoneyVisibility()`.
- Recharts charts are imported with `next/dynamic` and wrapped in `<LazySection>`.
- Date-only strings are parsed as `new Date(s + "T00:00:00")`, never bare.
- Verify with `npx tsc --noEmit` and `npm run build`. `npm run lint` must not gain new problems (current baseline: 18).

---

### Task 1: Restore the historical blue rate helpers

`getDolarBlueHistory` and `blueRateOn` existed and were deleted in commit `3f710c3` when the rate alerts were removed and left them without callers. This task brings them back; the dollarized line needs a rate for every snapshot date.

**Files:**
- Modify: `src/lib/api/exchange-rates.ts`
- Test: `scripts/blue-rate-on.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DolarHistoryPoint { fecha: string; compra: number; venta: number }`
  - `getDolarBlueHistory(days?: number): Promise<DolarHistoryPoint[] | null>`
  - `blueRateOn(series: DolarHistoryPoint[], date: string): number | undefined`

- [ ] **Step 1: Write the failing test**

Create `scripts/blue-rate-on.test.ts`:

```ts
import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};

const series: DolarHistoryPoint[] = [
  { fecha: "2026-06-28", compra: 1300, venta: 1320 },
  { fecha: "2026-07-01", compra: 1400, venta: 1420 },
  { fecha: "2026-08-01", compra: 1700, venta: 1750 },
];

check("exact date returns that quote", blueRateOn(series, "2026-08-01") === 1750);
check("a gap falls back to the prior quote", blueRateOn(series, "2026-07-15") === 1420);
check("a weekend falls back too", blueRateOn(series, "2026-07-04") === 1420);
check("before the series returns undefined", blueRateOn(series, "2026-01-01") === undefined);
check("an empty series returns undefined", blueRateOn([], "2026-07-15") === undefined);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json scripts/blue-rate-on.test.ts`
Expected: FAIL — `blueRateOn` is not exported from `@/lib/api/exchange-rates`.

- [ ] **Step 3: Add the implementation**

In `src/lib/api/exchange-rates.ts`, insert immediately above `export async function getEuroBlue`:

```ts
export interface DolarHistoryPoint {
  fecha: string;
  compra: number;
  venta: number;
}

/** Blue sell rate on `date`, or the closest earlier quote (weekends, holidays). */
export function blueRateOn(
  series: DolarHistoryPoint[],
  date: string
): number | undefined {
  let best: DolarHistoryPoint | undefined;
  for (const point of series) {
    if (point.fecha <= date && (!best || point.fecha > best.fecha)) best = point;
  }
  return best?.venta;
}

/**
 * Blue history, for valuing past snapshots at the rate of their own day. The
 * upstream only serves the whole series (~500 KB) with no date-scoped
 * endpoint, so this runs server-side on a long revalidate and returns the tail.
 */
export async function getDolarBlueHistory(days = 2000): Promise<DolarHistoryPoint[] | null> {
  try {
    const res = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/blue", {
      next: { revalidate: 21600 }, // 6 hours — a daily series does not move faster
    });
    if (!res.ok) return null;
    const all = (await res.json()) as DolarHistoryPoint[];
    if (!Array.isArray(all)) return null;
    return all.slice(-days);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --tsconfig tsconfig.json scripts/blue-rate-on.test.ts`
Expected: `5 passed, 0 failed`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/exchange-rates.ts scripts/blue-rate-on.test.ts
git commit -m "Restore the historical blue rate helpers"
```

---

### Task 2: The pure alternatives calculation

The whole feature's arithmetic. Three counterfactuals are the same operation in different units: convert each incoming peso into a unit that does not devalue, accumulate units, revalue at each point.

**Files:**
- Create: `src/lib/utils/patrimony-alternatives.ts`
- Test: `scripts/patrimony-alternatives.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface TimelinePoint { date: string; patrimonyArs: number; netSavingsArs: number; blueRate?: number; inflationPct?: number }`
  - `interface AlternativesPoint { date: string; patrimony: number; mattress: number; inflation: number | null; dollarized: number | null }`
  - `buildAlternatives(points: TimelinePoint[]): AlternativesPoint[]`

Semantics that later tasks must honour when building a `TimelinePoint`: `netSavingsArs` and `inflationPct` describe the interval **since the previous point**, so both are ignored on the first point of any slice. `blueRate` is the rate **on** that point's date.

- [ ] **Step 1: Write the failing test**

Create `scripts/patrimony-alternatives.test.ts`:

```ts
import { buildAlternatives, type TimelinePoint } from "@/lib/utils/patrimony-alternatives";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};
const section = (name: string) => console.log("\n" + name);
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1;

/**
 * Anchor 1.000.000 with blue at 1000, then two months of 200.000 saved,
 * blue 1100 and 1200, inflation 5 % and 4 %.
 */
const worked: TimelinePoint[] = [
  { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
  { date: "2026-02-28", patrimonyArs: 1_300_000, netSavingsArs: 200_000, blueRate: 1100, inflationPct: 5 },
  { date: "2026-03-31", patrimonyArs: 1_700_000, netSavingsArs: 200_000, blueRate: 1200, inflationPct: 4 },
];

section("anclaje");
{
  const out = buildAlternatives(worked);
  check("returns one row per point", out.length === 3);
  const first = out[0];
  check("the four lines start equal at the anchor",
    first.patrimony === 1_000_000 && first.mattress === 1_000_000 &&
    near(first.inflation, 1_000_000) && near(first.dollarized, 1_000_000));
  check("fewer than two points yields nothing", buildAlternatives([worked[0]]).length === 0);
  check("an empty timeline yields nothing", buildAlternatives([]).length === 0);
}

section("ejemplo trabajado a mano");
{
  const out = buildAlternatives(worked);
  check("patrimony passes through", out[2].patrimony === 1_700_000);
  // 1.000.000 + 200.000 + 200.000
  check("mattress accumulates nominally", out[2].mattress === 1_400_000);
  // 1.000.000 x 1,092 + 200.000 x 1,04 + 200.000
  check("inflation compounds each contribution from its own month",
    near(out[2].inflation, 1_500_000), String(out[2].inflation));
  // (1.000.000/1000 + 200.000/1100 + 200.000/1200) x 1200
  check("dollarized converts at each month's rate",
    near(out[2].dollarized, 1_618_182), String(out[2].dollarized));
}

section("degenerados");
{
  const noSavings: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_500_000, netSavingsArs: 0, blueRate: 1000, inflationPct: 0 },
  ];
  const out = buildAlternatives(noSavings);
  check("with no savings the mattress stays flat", out[1].mattress === 1_000_000);
  check("with zero inflation, inflation equals the mattress", near(out[1].inflation, out[1].mattress));
  check("with a flat blue, dollarized equals the mattress", near(out[1].dollarized, out[1].mattress));

  const flatBlue: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_500_000, netSavingsArs: 500_000, blueRate: 1000, inflationPct: 0 },
  ];
  const flat = buildAlternatives(flatBlue);
  check("a flat blue tracks the mattress even with savings",
    near(flat[1].dollarized, 1_500_000) && flat[1].mattress === 1_500_000);
  check("zero inflation tracks the mattress even with savings",
    near(flat[1].inflation, 1_500_000));
}

section("meses en rojo");
{
  const overspent: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 900_000, netSavingsArs: -300_000, blueRate: 1000, inflationPct: 0 },
  ];
  const out = buildAlternatives(overspent);
  check("a negative month lowers the mattress", out[1].mattress === 700_000);
  check("a negative month lowers the dollarized line", near(out[1].dollarized, 700_000));
  check("it is not floored at zero",
    buildAlternatives([
      { date: "2026-01-31", patrimonyArs: 100_000, netSavingsArs: 0, blueRate: 1000 },
      { date: "2026-02-28", patrimonyArs: 0, netSavingsArs: -300_000, blueRate: 1000, inflationPct: 0 },
    ])[1].mattress === -200_000);
}

section("datos faltantes");
{
  const cpiLag: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0, blueRate: 1000 },
    { date: "2026-02-28", patrimonyArs: 1_100_000, netSavingsArs: 100_000, blueRate: 1100, inflationPct: 5 },
    { date: "2026-03-31", patrimonyArs: 1_200_000, netSavingsArs: 100_000, blueRate: 1200 },
  ];
  const out = buildAlternatives(cpiLag);
  check("the inflation line stops where CPI stops", out[2].inflation === null);
  check("earlier inflation points survive", out[1].inflation !== null);
  check("the dollarized line is unaffected", out[2].dollarized !== null);

  const noBlue: TimelinePoint[] = [
    { date: "2026-01-31", patrimonyArs: 1_000_000, netSavingsArs: 0 },
    { date: "2026-02-28", patrimonyArs: 1_100_000, netSavingsArs: 100_000, inflationPct: 5 },
  ];
  const bare = buildAlternatives(noBlue);
  check("without any blue the dollarized line is null throughout",
    bare[0].dollarized === null && bare[1].dollarized === null);
  check("the other lines still compute", bare[1].mattress === 1_100_000 && bare[1].inflation !== null);
}

section("re-baseo");
{
  const full = buildAlternatives(worked);
  const rebased = buildAlternatives(worked.slice(1));
  check("a later anchor starts from that point's patrimony", rebased[0].mattress === 1_300_000);
  check("re-basing is not a constant offset",
    Math.abs((rebased[1].dollarized ?? 0) - (full[2].dollarized ?? 0)) > 1);
  check("the anchor's own savings are ignored", rebased[0].mattress === rebased[0].patrimony);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json scripts/patrimony-alternatives.test.ts`
Expected: FAIL — cannot resolve `@/lib/utils/patrimony-alternatives`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/utils/patrimony-alternatives.ts`:

```ts
/**
 * One snapshot on the timeline. `netSavingsArs` and `inflationPct` describe the
 * interval *since the previous point*, so both are ignored on the first point
 * of whatever slice is being charted. `blueRate` is the rate on this date.
 */
export interface TimelinePoint {
  date: string;
  patrimonyArs: number;
  netSavingsArs: number;
  blueRate?: number;
  inflationPct?: number;
}

export interface AlternativesPoint {
  date: string;
  /** What actually happened. */
  patrimony: number;
  /** Nominal pesos, never revalued. */
  mattress: number;
  /** What it would take to hold purchasing power. Null once CPI runs out. */
  inflation: number | null;
  /** Every peso converted to dollars the month it arrived. Null without rates. */
  dollarized: number | null;
}

/**
 * Turns a timeline into four comparable series.
 *
 * The three counterfactuals are the same operation in different units: convert
 * each incoming peso into something that does not devalue, accumulate those
 * units, then revalue at each point.
 *
 *   mattress(i)   =         P0 + Σ c
 *   inflation(i)  = idx_i × ( P0/idx_0  + Σ c/idx )
 *   dollarized(i) = blue_i × ( P0/blue_0 + Σ c/blue )
 *
 * The first point is the anchor: all four lines start at its patrimony, which
 * is what makes the comparison mean anything.
 */
export function buildAlternatives(points: TimelinePoint[]): AlternativesPoint[] {
  if (points.length < 2) return [];

  const anchor = points[0];
  const start = anchor.patrimonyArs;

  // Running unit balances. Each is "how much of unit X we hold".
  let nominal = start;
  let realUnits = start; // start / idx_0, and idx_0 is 1 by definition
  let index = 1;

  const startBlue = anchor.blueRate;
  let usdUnits = startBlue && startBlue > 0 ? start / startBlue : null;

  // Once an input runs out mid-series the line ends rather than guessing.
  let cpiStopped = false;

  return points.map((point, i) => {
    if (i > 0) {
      const contribution = point.netSavingsArs;

      nominal += contribution;

      if (point.inflationPct === undefined) {
        cpiStopped = true;
      } else if (!cpiStopped) {
        index *= 1 + point.inflationPct / 100;
        realUnits += contribution / index;
      }

      if (usdUnits !== null) {
        if (point.blueRate && point.blueRate > 0) {
          usdUnits += contribution / point.blueRate;
        } else {
          usdUnits = null;
        }
      }
    }

    return {
      date: point.date,
      patrimony: point.patrimonyArs,
      mattress: nominal,
      inflation: cpiStopped ? null : realUnits * index,
      dollarized:
        usdUnits !== null && point.blueRate && point.blueRate > 0
          ? usdUnits * point.blueRate
          : null,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --tsconfig tsconfig.json scripts/patrimony-alternatives.test.ts`
Expected: `24 passed, 0 failed`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/patrimony-alternatives.ts scripts/patrimony-alternatives.test.ts
git commit -m "Add the patrimony alternatives calculation"
```

---

### Task 3: The chart component

**Files:**
- Create: `src/components/patrimony/AlternativesChart.tsx`

**Interfaces:**
- Consumes: `buildAlternatives`, `TimelinePoint` from Task 2.
- Produces: `AlternativesChart({ points }: { points: TimelinePoint[] })`, a default-exported-by-name client component.

- [ ] **Step 1: Create the component**

Create `src/components/patrimony/AlternativesChart.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrencyWhole, formatDateShort } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { CHART } from "@/lib/constants/colors";
import {
  buildAlternatives,
  type AlternativesPoint,
  type TimelinePoint,
} from "@/lib/utils/patrimony-alternatives";

const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "3A", months: 36 },
  { label: "5A", months: 60 },
  { label: "Todo", months: 0 },
] as const;

/**
 * Only the dollarized line carries a currency hue, because it is the only one
 * that is a currency. The rest are neutral and told apart by dash pattern.
 */
const SERIES = [
  { key: "patrimony", label: "Tu patrimonio", color: "var(--chakra-colors-fg-heading)", dash: undefined, width: 2.5 },
  { key: "dollarized", label: "Si te dolarizabas", color: "var(--chakra-colors-cur-usd)", dash: "6 4", width: 1.8 },
  { key: "inflation", label: "Empatar la inflación", color: "var(--chakra-colors-fg-body)", dash: "2 3", width: 1.8 },
  { key: "mattress", label: "En el colchón", color: "var(--chakra-colors-border-strong)", dash: "10 5", width: 1.8 },
] as const;

function compact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${Math.round(abs)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AlternativesPoint }[];
  mask: (value: string) => string;
}

function AlternativesTooltip({ active, payload, mask }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3" minW="230px">
      <Text fontSize="xs" color="fg.body" mb="2">
        {formatDateShort(point.date)}
      </Text>
      <Flex direction="column" gap="1">
        {SERIES.map((series) => {
          const value = point[series.key];
          if (value === null) return null;
          const gap = value - point.patrimony;
          return (
            <Flex key={series.key} justify="space-between" gap="4" align="baseline">
              <Flex align="center" gap="2" minW="0">
                <Box w="10px" h="2px" bg={series.color} flexShrink={0} />
                <Text fontSize="xs" color="fg.body" truncate>
                  {series.label}
                </Text>
              </Flex>
              <Flex align="baseline" gap="2" flexShrink={0}>
                <Text fontFamily="mono" fontSize="xs" color="fg.heading" data-num>
                  {mask(formatCurrencyWhole(value))}
                </Text>
                {series.key !== "patrimony" && (
                  <Text
                    fontFamily="mono"
                    fontSize="2xs"
                    color={gap < 0 ? "trend.up" : "trend.down"}
                    data-num
                  >
                    {gap < 0 ? "+" : "−"}
                    {mask(compact(Math.abs(gap)))}
                  </Text>
                )}
              </Flex>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}

export function AlternativesChart({ points }: { points: TimelinePoint[] }) {
  const [selectedRange, setSelectedRange] = useState("1A");
  const { mask } = useMoneyVisibility();

  // Re-basing is not an offset: a different anchor produces different
  // counterfactuals, so the whole calculation reruns for the chosen window.
  const data = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.label === selectedRange);
    let slice = points;
    if (range && range.months > 0) {
      // Same cutoff idiom as PatrimonyChart, so both charts agree on a range.
      const cutoff = new Date();
      cutoff.setDate(1);
      cutoff.setMonth(cutoff.getMonth() - range.months);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      slice = points.filter((p) => p.date >= cutoffStr);
    }
    return buildAlternatives(slice);
  }, [points, selectedRange]);

  if (points.length < 2) return null;

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Flex align="baseline" justify="space-between" gap="3" wrap="wrap" mb="1">
        <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
          Tu patrimonio contra las alternativas
        </Text>
        <Flex gap="1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.label}
              size="xs"
              px="2.5"
              variant="ghost"
              bg={selectedRange === range.label ? "bg.sunk" : "transparent"}
              color={selectedRange === range.label ? "fg.heading" : "fg.muted"}
              fontWeight={selectedRange === range.label ? "semibold" : "normal"}
              _hover={{ color: "fg.heading", bg: "bg.sunk" }}
              onClick={() => setSelectedRange(range.label)}
            >
              {range.label}
            </Button>
          ))}
        </Flex>
      </Flex>
      <Text fontSize="xs" color="fg.muted" mb="4">
        Qué habría pasado con la misma plata
      </Text>

      {data.length < 2 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          Todavía no hay suficientes cierres en este período para comparar
        </Text>
      ) : (
        <>
          <Flex wrap="wrap" gap="4" mb="3">
            {SERIES.map((series) => (
              <Flex key={series.key} align="center" gap="2">
                <Box w="14px" h="2px" bg={series.color} />
                <Text fontSize="xs" color="fg.body">
                  {series.label}
                </Text>
              </Flex>
            ))}
          </Flex>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={CHART.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) => formatDateShort(value)}
                minTickGap={24}
              />
              <YAxis
                stroke={CHART.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => mask(compact(value))}
              />
              <Tooltip content={<AlternativesTooltip mask={mask} />} />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={series.width}
                  strokeDasharray={series.dash}
                  dot={false}
                  activeDot={series.key === "patrimony" ? { r: 4 } : false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <Text fontSize="2xs" color="fg.muted" mt="3">
            Las alternativas se calculan sobre los ingresos y gastos que registraste.
          </Text>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/patrimony/AlternativesChart.tsx
git commit -m "Add the patrimony alternatives chart component"
```

---

### Task 4: Build the timeline and wire the chart into the page

**Files:**
- Create: `src/lib/utils/patrimony-timeline.ts`
- Modify: `src/app/(dashboard)/dashboard/patrimony/page.tsx`
- Test: `scripts/patrimony-timeline.test.ts` (create)

`PatrimonyPageClient` needs no change: it already renders `{children}`, and the
page passes its charts in as children.

The timeline builder gets its **own module** rather than living beside
`buildAlternatives`. It imports from `src/lib/api/*`, and `buildAlternatives`
is imported by a client component — keeping them apart stops the API module
(and its `fetch` calls) from being pulled into the client bundle.

**Interfaces:**
- Consumes: `TimelinePoint` and `buildAlternatives` (Task 2), `AlternativesChart` (Task 3), `getDolarBlueHistory` and `blueRateOn` (Task 1), `getMonthlyInflation` and `inflationBetween` from `src/lib/api/inflation.ts` (already in the repo).
- Produces: from `src/lib/utils/patrimony-timeline.ts` — `interface TimelineFlow { date: string; amountArs: number; sign: 1 | -1 }`, `interface TimelineInput { snapshots: { date: string; totalArs: number }[]; flows: TimelineFlow[]; blueSeries: DolarHistoryPoint[] | null; inflationSeries: InflationPoint[] | null }`, and `buildTimeline(input: TimelineInput): TimelinePoint[]`.

- [ ] **Step 1: Write the failing test for the timeline builder**

Create `scripts/patrimony-timeline.test.ts`:

```ts
import { buildTimeline, type TimelineInput } from "@/lib/utils/patrimony-timeline";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  << " + extra : "")); }
};

const input: TimelineInput = {
  snapshots: [
    { date: "2026-01-31", totalArs: 1_000_000 },
    { date: "2026-02-28", totalArs: 1_300_000 },
  ],
  flows: [
    // before the first snapshot: must not count
    { date: "2026-01-10", amountArs: 999_999, sign: 1 },
    { date: "2026-02-05", amountArs: 500_000, sign: 1 },
    { date: "2026-02-20", amountArs: 300_000, sign: -1 },
    // after the last snapshot: must not count
    { date: "2026-03-05", amountArs: 777_777, sign: 1 },
  ],
  blueSeries: [
    { fecha: "2026-01-31", compra: 980, venta: 1000 },
    { fecha: "2026-02-28", compra: 1080, venta: 1100 },
  ],
  inflationSeries: [
    { fecha: "2026-01-31", valor: 3 },
    { fecha: "2026-02-28", valor: 5 },
  ],
};

const out = buildTimeline(input);

check("one point per snapshot", out.length === 2);
check("the first point carries no savings", out[0].netSavingsArs === 0);
check("the first point carries no inflation", out[0].inflationPct === undefined);
check("savings net income against expenses in the interval",
  out[1].netSavingsArs === 200_000, String(out[1].netSavingsArs));
check("flows before the first snapshot are excluded",
  out[0].netSavingsArs === 0 && out[1].netSavingsArs === 200_000);
check("flows after the last snapshot are excluded", out.length === 2);
check("the blue rate is the one on that date", out[1].blueRate === 1100);
check("inflation covers the interval", out[1].inflationPct === 3);
check("patrimony passes through", out[1].patrimonyArs === 1_300_000);

const noRates = buildTimeline({ ...input, blueSeries: null, inflationSeries: null });
check("without a blue series the rate is undefined", noRates[1].blueRate === undefined);
check("without CPI the inflation is undefined", noRates[1].inflationPct === undefined);

check("fewer than two snapshots yields nothing",
  buildTimeline({ ...input, snapshots: [input.snapshots[0]] }).length === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json scripts/patrimony-timeline.test.ts`
Expected: FAIL — `buildTimeline` is not exported.

- [ ] **Step 3: Create the timeline builder**

Create `src/lib/utils/patrimony-timeline.ts` (a new file — imports go at the
top, as always):

```ts
import { blueRateOn, type DolarHistoryPoint } from "@/lib/api/exchange-rates";
import { inflationBetween, type InflationPoint } from "@/lib/api/inflation";
import type { TimelinePoint } from "./patrimony-alternatives";

/** A single income or expense, already converted to ARS. `sign` is +1 or -1. */
export interface TimelineFlow {
  date: string;
  amountArs: number;
  sign: 1 | -1;
}

export interface TimelineInput {
  /** Ascending by date. */
  snapshots: { date: string; totalArs: number }[];
  flows: TimelineFlow[];
  blueSeries: DolarHistoryPoint[] | null;
  inflationSeries: InflationPoint[] | null;
}

/**
 * Folds snapshots, flows, rates and CPI into one row per snapshot. Everything
 * on a row except `patrimonyArs` and `blueRate` describes the interval since
 * the previous row, which is the shape `buildAlternatives` expects.
 */
export function buildTimeline(input: TimelineInput): TimelinePoint[] {
  const { snapshots, flows, blueSeries, inflationSeries } = input;
  if (snapshots.length < 2) return [];

  return snapshots.map((snapshot, i) => {
    const previous = i > 0 ? snapshots[i - 1] : undefined;

    let netSavingsArs = 0;
    if (previous) {
      for (const flow of flows) {
        if (flow.date <= previous.date || flow.date > snapshot.date) continue;
        netSavingsArs += flow.sign * flow.amountArs;
      }
    }

    return {
      date: snapshot.date,
      patrimonyArs: snapshot.totalArs,
      netSavingsArs,
      blueRate: blueSeries ? blueRateOn(blueSeries, snapshot.date) : undefined,
      inflationPct:
        previous && inflationSeries
          ? inflationBetween(inflationSeries, previous.date, snapshot.date)
          : undefined,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --tsconfig tsconfig.json scripts/patrimony-timeline.test.ts`
Expected: `12 passed, 0 failed`

- [ ] **Step 5: Fetch the extra data in the page**

In `src/app/(dashboard)/dashboard/patrimony/page.tsx`, replace the import of `getDolarBlue, getEuroBlue` with:

```tsx
import { getDolarBlue, getEuroBlue, getDolarBlueHistory } from "@/lib/api/exchange-rates";
import { getMonthlyInflation } from "@/lib/api/inflation";
import { buildTimeline, type TimelineFlow } from "@/lib/utils/patrimony-timeline";
```

Then extend the existing `Promise.all` destructuring and array. Change:

```tsx
  const [{ data: platforms }, { data: rawSnapshots }, dolarBlue, euroBlue, cryptoPrices] =
    await Promise.all([
```

to:

```tsx
  const [
    { data: platforms },
    { data: rawSnapshots },
    dolarBlue,
    euroBlue,
    cryptoPrices,
    { data: rawExpenses },
    { data: rawIncomes },
    blueSeries,
    inflationSeries,
  ] = await Promise.all([
```

and append these four entries after `getCryptoPrices(),` inside the array:

```tsx
      // The "Todo" range needs every flow, not a twelve-month window.
      supabase
        .from("expenses")
        .select("amount, currency, date")
        .eq("user_id", user!.id),
      supabase
        .from("incomes")
        .select("amount, currency, date")
        .eq("user_id", user!.id),
      getDolarBlueHistory(),
      getMonthlyInflation(120),
```

- [ ] **Step 6: Build the timeline in the page**

In the same file, immediately after `const chartData = [...snapshotsWithItems].reverse().map(...)`, insert:

```tsx
  // Historical flows are valued at the rate of their own date, not today's.
  // Only ARS and USD get that treatment because they are the only currencies
  // with a historical series here; the rest fall back to current rates.
  const flowToArs = (row: { amount: number; currency: string; date: string }) => {
    const amount = Number(row.amount);
    if (row.currency === "ARS") return amount;
    if (row.currency === "USD" && blueSeries) {
      const rate = blueRateOn(blueSeries, row.date);
      if (rate) return amount * rate;
    }
    return convertToArs(amount, row.currency, exchangeRates);
  };

  const flows: TimelineFlow[] = [
    ...(rawIncomes ?? []).map((row) => ({
      date: row.date as string,
      amountArs: flowToArs(row),
      sign: 1 as const,
    })),
    ...(rawExpenses ?? []).map((row) => ({
      date: row.date as string,
      amountArs: flowToArs(row),
      sign: -1 as const,
    })),
  ];

  const timeline = buildTimeline({
    snapshots: chartData.map((s) => ({ date: s.date, totalArs: s.total_ars })),
    flows,
    blueSeries,
    inflationSeries,
  });
```

Add `blueRateOn` to the exchange-rates import line so `flowToArs` can use it:

```tsx
import { getDolarBlue, getEuroBlue, getDolarBlueHistory, blueRateOn } from "@/lib/api/exchange-rates";
```

- [ ] **Step 7: Render the chart on the page**

Still in `src/app/(dashboard)/dashboard/patrimony/page.tsx`, add the dynamic
import next to the other `dynamic(...)` declarations at the top of the file:

```tsx
const AlternativesChart = dynamic(() =>
  import("@/components/patrimony/AlternativesChart").then((m) => m.AlternativesChart)
);
```

Then add it as a child of `PatrimonyPageClient`, directly after the existing
`PatrimonyChart` block, so the returned JSX reads:

```tsx
  return (
    <PatrimonyPageClient
      snapshots={snapshotsWithItems}
      platforms={platforms ?? []}
      exchangeRates={exchangeRates}
    >
      <LazySection minHeight="300px">
        <PatrimonyChart data={chartData} />
      </LazySection>
      <LazySection minHeight="380px">
        <AlternativesChart points={timeline} />
      </LazySection>
      {breakdownData.length > 0 && (
        <LazySection minHeight="300px">
          <PatrimonyBreakdownChart data={breakdownData} totalArs={totalArs} />
        </LazySection>
      )}
    </PatrimonyPageClient>
  );
```

- [ ] **Step 8: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run build`
Expected: `✓ Compiled successfully`, all 12 pages generated.

- [ ] **Step 9: Check lint did not regress**

Run: `npm run lint 2>&1 | grep -cE '\s+[0-9]+:[0-9]+\s+(error|warning)'`
Expected: `18` or fewer. If higher, fix the new problems before committing.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(dashboard)/dashboard/patrimony/page.tsx" \
        src/lib/utils/patrimony-timeline.ts \
        scripts/patrimony-timeline.test.ts
git commit -m "Wire the alternatives chart into the patrimony page"
```

---

### Task 5: Verify it renders

The dashboard requires authentication, so the chart is verified through a temporary public route that is deleted afterwards. This is the same technique used for the cashflow chart.

**Files:**
- Create then delete: `src/app/(auth)/visual-check/page.tsx`

**Interfaces:**
- Consumes: `AlternativesChart` (Task 3), `TimelinePoint` (Task 2).
- Produces: nothing. The route is removed before committing.

- [ ] **Step 1: Create the temporary route**

Note: a folder starting with `_` is treated as private by the App Router and will not be routed. Use `visual-check` exactly.

Create `src/app/(auth)/visual-check/page.tsx`:

```tsx
// TEMPORARY scratch route for visual verification. Deleted after screenshots.
import { Box } from "@chakra-ui/react";
import { AlternativesChart } from "@/components/patrimony/AlternativesChart";
import type { TimelinePoint } from "@/lib/utils/patrimony-alternatives";

const months = ["09", "10", "11", "12"];
const points: TimelinePoint[] = [
  { date: "2025-08-31", patrimonyArs: 20_000_000, netSavingsArs: 0, blueRate: 1200 },
  ...months.map((m, i) => ({
    date: `2025-${m}-30`,
    patrimonyArs: 20_000_000 + (i + 1) * 2_600_000,
    netSavingsArs: 1_500_000,
    blueRate: 1200 + (i + 1) * 60,
    inflationPct: 2.4,
  })),
  ...["01", "02", "03", "04", "05", "06", "07"].map((m, i) => ({
    date: `2026-${m}-28`,
    patrimonyArs: 30_400_000 + (i + 1) * 2_300_000,
    netSavingsArs: 1_500_000,
    blueRate: 1440 + (i + 1) * 45,
    inflationPct: 2.1,
  })),
  // CPI is published with a lag: the newest point has no inflation figure.
  { date: "2026-08-31", patrimonyArs: 47_000_000, netSavingsArs: 1_500_000, blueRate: 1780 },
];

export default function VisualCheck() {
  return (
    <Box bg="bg.page" minH="100vh" p={{ base: "4", md: "6" }}>
      <Box maxW="1000px" mx="auto">
        <AlternativesChart points={points} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Start the dev server if it is not already running**

Run: `npm run dev`
Then confirm: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/visual-check`
Expected: `200`

- [ ] **Step 3: Inspect at desktop width**

Open `http://localhost:3000/visual-check` at 1400×900 and confirm:
- Four lines, all starting from the same point on the left edge.
- Only the dollarized line is coloured; the rest are ink and neutrals.
- The inflation line stops before the last point, where CPI runs out.
- The range buttons re-base the lines — switching to `3M` still shows four lines meeting at the left edge, at a different value than `Todo`.
- The tooltip lists all available lines with the gap against your own.

Note: screenshots taken with `fullPage: true` do not render Recharts SVG series reliably. Use a viewport screenshot.

- [ ] **Step 4: Inspect at mobile width**

Resize to 390×844 and confirm the x-axis labels do not collide. `minTickGap={24}` should thin them automatically; if they still overlap, reduce the tick count rather than rotating labels.

- [ ] **Step 5: Check dark mode**

In the console: `document.documentElement.classList.add('dark')`, then confirm all four lines remain distinguishable against the dark ground.

- [ ] **Step 6: Delete the temporary route**

```bash
rm -rf "src/app/(auth)/visual-check"
```

Confirm it is gone: `ls "src/app/(auth)/"` should list only `auth`, `login`, `register`.

- [ ] **Step 7: Final verification**

```bash
npx tsc --noEmit
npm run build
npx tsx --tsconfig tsconfig.json scripts/patrimony-alternatives.test.ts
npx tsx --tsconfig tsconfig.json scripts/patrimony-timeline.test.ts
npx tsx --tsconfig tsconfig.json scripts/blue-rate-on.test.ts
git status --short
```

Expected: typecheck silent, build succeeds, all three test scripts pass, and `git status` shows no leftover `visual-check` directory.

- [ ] **Step 8: Update the project guide**

In `CLAUDE.md`, under `### Charts`, append:

```markdown
`AlternativesChart` compares net worth against three counterfactuals built from the same contributions. The maths lives in `src/lib/utils/patrimony-alternatives.ts` as a pure isomorphic function, because the range selector re-bases the whole calculation client-side — a different anchor produces different counterfactuals rather than a shifted line.
```

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "Note the alternatives chart in the project guide"
```
