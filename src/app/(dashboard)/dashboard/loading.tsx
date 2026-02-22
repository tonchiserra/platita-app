import { Box, SimpleGrid, VStack } from "@chakra-ui/react";

function Skeleton({ h = "120px", ...props }: { h?: string; [key: string]: any }) {
  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      h={h}
      {...props}
    />
  );
}

export default function DashboardLoading() {
  return (
    <VStack gap="6" align="stretch">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <Skeleton />
        <Skeleton />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </SimpleGrid>
      <Skeleton h="400px" />
      <Skeleton h="80px" />
    </VStack>
  );
}
