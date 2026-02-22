"use client";

import { useState } from "react";
import { Select } from "@/components/shared/Select";
import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ASSET_TYPES } from "@/lib/constants/currencies";
import type { Platform } from "@/types/database";

interface InvestmentFormProps {
  platforms: Platform[];
}

export function InvestmentForm({ platforms }: InvestmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const totalAmount = parseFloat(formData.get("total_amount") as string);
    const pricePerUnit = parseFloat(formData.get("price_per_unit") as string);

    const { error: insertError } = await supabase.from("investments").insert({
      user_id: user!.id,
      date: formData.get("date") as string,
      asset: (formData.get("asset") as string).toUpperCase(),
      asset_type: formData.get("asset_type") as string,
      units: pricePerUnit > 0 ? totalAmount / pricePerUnit : 0,
      price_per_unit: pricePerUnit,
      total_amount: totalAmount,
      currency: formData.get("currency") as string,
      platform_id: (formData.get("platform_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
    <form onSubmit={handleSubmit}>
      <Text fontSize="lg" fontWeight="semibold" color="fg.heading" mb="4">
        Nueva Inversión
      </Text>

      <VStack gap="4" align="stretch">
        <Flex gap="4" flexWrap="wrap">
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Activo</Text>
            <Input
              name="asset"
              placeholder="BTC, ETH, AAPL..."
              required
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
              _placeholder={{ color: "fg.muted" }}
            />
          </Box>
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Tipo</Text>
            <Select
              name="asset_type"
              required
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Box>
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Fecha</Text>
            <Input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
            />
          </Box>
        </Flex>

        <Flex gap="4" flexWrap="wrap">
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Monto invertido</Text>
            <Input
              name="total_amount"
              type="number"
              step="any"
              placeholder="0.00"
              required
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
              _placeholder={{ color: "fg.muted" }}
            />
          </Box>
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Precio unitario</Text>
            <Input
              name="price_per_unit"
              type="number"
              step="any"
              placeholder="0.00"
              required
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
              _placeholder={{ color: "fg.muted" }}
            />
          </Box>
          <Box flex="1" minW="140px">
            <Text fontSize="sm" color="fg.body" mb="1">Moneda</Text>
            <Select
              name="currency"
              required
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="EUR">EUR</option>
            </Select>
          </Box>
        </Flex>

        <Flex gap="4" flexWrap="wrap">
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Plataforma (opcional)</Text>
            <Select
              name="platform_id"
            >
              <option value="">Sin plataforma</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Box>
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Notas (opcional)</Text>
            <Input
              name="notes"
              placeholder="Ej: DCA mensual"
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
              _placeholder={{ color: "fg.muted" }}
            />
          </Box>
        </Flex>

        {error && (
          <Text fontSize="sm" color="red.400">
            {error}
          </Text>
        )}

        <Button
          type="submit"
          bg="brand.600"
          color="white"
          _hover={{ bg: "brand.500" }}
          loading={loading}
          alignSelf="flex-end"
          px="5"
        >
          Agregar Inversión
        </Button>
      </VStack>
    </form>
    </Box>
  );
}
