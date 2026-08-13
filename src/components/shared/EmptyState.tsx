import { Box, Text, VStack } from "@chakra-ui/react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      py="14"
      px="6"
    >
      <VStack gap="2.5">
        <Text fontSize="3xl" aria-hidden="true">
          {icon}
        </Text>
        <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading">
          {title}
        </Text>
        <Text fontSize="sm" color="fg.body" textAlign="center" maxW="sm">
          {description}
        </Text>
      </VStack>
    </Box>
  );
}
