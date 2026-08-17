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
 * All solid, told apart by hue rather than dash pattern — dashes were not
 * enough separation at these widths. The dollarized line takes `cur.usd`
 * because it really is dollars; the benchmarks get hues of their own rather
 * than borrowing a currency's.
 *
 * Ordered so each nominal line is followed by its inflation-adjusted twin.
 */
const SERIES = [
  {
    key: "patrimony",
    label: "Tu patrimonio",
    color: "var(--chakra-colors-fg-heading)",
    width: 3,
    description:
      "El patrimonio que cargaste mes a mes, valuado a la cotización de cada cierre. El tramo punteado del final es el mes en curso: el último cierre revaluado a hoy más tus movimientos, porque todavía no lo cerraste.",
  },
  {
    key: "dollarized",
    label: "Si te dolarizabas",
    color: "var(--chakra-colors-cur-usd)",
    width: 2,
    description:
      "Si al cargar tu primer movimiento hubieras pasado todo a dólares, y cada mes también lo que te sobró. Sube y baja con el blue.",
  },
  {
    key: "dollarizedReal",
    label: "Valor real de los dólares",
    color: "var(--chakra-colors-bench-usd-inflation)",
    width: 2,
    description:
      "Los mismos dólares de «Si te dolarizabas», descontando lo que la inflación de Estados Unidos les quitó de poder de compra. Guardar dólares conserva mucho más valor que guardar pesos, pero tampoco sale gratis: la distancia entre las dos líneas es cuánto se perdió.",
  },
  {
    key: "mattress",
    label: "En el colchón",
    color: "var(--chakra-colors-bench-mattress)",
    width: 2,
    description:
      "Si desde ese mismo punto la plata hubiera quedado en pesos, quieta, sumándole lo que te sobró cada mes. No rinde ni cambia de moneda.",
  },
  {
    key: "mattressReal",
    label: "Valor real del colchón",
    color: "var(--chakra-colors-bench-inflation)",
    width: 2,
    description:
      "Lo que esos mismos pesos del colchón realmente compran, medido en plata del mes en que arranca el gráfico. La distancia con la línea del colchón es lo que se comió la inflación.",
  },
] as const;

const DESCRIPTION_ID = "alternatives-series-description";

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
  hidden: ReadonlySet<string>;
}

