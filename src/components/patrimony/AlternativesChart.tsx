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
  { key: "inflation", label: "Empatar la inflación", color: "var(--chakra-colors-fg-body)", dash: "1 4", width: 2 },
  { key: "mattress", label: "En el colchón", color: "var(--chakra-colors-fg-muted)", dash: "10 6", width: 1.8 },
] as const;

/** Rounds up to 1, 2, 2.5 or 5 x 10ⁿ, so gridline labels read as round numbers. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const nice =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
}

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
    <Box
      bg="bg.card"
      border="1px solid"
      borderColor="border.card"
      borderRadius="lg"
      p="3"
      /* A fixed min-width would push past the card on a narrow screen. */
      minW={{ base: "0", sm: "230px" }}
      maxW="72vw"
    >
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

  // A zero-based axis squeezes all four lines into a band, and the gaps between
  // them are the whole point. The domain hugs the data instead, snapped to a
  // round step so the gridline labels stay readable.
  const scale = useMemo(() => {
    const values = data.flatMap((d) =>
      [d.patrimony, d.mattress, d.inflation, d.dollarized].filter(
        (v): v is number => v !== null
      )
    );
    if (values.length === 0) return undefined;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
    const step = niceStep((max + pad - (min - pad)) / 4);
    const lower = Math.floor((min - pad) / step) * step;
    const upper = Math.ceil((max + pad) / step) * step;

    const ticks: number[] = [];
    for (let v = lower; v <= upper + step / 2; v += step) ticks.push(v);
    return { domain: [lower, upper] as [number, number], ticks };
  }, [data]);

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
                domain={scale?.domain}
                ticks={scale?.ticks}
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
