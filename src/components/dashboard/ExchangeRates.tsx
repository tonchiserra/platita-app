import { Box, Flex, Text, SimpleGrid } from "@chakra-ui/react";

interface Rate {
  label: string;
  value: string;
}

interface ExchangeRatesProps {
  rates: Rate[];
  updatedAt?: string;
}

export function ExchangeRates({ rates, updatedAt }: ExchangeRatesProps) {
  if (rates.length === 0) return null;

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="5"
    >
      <Flex justify="space-between" align="center" mb="3">
        <Text fontSize="sm" fontWeight="semibold" color="fg.body">
          Cotizaciones
        </Text>
        {updatedAt && (
          <Text fontSize="xs" color="fg.muted">
            {updatedAt}
          </Text>
        )}
      </Flex>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
        {rates.map((rate) => (
          <Box key={rate.label}>
            <Text fontSize="xs" color="fg.muted">
              {rate.label}
            </Text>
            <Text fontSize="sm" fontWeight="semibold" color="fg.heading">
              {rate.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
