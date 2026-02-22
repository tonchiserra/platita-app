"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { CATEGORY_ICONS, type ExpenseCategory } from "@/lib/constants/categories";

const COLORS = [
  "#3d77b8", "#f59e0b", "#ef4444", "#22c55e", "#06b6d4",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
];

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface ExpenseCategoryChartProps {
  data: CategoryData[];
  total: number;
  change?: number;
}

function CustomTooltip({ active, payload, mask }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {entry.category}
      </Text>
      <Text fontSize="xs" color="fg.body">
        {mask(formatCurrency(entry.amount))} ({entry.percentage.toFixed(1)}%)
      </Text>
    </Box>
  );
}

export function ExpenseCategoryChart({ data, total, change }: ExpenseCategoryChartProps) {
  const { mask } = useMoneyVisibility();

  if (data.length === 0) {
    return (
      <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="4">
          Gastos por Categoría
        </Text>
        <Text color="fg.muted" textAlign="center" py="12">
          Sin gastos este mes
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Flex align="center" gap="2" mb="4">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
          Gastos por Categoría
        </Text>
        {change !== undefined && (
          <Text fontSize="sm" fontWeight="semibold" color={change >= 0 ? "red.400" : "green.400"}>
            {formatPercentage(change)}
          </Text>
        )}
      </Flex>

      <Box position="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip mask={mask} />} />
          </PieChart>
        </ResponsiveContainer>
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          textAlign="center"
          pointerEvents="none"
        >
          <Text fontSize="sm" fontWeight="bold" color="fg.heading">
            {mask(formatCurrency(total))}
          </Text>
          <Text fontSize="2xs" color="fg.muted">
            Total mes
          </Text>
        </Box>
      </Box>

      <Flex flexWrap="wrap" gap="3" mt="2" justify="center">
        {data.map((item, i) => (
          <Flex key={item.category} align="center" gap="1.5">
            <Box w="2.5" h="2.5" borderRadius="sm" bg={COLORS[i % COLORS.length]} flexShrink={0} />
            <Text fontSize="xs" color="fg.body">
              {CATEGORY_ICONS[item.category as ExpenseCategory] ?? ""} {item.category} ({item.percentage.toFixed(0)}%)
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