function AlternativesTooltip({ active, payload, mask, hidden }: TooltipProps) {
  if (!active || !payload?.length) return null;
  // Any rendered series carries the whole row, so this holds even when the
  // patrimony line is the one switched off.
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
        {point.patrimony === null && point.patrimonyEstimate !== null
          ? " · mes en curso, estimado"
          : ""}
      </Text>
      <Flex direction="column" gap="1">
        {SERIES.filter((series) => !hidden.has(series.key)).map((series) => {
          const value =
            series.key === "patrimony" && point.patrimony === null
              ? point.patrimonyEstimate
              : point[series.key];
          if (value === null) return null;
          // On the open month the comparison base is the estimate, so the
          // gaps stay readable instead of dropping out. With the patrimony line
          // switched off the gaps go too — they would measure against a line
          // that is not on the chart.
          const base = hidden.has("patrimony")
            ? null
            : point.patrimony ?? point.patrimonyEstimate;
          const gap =
            base !== null && series.key !== "patrimony" ? value - base : null;
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
                {gap !== null && (
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
  // Reading what a line means used to be a tap, but a tap now switches it off.
  // This opens every description at once, which is the only route on touch.
  const [guide, setGuide] = useState(false);
  const explanation = SERIES.find((series) => series.key === explained);
  const { mask } = useMoneyVisibility();

  // Which lines are switched off. Kept in state rather than persisted: hiding a
  // line is a move you make while reading one chart, not a lasting preference.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const shown = SERIES.filter((series) => !hidden.has(series.key));

  // Computed once over the whole history. The range crops this result rather
  // than recomputing from a later anchor — recomputing made 3M, 6M and 1A three
  // different charts instead of three windows onto the same one.
  const series = useMemo(() => buildAlternatives(points), [points]);

  const data = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.label === selectedRange);
    if (!range || range.months === 0) return series;
    // Same cutoff idiom as PatrimonyChart, so both charts agree on a range.
    const cutoff = new Date();
    cutoff.setDate(1);
    cutoff.setMonth(cutoff.getMonth() - range.months);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return series.filter((d) => d.date >= cutoffStr);
  }, [series, selectedRange]);

  // A zero-based axis squeezes every line into a band, and the gaps between
  // them are the whole point. The domain hugs the data instead, snapped to a
  // round step so the gridline labels stay readable.
  //
  // It measures only the visible lines, which is most of the reason to switch
  // one off: dropping the line that sets the floor lets the rest spread out.
  const scale = useMemo(() => {
    const keys = SERIES.filter((series) => !hidden.has(series.key)).map((s) => s.key);
    const values = data.flatMap((d) => {
      const row: (number | null)[] = keys.map((key) => d[key]);
      // The projected segment shares the patrimony line's switch.
      if (!hidden.has("patrimony")) row.push(d.patrimonyEstimate);
      return row.filter((v): v is number => v !== null);
    });
    if (values.length === 0) return undefined;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
    const step = niceStep((max + pad - (min - pad)) / 4);
    // Padding below zero would leave a band of empty negative space; only go
    // there when the data actually does.
    const floor = min >= 0 ? 0 : min - pad;
    const lower = Math.max(Math.floor((min - pad) / step) * step, floor);
    const upper = Math.ceil((max + pad) / step) * step;

    const ticks: number[] = [];
    for (let v = lower; v <= upper + step / 2; v += step) ticks.push(v);
    return { domain: [lower, upper] as [number, number], ticks };
  }, [data, hidden]);

  if (series.length < 2) return null;

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
        Desde tu primer movimiento registrado, con la misma plata · tocá una referencia para
        ocultar esa línea
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
                const off = hidden.has(series.key);
                return (
                  <Flex
                    as="button"
                    key={series.key}
                    align="center"
                    gap="2"
                    px="0"
                    py="0"
                    cursor="pointer"
                    aria-pressed={!off}
                    aria-describedby={open ? DESCRIPTION_ID : undefined}
                    onMouseEnter={() => setExplained(series.key)}
                    onMouseLeave={() =>
                      setExplained((current) => (current === series.key ? null : current))
                    }
                    onFocus={() => setExplained(series.key)}
                    onBlur={() => setExplained(null)}
                    onClick={() => toggle(series.key)}
                  >
                    <Box
                      w="14px"
                      h="3px"
                      borderRadius="full"
                      bg={series.color}
                      flexShrink={0}
                      opacity={off ? 0.3 : 1}
                      transition="opacity 0.14s"
                    />
                    <Text
                      fontSize="xs"
                      color={off ? "fg.muted" : open ? "fg.heading" : "fg.body"}
                      textDecorationLine={off ? "line-through" : undefined}
                      borderBottom="1px dashed"
                      borderColor="border.strong"
                      transition="color 0.14s"
                    >
                      {series.label}
                    </Text>
                  </Flex>
                );
              })}

              <Box
                as="button"
                w="18px"
                h="18px"
                px="0"
                py="0"
                flexShrink={0}
                borderRadius="full"
                border="1px solid"
                borderColor="border.strong"
                color={guide ? "fg.heading" : "fg.muted"}
                bg={guide ? "bg.sunk" : "transparent"}
                fontSize="2xs"
                lineHeight="1"
                cursor="pointer"
                aria-label="Qué significa cada línea"
                aria-expanded={guide}
                _hover={{ color: "fg.heading", bg: "bg.sunk" }}
                onClick={() => setGuide((current) => !current)}
              >
                ?
              </Box>
            </Flex>

            {/* The hover panel would sit on top of the open guide, and both say
                the same thing, so only one shows at a time. */}
            {explanation && !guide && (
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
                <Text id={DESCRIPTION_ID} fontSize="xs" color="fg.body" lineHeight="1.5">
                  {explanation.description}
                </Text>
              </Box>
            )}
          </Box>

          {/* Static rather than floating: five descriptions is a tall panel, and
              pushing the chart down beats overlaying it on a narrow screen. */}
          {guide && (
            <Flex
              direction="column"
              gap="3"
              bg="bg.sunk"
              border="1px solid"
              borderColor="border.card"
              borderRadius="lg"
              p="4"
              mb="4"
            >
              {SERIES.map((series) => (
                <Box key={series.key}>
                  <Flex align="center" gap="2" mb="1">
                    <Box
                      w="14px"
                      h="3px"
                      borderRadius="full"
                      bg={series.color}
                      flexShrink={0}
                    />
                    <Text fontSize="xs" fontWeight="semibold" color="fg.heading">
                      {series.label}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="fg.body" lineHeight="1.5">
                    {series.description}
                  </Text>
                </Box>
              ))}
            </Flex>
          )}

          {shown.length === 0 ? (
            /* Height matched to the chart so switching the last line off does
               not make the card jump. */
            <Flex align="center" justify="center" h="300px">
              <Text fontSize="sm" color="fg.muted" textAlign="center">
                Mostrá al menos una línea para comparar
              </Text>
            </Flex>
          ) : (
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
                <Tooltip content={<AlternativesTooltip mask={mask} hidden={hidden} />} />
                {/* The open month has no close, so its point is drawn as a
                    projection rather than folded into the solid line. It shares
                    the patrimony line's switch. */}
                {!hidden.has("patrimony") && (
                <Line
                  type="monotone"
                  dataKey="patrimonyEstimate"
                  name="Tu patrimonio (estimado)"
                  stroke="var(--chakra-colors-fg-heading)"
                  strokeWidth={2}
                  strokeDasharray="3 4"
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                )}
                {shown.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={series.width}
                    dot={false}
                    activeDot={series.key === "patrimony" ? { r: 4 } : false}
                    /* The real-dollar line bridges its gaps: a month the BLS
                       withheld is missing data, not a break in the series. */
                    connectNulls={series.key === "patrimony" || series.key === "dollarizedReal"}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          <Text fontSize="2xs" color="fg.muted" mt="3">
            Las alternativas se calculan sobre los ingresos y gastos que registraste, sin contar los ingresos por retorno de inversión.
          </Text>
        </>
      )}
    </Box>
  );
}
