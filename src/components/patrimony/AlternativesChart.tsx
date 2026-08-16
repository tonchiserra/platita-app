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
 * All four solid, told apart by hue rather than dash pattern — dashes were not
 * enough separation at these line widths. The dollarized line takes `cur.usd`
 * because it really is dollars; the two benchmarks get hues of their own rather
 * than borrowing a currency's.
 */
const SERIES = [
  {
    key: "patrimony",
    label: "Tu patrimonio",
    color: "var(--chakra-colors-fg-heading)",
    width: 3,
    description:
      "Lo que efectivamente pasó: el total de cada cierre que registraste, valuado a la cotización de ese día.",
  },
  {
    key: "dollarized",
    label: "Si te dolarizabas",
    color: "var(--chakra-colors-cur-usd)",
    width: 2,
    description:
      "Si cada peso que ahorraste lo hubieras pasado a dólares el mes que entró, y los hubieras dejado quietos.",
  },
  {
    key: "inflation",
    label: "Empatar la inflación",
    color: "var(--chakra-colors-bench-inflation)",
    width: 2,
    description:
      "Lo que necesitarías tener hoy para comprar exactamente lo mismo que al principio. Por encima de esta línea ganaste poder de compra.",
  },
  {
    key: "mattress",
    label: "En el colchón",
    color: "var(--chakra-colors-bench-mattress)",
    width: 2,
    description:
      "Si la plata hubiera quedado en pesos, quieta, sin rendir nada ni cambiar de moneda.",
  },
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
  const [explained, setExplained] = useState<string | null>(null);
  const explanation = SERIES.find((series) => series.key === explained);
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
          {/* Each reference explains itself. Hover covers the desktop reading;
              tapping pins it open, because hover does not exist on touch.
              The panel anchors to the legend box rather than to the item: the
              legend wraps on narrow screens, so an item-relative anchor sends
              the panel off one edge or the other. */}
          <Box position="relative" mb="3">
            <Flex wrap="wrap" gap="4">
              {SERIES.map((series) => {
                const open = explained === series.key;
                return (
                  <Flex
                    as="button"
                    key={series.key}
                    align="center"
                    gap="2"
                    px="0"
                    py="0"
                    cursor="help"
                    aria-expanded={open}
                    onMouseEnter={() => setExplained(series.key)}
                    onMouseLeave={() =>
                      setExplained((current) => (current === series.key ? null : current))
                    }
                    onFocus={() => setExplained(series.key)}
                    onBlur={() => setExplained(null)}
                    onClick={() =>
                      setExplained((current) => (current === series.key ? null : series.key))
                    }
                  >
                    <Box w="14px" h="3px" borderRadius="full" bg={series.color} flexShrink={0} />
                    <Text
                      fontSize="xs"
                      color={open ? "fg.heading" : "fg.body"}
                      borderBottom="1px dashed"
                      borderColor="border.strong"
                      transition="color 0.14s"
                    >
                      {series.label}
                    </Text>
                  </Flex>
                );
              })}
            </Flex>

            {explanation && (
              <Box
                position="absolute"
                top="100%"
                left="0"
                mt="2"
                zIndex="10"
                maxW="min(340px, 100%)"
                bg="bg.card"
                border="1px solid"
                borderColor="border.card"
                borderRadius="lg"
                boxShadow="0 6px 20px rgba(0,0,0,0.10)"
                p="3"
              >
                <Flex align="center" gap="2" mb="1.5">
                  <Box w="14px" h="3px" borderRadius="full" bg={explanation.color} flexShrink={0} />
                  <Text fontSize="xs" fontWeight="semibold" color="fg.heading">
                    {explanation.label}
                  </Text>
                </Flex>
                <Text fontSize="xs" color="fg.body" lineHeight="1.5">
                  {explanation.description}
                </Text>
              </Box>
            )}
          </Box>

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
