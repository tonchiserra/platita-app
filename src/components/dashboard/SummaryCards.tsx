"use client";

import { Box, Text, SimpleGrid, Flex, Tooltip, VStack } from "@chakra-ui/react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface SummaryCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  invertColor?: boolean;
  info?: React.ReactNode;
}

function SummaryCard({ label, value, change, changeLabel, invertColor, info }: SummaryCardProps) {
  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="5"
    >
      <Flex align="center" gap="1.5" mb="1">
        <Text fontSize="sm" color="fg.body">
          {label}
        </Text>
        {info && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                w="3.5"
                h="3.5"
                borderRadius="full"
                border="1px solid"
                borderColor="fg.muted"
                fontSize="2xs"
                color="fg.muted"
                cursor="help"
                flexShrink={0}
              >
                i
              </Box>
            </Tooltip.Trigger>
            <Tooltip.Positioner>
              <Tooltip.Content
                bg="bg.card"
                border="1px solid"
                borderColor="border.card"
                px="3"
                py="2"
                borderRadius="lg"
                maxW="480px"
              >
                {info}
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Root>
        )}
      </Flex>
      <Text fontSize="2xl" fontWeight="bold" color="fg.heading">
        {value}
      </Text>
      {change !== undefined && (
        <Text
          fontSize="sm"
          color={
            invertColor
              ? change >= 0 ? "red.400" : "green.400"
              : change >= 0 ? "green.400" : "red.400"
          }
          mt="1"
        >
          {formatPercentage(change)} {changeLabel ?? "vs. mes anterior"}
        </Text>
      )}
    </Box>
  );
}

interface SummaryCardsProps {
  lastSnapshotArs: number;
  estimatedArs: number | null;
  estimatedEquation: string | null;
  monthlyChange?: number;
  totalExpensesMonth: number;
  totalIncomeMonth: number;
  expensesChange?: number;
  incomeChange?: number;
  balanceChange?: number;
}

export function SummaryCards({
  lastSnapshotArs,
  estimatedArs,
  estimatedEquation,
  monthlyChange,
  totalExpensesMonth,
  totalIncomeMonth,
  expensesChange,
  incomeChange,
  balanceChange,
}: SummaryCardsProps) {
  const { mask } = useMoneyVisibility();
  const estimatedChange =
    estimatedArs !== null && lastSnapshotArs > 0
      ? ((estimatedArs - lastSnapshotArs) / lastSnapshotArs) * 100
      : undefined;

  return (
    <VStack gap="4" align="stretch">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <SummaryCard
          label="Último Patrimonio"
          value={mask(formatCurrency(lastSnapshotArs))}
          change={monthlyChange}
        />
        <SummaryCard
          label="Patrimonio Estimado"
          value={estimatedArs !== null ? mask(formatCurrency(estimatedArs)) : "—"}
          change={estimatedChange}
          changeLabel="vs. último patrimonio"
          info={
            <>
              <Text fontSize="xs" color="fg.muted" mb="1.5">
                Último patrimonio revalorizado a cotizaciones actuales + ingresos
                del mes − gastos del mes
              </Text>
              {estimatedEquation && (
                <Text fontSize="xs" color="fg.heading" fontFamily="mono">
                  {estimatedEquation}
                </Text>
              )}
            </>
          }
        />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <SummaryCard
          label="Gastos del Mes"
          value={mask(formatCurrency(totalExpensesMonth))}
          change={expensesChange}
          invertColor
        />
        <SummaryCard
          label="Ingresos del Mes"
          value={mask(formatCurrency(totalIncomeMonth))}
          change={incomeChange}
        />
        <SummaryCard
          label="Balance del Mes"
          value={mask(formatCurrency(totalIncomeMonth - totalExpensesMonth))}
          change={balanceChange}
        />
      </SimpleGrid>
    </VStack>
  );
}
