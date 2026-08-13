"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { formatPercentage } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { PatrimonyEquation, type EquationTerm } from "./PatrimonyEquation";

interface PatrimonyHeroProps {
  /** Formatted total, without the currency symbol. */
  total: string;
  change?: number;
  changeLabel: string;
  terms: EquationTerm[];
  today: string;
  /** Last recorded snapshot, kept as a reference line rather than a rival headline. */
  lastClose?: string;
}

export function PatrimonyHero({
  total,
  change,
  changeLabel,
  terms,
  today,
  lastClose,
}: PatrimonyHeroProps) {
  const { mask } = useMoneyVisibility();

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      overflow="hidden"
    >
      <Flex
        px={{ base: "4", md: "6" }}
        py={{ base: "5", md: "6" }}
        gap="5"
        wrap="wrap"
        align="flex-end"
        justify="space-between"
      >
        <Flex direction="column" gap="1.5">
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="0.13em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Patrimonio estimado
          </Text>

          <Flex align="flex-start" gap="1.5" data-num>
            <Text
              as="span"
              fontSize={{ base: "md", md: "lg" }}
              fontWeight="medium"
              color="fg.muted"
              mt={{ base: "1.5", md: "2.5" }}
            >
              $
            </Text>
            <Text
              fontFamily="heading"
              fontWeight="bold"
              fontSize={{ base: "4xl", md: "5xl" }}
              lineHeight="0.95"
              letterSpacing="-0.028em"
              color="fg.heading"
              css={{ fontVariationSettings: '"wdth" 110' }}
            >
              {mask(total)}
            </Text>
          </Flex>

          {change !== undefined && (
            <Flex align="baseline" gap="2" fontSize="sm" color="fg.body">
              <Text
                as="span"
                fontFamily="mono"
                fontWeight="medium"
                color={change >= 0 ? "trend.up" : "trend.down"}
                data-num
              >
                {formatPercentage(change)}
              </Text>
              <Text as="span">{changeLabel}</Text>
            </Flex>
          )}
        </Flex>

        <Flex direction="column" align={{ base: "flex-start", md: "flex-end" }} gap="1">
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="0.08em"
            textTransform="uppercase"
            color="fg.muted"
          >
            {today}
          </Text>
          {lastClose && (
            <Text fontSize="xs" color="fg.body" mt="1.5" data-num>
              Último cierre{" "}
              <Text as="span" fontFamily="mono" color="fg.heading">
                {mask(lastClose)}
              </Text>
            </Text>
          )}
        </Flex>
      </Flex>

      {terms.length > 0 && (
        <PatrimonyEquation terms={terms} total={total} totalUnit="ARS" />
      )}
    </Box>
  );
}
