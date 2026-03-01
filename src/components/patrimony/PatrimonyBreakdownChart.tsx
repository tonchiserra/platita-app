"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

const COLORS = [
  "#3d77b8", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
];

interface PlatformData {
  platform: string;
  valueArs: number;
  percentage: number;
}

interface PatrimonyBreakdownChartProps {
  data: PlatformData[];
  totalArs: number;
}

function CustomTooltip({ active, payload, mask }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {entry.platform}
      </Text>
      <Text fontSize="xs" color="fg.body">
        {mask(formatCurrency(entry.valueArs))} ({entry.percentage.toFixed(1)}%)
      </Text>
    </Box>
  );
}

export function PatrimonyBreakdownChart({ data, totalArs }: PatrimonyBreakdownChartProps) {
  const { mask } = useMoneyVisibility();

  if (data.length === 0) {
    return (
      <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="4">
          Distribución del Patrimonio
        </Text>
        <Text color="fg.muted" textAlign="center" py="12">
          Sin datos de patrimonio
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="1">
        Distribución del Patrimonio
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="4">
        Basado en el último mes registrado
      </Text>

      <Box position="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="valueArs"
              nameKey="platform"
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
            {mask(formatCurrency(totalArs))}
          </Text>
          <Text fontSize="2xs" color="fg.muted">
            Total ARS
          </Text>
        </Box>
      </Box>

      <Flex flexWrap="wrap" gap="3" mt="2" justify="center">
        {data.map((item, i) => (
          <Flex key={item.platform} align="center" gap="1.5">
            <Box w="2.5" h="2.5" borderRadius="sm" bg={COLORS[i % COLORS.length]} flexShrink={0} />
            <Text fontSize="xs" color="fg.body">
              {item.platform} ({item.percentage.toFixed(0)}%)
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
