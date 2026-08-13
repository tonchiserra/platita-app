import { Box, SimpleGrid, VStack } from "@chakra-ui/react";

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

export default function DashboardLoading() {
  return (
    <VStack gap="4" align="stretch">
      {/* Mirrors the real layout: the equation hero, then the month band. */}
      <Skeleton h="330px" />
      <Skeleton h="180px" />
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <Skeleton h="300px" />
        <Skeleton h="300px" />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <Skeleton h="300px" />
        <Skeleton h="300px" />
      </SimpleGrid>
      <Skeleton h="420px" />
    </VStack>
  );
}
