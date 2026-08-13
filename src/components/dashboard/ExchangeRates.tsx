import { Box, Flex, Text } from "@chakra-ui/react";

export interface Rate {
  label: string;
  /** Currency colour token, e.g. `cur.usd`. */
  token?: string;
  /** Two-sided quote, as it appears on a casa de cambio board. */
  compra?: string;
  venta?: string;
  /** Single-sided quote (crypto). */
  value?: string;
}

interface ExchangeRatesProps {
  rates: Rate[];
  updatedAt?: string;
}

function Figure({ label, value }: { label?: string; value: string }) {
  return (
    <Flex direction="column" align="flex-end" gap="0.5" minW="0">
      {label && (
        <Text
          fontSize="2xs"
          letterSpacing="0.1em"
          textTransform="uppercase"
          color="fg.muted"
        >
          {label}
        </Text>
      )}
      <Text
        fontFamily="mono"
        fontSize="sm"
        fontWeight="medium"
        color="fg.heading"
        whiteSpace="nowrap"
        data-num
      >
        {value}
      </Text>
    </Flex>
  );
}

export function ExchangeRates({ rates, updatedAt }: ExchangeRatesProps) {
  if (rates.length === 0) return null;

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="5">
      <Flex justify="space-between" align="baseline" gap="3" mb="3">
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="0.13em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Cotizaciones
        </Text>
        {updatedAt && (
          <Text fontSize="xs" color="fg.muted">
            {updatedAt}
          </Text>
        )}
      </Flex>

      <Flex direction="column">
        {rates.map((rate) => (
          <Flex
            key={rate.label}
            align="center"
            justify="space-between"
            gap="4"
            py="2.5"
            borderBottom="1px solid"
            borderColor="border.card"
            _last={{ borderBottom: "none" }}
          >
            <Flex align="center" gap="2.5" minW="0">
              <Box
                w="3px"
                h="14px"
                borderRadius="1px"
                bg={rate.token ?? "fg.muted"}
                flexShrink={0}
              />
              <Text fontSize="sm" color="fg.heading" truncate>
                {rate.label}
              </Text>
            </Flex>

            <Flex align="flex-end" gap="6">
              {rate.compra && <Figure label="Compra" value={rate.compra} />}
              {rate.venta && <Figure label="Venta" value={rate.venta} />}
              {rate.value && <Figure value={rate.value} />}
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
