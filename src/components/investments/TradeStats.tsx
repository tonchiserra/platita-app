"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { formatCurrency, formatMonthYear } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import type { TradeStats as Stats } from "@/lib/utils/trading";

interface TradeStatsProps {
  month: Stats;
  allTime: Stats;
  monthLabel: string;
}

/**
 * Three figures, borrowing `MonthFlow`'s `Fig` anatomy so the two cards read as
 * the same kind of object.
 *
 * Deliberately no "% vs. mes anterior" here: dividing one net PnL by another
 * that may be negative produces a number with no meaning. The sub-lines carry
 * counts instead, which are facts.
 */
function Fig({
  label,
  value,
  detail,
  token,
}: {
  label: string;
  value: string;
  detail: string;
  token?: string;
}) {
  const { mask } = useMoneyVisibility();

  return (
    <Flex direction="column" gap="1.5" minW="150px" flex={{ base: "1", md: "initial" }}>
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
        color={token ?? "fg.heading"}
        css={{ fontVariationSettings: '"wdth" 106' }}
        data-num
      >
        {mask(value)}
      </Text>
      <Text fontFamily="mono" fontSize="xs" color="fg.muted" data-num>
        {detail}
      </Text>
    </Flex>
  );
}

/** `+US$ 1.240,00` — the sign is the point, so it is never dropped. */
function signed(usd: number): string {
  const body = formatCurrency(Math.abs(usd), "USD");
  if (usd === 0) return body;
  return `${usd > 0 ? "+" : "−"}${body}`;
}

function directionToken(net: number): string | undefined {
  if (net > 0) return "trend.up";
  if (net < 0) return "trend.down";
  return undefined;
}

function operations(n: number): string {
  return `${n} ${n === 1 ? "operación" : "operaciones"}`;
}

export function TradeStats({ month, allTime, monthLabel }: TradeStatsProps) {
  const counted = allTime.wins + allTime.losses;

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      px={{ base: "4", md: "5" }}
      py="5"
    >
      <Flex wrap="wrap" gap={{ base: "5", md: "8" }}>
        <Fig
          label={`Resultado de ${monthLabel}`}
          value={signed(month.net)}
          token={directionToken(month.net)}
          detail={
            month.wins + month.losses === 0
              ? "sin operaciones este mes"
              : `${month.wins} ${month.wins === 1 ? "ganada" : "ganadas"} · ${month.losses} ${month.losses === 1 ? "perdida" : "perdidas"}`
          }
        />
        <Fig
          label="Tasa de acierto"
          value={
            allTime.winRate === null
              ? "—"
              : `${allTime.winRate.toFixed(1).replace(".", ",")} %`
          }
          detail={counted === 0 ? "todavía sin datos" : `${allTime.wins} de ${operations(counted)}`}
        />
        <Fig
          label="Resultado acumulado"
          value={signed(allTime.net)}
          token={directionToken(allTime.net)}
          detail={
            allTime.firstMonth
              ? `desde ${formatMonthYear(`${allTime.firstMonth}-01`).toLowerCase()}`
              : "todavía sin datos"
          }
        />
      </Flex>
    </Box>
  );
}
