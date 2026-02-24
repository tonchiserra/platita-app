"use client";

import { useState } from "react";
import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // If email confirmation is enabled in Supabase, show a message instead of redirecting
      router.push("/dashboard");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap="4" align="stretch" w="full">
        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">
            Email
          </Text>
          <Input
            name="email"
            type="email"
            placeholder="tu@email.com"
            required
            bg="bg.input"
            border="1px solid"
            borderColor="border.input"
            color="fg.heading"
            _placeholder={{ color: "fg.muted" }}
          />
        </Box>

        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">
            Contraseña
          </Text>
          <Input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            bg="bg.input"
            border="1px solid"
            borderColor="border.input"
            color="fg.heading"
            _placeholder={{ color: "fg.muted" }}
          />
        </Box>

        {error && (
          <Text fontSize="sm" color="red.400">
            {error}
          </Text>
        )}

        {success && (
          <Text fontSize="sm" color="green.400">
            {success}
          </Text>
        )}

        <Button
          type="submit"
          bg="brand.600"
          color="white"
          _hover={{ bg: "brand.500" }}
          loading={loading}
          w="full"
          size="lg"
          px="6"
        >
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </Button>

        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <Link href="/register">
                <Text as="span" color="brand.400" _hover={{ textDecoration: "underline" }}>
                  Registrarse
                </Text>
              </Link>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <Link href="/login">
                <Text as="span" color="brand.400" _hover={{ textDecoration: "underline" }}>
                  Iniciar sesión
                </Text>
              </Link>
            </>
          )}
        </Text>
      </VStack>
    </form>
  );
}
