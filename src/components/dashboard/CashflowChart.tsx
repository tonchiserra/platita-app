"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { CHART } from "@/lib/constants/colors";

export interface CashflowPoint {
  month: string;
  income: number;
  expenses: number;
}

interface CashflowChartProps {
  data: CashflowPoint[];
}

interface CashflowTooltipProps {
  active?: boolean;
  payload?: { payload: CashflowPoint }[];
  label?: string;
  mask: (value: string) => string;
}

function CashflowTooltip({ active, payload, label, mask }: CashflowTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const balance = point.income - point.expenses;

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3" minW="180px">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="2">
        {label}
      </Text>
      <Flex direction="column" gap="1">
        <Flex justify="space-between" gap="4">
          <Text fontSize="xs" color="trend.up">
            Entró
          </Text>
          <Text fontFamily="mono" fontSize="xs" color="fg.heading" data-num>
            {mask(formatCurrency(point.income))}
          </Text>
        </Flex>
        <Flex justify="space-between" gap="4">
          <Text fontSize="xs" color="trend.down">
            Salió
          </Text>
          <Text fontFamily="mono" fontSize="xs" color="fg.heading" data-num>
            {mask(formatCurrency(point.expenses))}
          </Text>
        </Flex>
        <Flex justify="space-between" gap="4" pt="1" mt="1" borderTop="1px solid" borderColor="border.card">
          <Text fontSize="xs" color="fg.body">
            Balance
          </Text>
          <Text
            fontFamily="mono"
            fontSize="xs"
            fontWeight="semibold"
            color={balance >= 0 ? "trend.up" : "trend.down"}
            data-num
          >
            {mask(formatCurrency(balance))}
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}

/** Floor per month: enough for "may 26" over "+1,0M" without collision. */
const MIN_MONTH_WIDTH = 78;
const PLOT_HEIGHT = 260;
const AXIS_WIDTH = 52;
/** Recharts drops the ticks when the plot area collapses to zero width, so the
    axis-only chart keeps a sliver of plot beside the labels. */
const AXIS_STUB = 14;
/** Reserved for the two-line month tick; shared so both plots align. */
const XAXIS_HEIGHT = 40;

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ, so gridline labels read as round numbers. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const nice =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
}

function compactNumber(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(abs / 1_000)}K`;
  return String(Math.round(abs));
}

interface MonthTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  byMonth: Map<string, CashflowPoint>;
  mask: (value: string) => string;
}

/**
 * Each month's tick carries the balance under the label, so the answer to
 * "did I keep anything" is readable straight off the axis without comparing
 * two bar heights by eye.
 */
function MonthTick({ x = 0, y = 0, payload, byMonth, mask }: MonthTickProps) {
  const point = payload ? byMonth.get(payload.value) : undefined;
  const balance = point ? point.income - point.expenses : undefined;
  const positive = (balance ?? 0) >= 0;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        dy={12}
        textAnchor="middle"
        fill="var(--chakra-colors-fg-muted)"
        fontSize={11}
      >
        {payload?.value}
      </text>
      {balance !== undefined && (
        <text
          x={0}
          dy={27}
          textAnchor="middle"
          fill={positive ? CHART.up : CHART.down}
          fontSize={10.5}
          fontWeight={600}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {mask(`${positive ? "+" : "−"}${compactNumber(balance)}`)}
        </text>
      )}
    </g>
  );
}

/**
 * Income and expenses for the same month sit adjacent so the gap between them
 * *is* the balance — the one comparison the two separate trend charts above
 * cannot make, because each has its own y-scale.
 */
export function CashflowChart({ data }: CashflowChartProps) {
  const { mask } = useMoneyVisibility();

  const byMonth = new Map(data.map((d) => [d.month, d]));
  const compact = (val: number) => mask(compactNumber(val));

  // Both plots are given this domain explicitly, so the pinned axis on the left
  // and the scrolling bars on the right cannot drift apart.
  const peak = Math.max(0, ...data.flatMap((d) => [d.income, d.expenses]));
  const step = niceStep(peak / 4);
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => step * i);

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Flex align="center" justify="space-between" gap="3" wrap="wrap" mb="1">
        <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
          Ingresos vs. gastos
        </Text>
        <Flex gap="4">
          <Flex align="center" gap="1.5">
            <Box w="8px" h="8px" borderRadius="2px" bg="trend.up" />
            <Text fontSize="xs" color="fg.body">
              Entró
            </Text>
          </Flex>
          <Flex align="center" gap="1.5">
            <Box w="8px" h="8px" borderRadius="2px" bg="trend.down" />
            <Text fontSize="xs" color="fg.body">
              Salió
            </Text>
          </Flex>
        </Flex>
      </Flex>
      <Text fontSize="xs" color="fg.muted" mb="4">
        Mes a mes, en pesos
      </Text>

      {data.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          Todavía no hay movimientos para comparar
        </Text>
      ) : (
        // A year of paired bars cannot fit a phone: squeezing it collides the
        // labels and leaves the bars hairline-thin. Each month keeps a floor of
        // horizontal space and the plot scrolls instead, so nothing is dropped.
        // The scale stays pinned outside the scroller, otherwise scrolling right
        // would leave the bars with no reference.
        <Flex align="stretch">
          <Box w={`${AXIS_WIDTH + AXIS_STUB}px`} h={`${PLOT_HEIGHT}px`} flexShrink={0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 0, left: 0, bottom: XAXIS_HEIGHT }}
              >
                <YAxis
                  domain={[0, top]}
                  ticks={ticks}
                  width={AXIS_WIDTH}
                  stroke={CHART.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compact}
                />
                {/* Recharts derives the scale from a rendered series, so this one
                    stays present but fully transparent. `hide` would drop it from
                    the scale entirely and the ticks would vanish with it. */}
                <Bar dataKey="income" fillOpacity={0} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box flex="1" minW="0" overflowX="auto" overflowY="hidden">
            <Box minW={`${data.length * MIN_MONTH_WIDTH}px`} h={`${PLOT_HEIGHT}px`}>
              <ResponsiveContainer width="100%" height="100%">
                {/* barGap keeps the pair touching; barCategoryGap separates the months. */}
                <BarChart
                  data={data}
                  barGap={2}
                  barCategoryGap="28%"
                  margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke={CHART.axis}
                    tickLine={false}
                    axisLine={false}
                    height={XAXIS_HEIGHT}
                    interval={0}
                    tick={<MonthTick byMonth={byMonth} mask={mask} />}
                  />
                  <YAxis hide domain={[0, top]} ticks={ticks} width={0} />
                  <Tooltip
                    content={<CashflowTooltip mask={mask} />}
                    cursor={{ fill: "var(--chakra-colors-bg-sunk)" }}
                  />
                  <ReferenceLine y={0} stroke={CHART.axis} />
                  <Bar dataKey="income" name="Entró" fill={CHART.up} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Salió" fill={CHART.down} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Flex>
      )}
    </Box>
  );
}
