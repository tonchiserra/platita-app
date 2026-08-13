import { Box, Image, Text, VStack } from "@chakra-ui/react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="bg.page"
      px="4"
      py="10"
    >
      <VStack
        gap="7"
        p={{ base: "7", md: "9" }}
        bg="bg.card"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.card"
        maxW="400px"
        w="full"
      >
        <VStack gap="3">
          <Image
            src="/platita-logo.svg"
            alt="Platita"
            h="34px"
            _dark={{ filter: "invert(1) hue-rotate(180deg)" }}
          />
          <Text color="fg.body" fontSize="sm" textAlign="center">
            Creá tu cuenta
          </Text>
        </VStack>

        <AuthForm mode="register" />
      </VStack>
    </Box>
  );
}
