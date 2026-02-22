"use client";

import { useState, useMemo } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrency, formatDateShort, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface ChartDataPoint {
  date: string;
  total_ars: number;
}

interface PatrimonyChartProps {
  data: ChartDataPoint[];
}

const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "3A", months: 36 },
  { label: "5A", months: 60 },
  { label: "Todo", months: 0 },
] as const;

function CustomTooltip({ active, payload, label, mask }: any) {
  if (!active || !payload?.length) return null;

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" color="fg.body" mb="1">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="bold" color="fg.heading">
        {mask(formatCurrency(payload[0].value))}
      </Text>
    </Box>
  );
}

export function PatrimonyChart({ data }: PatrimonyChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [selectedRange, setSelectedRange] = useState("Todo");
  const { mask } = useMoneyVisibility();

  const gridColor = isDark ? "#1e293b" : "#e5e7eb";
  const axisColor = isDark ? "#64748b" : "#9ca3af";

  const filteredData = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.label === selectedRange);
    if (!range || range.months === 0) return data;

    const cutoff = new Date();
    cutoff.setDate(1);
    cutoff.setMonth(cutoff.getMonth() - range.months);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    return data.filter((d) => d.date >= cutoffStr);
  }, [data, selectedRange]);

  const chartData = filteredData.map((d) => ({
    ...d,
    date: formatDateShort(d.date),
  }));

  const rangeChange = useMemo(() => {
    if (filteredData.length < 2) return undefined;
    const first = Number(filteredData[0].total_ars);
    const last = Number(filteredData[filteredData.length - 1].total_ars);
    if (first === 0) return undefined;
    return ((last - first) / first) * 100;
  }, [filteredData]);

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="6"
    >
      <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
        <Flex align="center" gap="2">
          <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
            Crecimiento del Patrimonio
          </Text>
          {rangeChange !== undefined && (
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color={rangeChange >= 0 ? "green.400" : "red.400"}
            >
              {formatPercentage(rangeChange)}
            </Text>
          )}
        </Flex>

        {data.length > 0 && (
          <Flex gap="1">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.label}
                size="xs"
                variant={selectedRange === range.label ? "solid" : "ghost"}
                bg={selectedRange === range.label ? "brand.600" : undefined}
                color={selectedRange === range.label ? "white" : "fg.body"}
                _hover={{
                  bg: selectedRange === range.label ? "brand.500" : "bg.hover",
                }}
                onClick={() => setSelectedRange(range.label)}
                px="3"
              >
                {range.label}
              </Button>
            ))}
          </Flex>
        )}
      </Flex>

      {chartData.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          No hay datos de patrimonio todavía
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              stroke={axisColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={axisColor}
              fontSize={12}
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
            <Area
              type="monotone"
              dataKey="total_ars"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorTotal)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}
