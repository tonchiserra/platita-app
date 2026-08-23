import { Box, VStack } from "@chakra-ui/react";

function Skeleton({ h = "120px" }: { h?: string }) {
  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      h={h}
    />
  );
}

export default function TradingLoading() {
  return (
    <VStack gap="6" align="stretch">
      <Skeleton h="420px" />
      <Skeleton h="130px" />
      <Skeleton h="340px" />
      <Skeleton h="220px" />
    </VStack>
  );
}
