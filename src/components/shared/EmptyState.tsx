import { Text, VStack } from "@chakra-ui/react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <VStack py="16" gap="3">
      <Text fontSize="4xl">{icon}</Text>
      <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
        {title}
      </Text>
      <Text fontSize="sm" color="fg.body" textAlign="center" maxW="sm">
        {description}
      </Text>
    </VStack>
  );
}
