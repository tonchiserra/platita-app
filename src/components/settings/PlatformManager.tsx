"use client";

import { useState } from "react";
import { Select } from "@/components/shared/Select";
import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { PLATFORM_TYPES, PLATFORM_TYPE_LABELS } from "@/lib/constants/currencies";
import type { Platform } from "@/types/database";

interface PlatformManagerProps {
  platforms: Platform[];
}

export function PlatformManager({ platforms }: PlatformManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("platforms").insert({
      user_id: user!.id,
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      default_currency: formData.get("default_currency") as string,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowForm(false);
    router.refresh();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const supabase = createClient();
    await supabase
      .from("platforms")
      .update({ is_active: !isActive })
      .eq("id", id);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("platforms").delete().eq("id", id);
    router.refresh();
  };

  return (
    <VStack gap="4" align="stretch">
      <Flex justify="space-between" align="center">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
          Plataformas
        </Text>
        {!showForm && (
          <Button
            size="sm"
            bg="brand.600"
            color="white"
            _hover={{ bg: "brand.500" }}
            onClick={() => setShowForm(true)}
            px="4"
          >
            + Agregar
          </Button>
        )}
      </Flex>

      {showForm && (
        <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="5">
        <form onSubmit={handleAdd}>
          <VStack gap="3" align="stretch">
            <Flex gap="3" flexWrap="wrap">
              <Box flex="1" minW="160px">
                <Text fontSize="xs" color="fg.body" mb="1">Nombre</Text>
                <Input
                  name="name"
                  placeholder="Ej: Mercado Pago"
                  required
                  bg="bg.input"
                  border="1px solid"
                  borderColor="border.input"
                  color="fg.heading"
                  _placeholder={{ color: "fg.muted" }}
                />
              </Box>
              <Box flex="1" minW="160px">
                <Text fontSize="xs" color="fg.body" mb="1">Tipo</Text>
                <Select
                  name="type"
                  required
                >
                  {PLATFORM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PLATFORM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box flex="1" minW="120px">
                <Text fontSize="xs" color="fg.body" mb="1">Moneda por defecto</Text>
                <Select
                  name="default_currency"
                  required
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </Box>
            </Flex>

            {error && (
              <Text fontSize="xs" color="red.400">{error}</Text>
            )}

            <Flex gap="2" justifyContent="flex-end">
              <Button
                size="sm"
                variant="ghost"
                color="fg.body"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                bg="brand.600"
                color="white"
                _hover={{ bg: "brand.500" }}
                loading={loading}
                px="4"
              >
                Guardar
              </Button>
            </Flex>
          </VStack>
        </form>
        </Box>
      )}

      <Box
        bg="bg.card"
        borderRadius="xl"
        border="1px solid"
        borderColor="border.card"
        overflow="hidden"
      >
        {platforms.length === 0 ? (
          <Text color="fg.muted" textAlign="center" py="8">
            No hay plataformas configuradas
          </Text>
        ) : (
          platforms.map((platform, i) => (
            <Flex
              key={platform.id}
              align="center"
              justify="space-between"
              px="5"
              py="3"
              borderBottom={i < platforms.length - 1 ? "1px solid" : "none"}
              borderColor="border.card"
              opacity={platform.is_active ? 1 : 0.5}
            >
              <Box>
                <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                  {platform.name}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {PLATFORM_TYPE_LABELS[platform.type as keyof typeof PLATFORM_TYPE_LABELS]} · {platform.default_currency}
                </Text>
              </Box>
              <Flex gap="2">
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.body"
                  _hover={{ color: "fg.heading" }}
                  onClick={() => handleToggle(platform.id, platform.is_active)}
                >
                  {platform.is_active ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.muted"
                  _hover={{ color: "red.400" }}
                  onClick={() => handleDelete(platform.id)}
                >
                  ✕
                </Button>
              </Flex>
            </Flex>
          ))
        )}
      </Box>
    </VStack>
  );
}
