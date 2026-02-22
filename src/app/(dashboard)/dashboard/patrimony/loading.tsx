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

export default function PatrimonyLoading() {
  return (
    <VStack gap="6" align="stretch">
      <Box h="10" />
      <Skeleton h="200px" />
      <Skeleton h="400px" />
      <Skeleton h="300px" />
    </VStack>
  );
}
