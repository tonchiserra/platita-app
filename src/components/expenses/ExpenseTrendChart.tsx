"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface TrendData {
  month: string;
  total: number;
  change?: number;
}

interface ExpenseTrendChartProps {
  data: TrendData[];
}

function CustomTooltip({ active, payload, label, mask }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {label}
      </Text>
      <Text fontSize="xs" color="fg.body">
        {mask(formatCurrency(entry.total))}
      </Text>
      {entry.change !== undefined && (
        <Text fontSize="xs" color={entry.change >= 0 ? "red.400" : "green.400"}>
          {formatPercentage(entry.change)} vs. mes anterior
        </Text>
      )}
    </Box>
  );
}

export function ExpenseTrendChart({ data }: ExpenseTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { mask } = useMoneyVisibility();

  const gridColor = isDark ? "#1e293b" : "#e5e7eb";
  const axisColor = isDark ? "#64748b" : "#9ca3af";

  if (data.length === 0) {
    return (
      <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="4">
          Tendencia de Gastos
        </Text>
        <Text color="fg.muted" textAlign="center" py="12">
          Sin datos de gastos
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="4">
        Tendencia de Gastos
      </Text>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="month"
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) =>
              mask(
                val >= 1_000_000
                  ? `${(val / 1_000_000).toFixed(1)}M`
                  : val >= 1_000
                    ? `${(val / 1_000).toFixed(0)}K`
                    : val.toString()
              )
            }
          />
          <Tooltip content={<CustomTooltip mask={mask} />} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#f87171" />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
