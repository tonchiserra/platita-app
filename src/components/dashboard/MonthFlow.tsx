"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface Figure {
  label: string;
  value: number;
  change?: number;
  /** Rising expenses are bad; rising income is good. */
  invertColor?: boolean;
  highlight?: boolean;
}

interface MonthFlowProps {
  income: number;
  expenses: number;
  incomeChange?: number;
  expensesChange?: number;
  balanceChange?: number;
  monthLabel: string;
  /** Trading losses for the month, in ARS. Zero in a month without any. */
  tradingLossArs?: number;
  /** The same figure as entered, in USD — the book's own unit. */
  tradingLossUsd?: number;
}

function Fig({ label, value, change, invertColor, highlight }: Figure) {
  const { mask } = useMoneyVisibility();
  const good = change === undefined ? false : invertColor ? change < 0 : change >= 0;

  return (
    <Flex direction="column" gap="1.5" minW="150px">
      <Text
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="0.13em"
        textTransform="uppercase"
        color="fg.muted"
      >
        {label}
      </Text>
      <Text
        fontFamily="heading"
        fontWeight="semibold"
        fontSize="2xl"
        lineHeight="1"
        letterSpacing="-0.02em"
        color={highlight ? "trend.up" : "fg.heading"}
        css={{ fontVariationSettings: '"wdth" 106' }}
        data-num
      >
        {mask(formatCurrency(value))}
      </Text>
      {change !== undefined && (
        <Text
          fontFamily="mono"
          fontSize="xs"
          fontWeight="medium"
          color={good ? "trend.up" : "trend.down"}
          data-num
        >
          {change >= 0 ? "▲" : "▼"} {formatPercentage(change).replace(/^[+-]/, "")} vs. mes anterior
        </Text>
      )}
    </Flex>
  );
}

/**
 * The month as an arithmetic too: what came in, what left, what stayed.
 * The bar is deliberately neutral on the spent side — spending is not an error
 * state, so it gets ink rather than red.
 */
export function MonthFlow({
  income,
  expenses,
  incomeChange,
  expensesChange,
  balanceChange,
  monthLabel,
  tradingLossArs = 0,
  tradingLossUsd = 0,
}: MonthFlowProps) {
  const { mask } = useMoneyVisibility();
  const balance = income - expenses;
  const spentPct = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;
  const keptPct = 100 - spentPct;
  const showBar = income > 0 && expenses >= 0;

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      px={{ base: "4", md: "5" }}
      py="5"
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Flex wrap="wrap" gap={{ base: "5", md: "8" }}>
        <Fig label={`Entró en ${monthLabel}`} value={income} change={incomeChange} />
        <Fig label={`Salió en ${monthLabel}`} value={expenses} change={expensesChange} invertColor />
        <Fig label="Te quedó" value={balance} change={balanceChange} highlight={balance >= 0} />
      </Flex>

      {showBar && (
        <>
          <Flex h="7px" borderRadius="sm" overflow="hidden" gap="0.5">
            <Box bg="trend.down" w={`${spentPct}%`} />
            <Box bg="trend.up" w={`${keptPct}%`} />
          </Flex>
          <Flex wrap="wrap" gap="4" fontSize="xs">
            <Flex align="center" gap="2">
              <Box w="3px" h="12px" borderRadius="1px" bg="trend.down" flexShrink={0} />
              <Text as="span" color="trend.down" data-num>
                {spentPct.toFixed(1).replace(".", ",")} % se fue en gastos
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <Box w="3px" h="12px" borderRadius="1px" bg="trend.up" flexShrink={0} />
              <Text as="span" color="trend.up" data-num>
                {keptPct.toFixed(1).replace(".", ",")} % quedó
              </Text>
            </Flex>
          </Flex>
        </>
      )}

      {/*
        A trading loss is not a gasto, so it is absent from "Salió" and from the
        bar — which means "Te quedó" no longer explains the whole move in net
        worth, and the gap is exactly this. Naming it beats leaving a silent
        hole. It is a footnote rather than a fourth figure because a loss is not
        a flow of the same rank as income and spending.
      */}
      {tradingLossArs > 0 && (
        <Flex
          gap="2.5"
          align="flex-start"
          borderTop="1px solid"
          borderColor="border.card"
          pt="3.5"
        >
          <Box as="span" color="trend.down" flexShrink={0} mt="0.5" display="inline-flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </Box>
          <Text fontSize="xs" color="fg.body" lineHeight="1.6">
            Además,{" "}
            <Text as="span" fontFamily="mono" color="trend.down" fontWeight="medium" data-num>
              {mask(formatCurrency(tradingLossArs))}
            </Text>{" "}
            de pérdidas de trading{" "}
            {tradingLossUsd > 0 && (
              <Text as="span" fontFamily="mono" color="fg.muted" data-num>
                ({mask(formatCurrency(tradingLossUsd, "USD"))})
              </Text>
            )}
            . No cuentan como gasto, pero bajan tu patrimonio estimado.
          </Text>
        </Flex>
      )}
    </Box>
  );
}
