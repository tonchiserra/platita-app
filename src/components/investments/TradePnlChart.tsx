"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { CHART } from "@/lib/constants/colors";

export interface TradePnlPoint {
  /** Month label as shown on the axis, e.g. `ago 26`. */
  label: string;
  net: number;
  wins: number;
  losses: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: TradePnlPoint }[];
  label?: string;
  mask: (value: string) => string;
}

function PnlTooltip({ active, payload, label, mask }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {label}
      </Text>
      <Text
        fontSize="xs"
        fontFamily="mono"
        color={point.net >= 0 ? "trend.up" : "trend.down"}
        data-num
      >
        {point.net >= 0 ? "+" : "−"}
        {mask(formatCurrency(Math.abs(point.net), "USD"))}
      </Text>
      <Text fontSize="xs" color="fg.muted" fontFamily="mono" data-num>
        {point.wins} {point.wins === 1 ? "ganada" : "ganadas"} · {point.losses}{" "}
        {point.losses === 1 ? "perdida" : "perdidas"}
      </Text>
    </Box>
  );
}

/**
 * The shape of the streak — the one question the book cannot answer at a glance.
 *
 * Signed bars, not a cumulative line: a cumulative line rises whenever the net
 * is positive, which hides exactly the months worth looking at. The running
 * total is already a figure in `TradeStats`.
 *
 * Months with no operation are absent rather than zero, because a zero bar reads
 * as "I traded and broke even" — a different fact from not having traded.
 */
export function TradePnlChart({ data, total }: { data: TradePnlPoint[]; total: number }) {
  const { mask } = useMoneyVisibility();

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="6"
      display="flex"
      flexDirection="column"
    >
      <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
        Resultado por mes
      </Text>
      <Text fontSize="xs" color="fg.muted" mt="1" mb="4" fontFamily="mono" data-num>
        {total >= 0 ? "+" : "−"}
        {mask(formatCurrency(Math.abs(total), "USD"))} acumulados en {data.length}{" "}
        {data.length === 1 ? "mes" : "meses"}
      </Text>

      <Box flex="1" minH="220px">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              stroke={CHART.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={CHART.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                mask(
                  Math.abs(value) >= 1_000
                    ? `${(value / 1_000).toFixed(1)}K`
                    : String(value)
                )
              }
            />
            <ReferenceLine y={0} stroke={CHART.axis} strokeWidth={1} />
            <Tooltip content={<PnlTooltip mask={mask} />} cursor={{ fill: "transparent" }} />
            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
              {data.map((point) => (
                <Cell key={point.label} fill={point.net >= 0 ? CHART.up : CHART.down} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Flex wrap="wrap" gap="4" mt="4" fontSize="xs">
        <Flex align="center" gap="1.5">
          <Box w="8px" h="8px" borderRadius="2px" bg="trend.up" flexShrink={0} />
          <Text color="fg.body">Mes en ganancia</Text>
        </Flex>
        <Flex align="center" gap="1.5">
          <Box w="8px" h="8px" borderRadius="2px" bg="trend.down" flexShrink={0} />
          <Text color="fg.body">Mes en pérdida</Text>
        </Flex>
      </Flex>
    </Box>
  );
}
