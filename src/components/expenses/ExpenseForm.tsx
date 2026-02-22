"use client";

import { useState } from "react";
import { Select } from "@/components/shared/Select";
import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES, CATEGORY_ICONS } from "@/lib/constants/categories";

export function ExpenseForm() {
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

    const { error: insertError } = await supabase.from("expenses").insert({
      user_id: user!.id,
      amount: parseFloat(formData.get("amount") as string),
      currency: "ARS",
      category: formData.get("category") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
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
        Nuevo Gasto
      </Text>

      <VStack gap="4" align="stretch">
        <Flex gap="4" flexWrap="wrap">
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Monto (ARS)</Text>
            <Input
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              required
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
              _placeholder={{ color: "fg.muted" }}
            />
          </Box>
          <Box flex="1" minW="200px">
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

        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">Categoría</Text>
          <Select
            name="category"
            required
          >
            <option value="">Seleccionar...</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_ICONS[cat]} {cat}
              </option>
            ))}
          </Select>
        </Box>

        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">Descripción</Text>
          <Input
            name="description"
            placeholder="Ej: Compra en Mercado Libre"
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

        <Button
          type="submit"
          bg="brand.600"
          color="white"
          _hover={{ bg: "brand.500" }}
          loading={loading}
          alignSelf="flex-end"
          px="5"
        >
          Agregar Gasto
        </Button>
      </VStack>
    </form>
    </Box>
  );
}
