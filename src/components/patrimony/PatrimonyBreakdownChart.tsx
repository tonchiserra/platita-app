"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { formatCurrency } from "@/lib/utils/format";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { PLATFORM_COLORS, categoricalColor } from "@/lib/constants/colors";

interface PlatformData {
  platform: string;
  valueArs: number;
  percentage: number;
}

interface PatrimonyBreakdownChartProps {
  data: PlatformData[];
  totalArs: number;
}

/**
 * A composition of one whole, so a single stacked bar reads it directly — the
 * slices sit adjacent and the legend carries the actual figures, which a donut
 * pushes into a tooltip.
 */
export function PatrimonyBreakdownChart({ data, totalArs }: PatrimonyBreakdownChartProps) {
  const { mask } = useMoneyVisibility();

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Flex align="baseline" justify="space-between" gap="3" wrap="wrap" mb="1">
        <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
          En qué está tu patrimonio
        </Text>
        {data.length > 0 && (
          <Text fontSize="xs" color="fg.muted">
            {data.length} {data.length === 1 ? "plataforma" : "plataformas"}
          </Text>
        )}
      </Flex>

      {data.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          Sin datos de patrimonio
        </Text>
      ) : (
        <>
          <Text fontSize="xs" color="fg.muted" mb="4" fontFamily="mono" data-num>
            {mask(formatCurrency(totalArs))} · último mes registrado
          </Text>

          <Flex h="9px" borderRadius="sm" overflow="hidden" gap="0.5" mb="4">
            {data.map((item, i) => (
              <Box
                key={item.platform}
                bg={categoricalColor(PLATFORM_COLORS, i)}
                w={`${item.percentage}%`}
                minW="2px"
              />
            ))}
          </Flex>

          <Flex direction="column">
            {data.map((item, i) => (
              <Box
                key={item.platform}
                display="grid"
                gridTemplateColumns="auto minmax(0, 1fr) auto auto"
                alignItems="baseline"
                gap="3"
                py="2"
                borderBottom="1px solid"
                borderColor="border.card"
                _last={{ borderBottom: "none" }}
              >
                <Box
                  w="3px"
                  h="12px"
                  borderRadius="1px"
                  bg={categoricalColor(PLATFORM_COLORS, i)}
                  flexShrink={0}
                  alignSelf="center"
                />
                <Text fontSize="sm" color="fg.heading" truncate>
                  {item.platform}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="fg.muted" textAlign="right" data-num>
                  {item.percentage.toFixed(1).replace(".", ",")} %
                </Text>
                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  color="fg.heading"
                  textAlign="right"
                  whiteSpace="nowrap"
                  data-num
                >
                  {mask(formatCurrency(item.valueArs))}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}
    </Box>
  );
}
