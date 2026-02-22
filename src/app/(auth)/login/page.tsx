import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="bg.page"
    >
      <VStack
        gap="8"
        p="10"
        bg="bg.card"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.card"
        maxW="400px"
        w="full"
        mx="4"
      >
        <VStack gap="2">
          <Heading size="2xl" color="fg.heading" fontWeight="bold">
            Platita
          </Heading>
          <Text color="fg.body" textAlign="center">
            Tu balance personal, unificado
          </Text>
        </VStack>

        <AuthForm mode="login" />
      </VStack>
    </Box>
  );
}
