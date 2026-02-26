"use client";

import { useState } from "react";
import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { InvestmentWithPlatform } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Currency } from "@/lib/constants/currencies";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface InvestmentListProps {
  investments: InvestmentWithPlatform[];
}

export function InvestmentList({ investments }: InvestmentListProps) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("investments").delete().eq("id", id);
    router.refresh();
  };

  if (investments.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="Sin inversiones"
        description="Registrá tu primera inversión con el formulario de arriba"
      />
    );
  }

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      overflow="hidden"
    >
      {investments.map((inv, i) => (
        <Flex
          key={inv.id}
          align="center"
          justify="space-between"
          px="5"
          py="4"
          borderBottom={i < investments.length - 1 ? "1px solid" : "none"}
          borderColor="border.card"
          _hover={{ bg: "bg.hover" }}
        >
          <Flex align="center" gap="3" flex="1">
            <Box
              bg="brand.100"
              borderRadius="lg"
              px="2.5"
              py="1"
              minW="fit-content"
            >
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="brand.700"
              >
                {inv.asset}
              </Text>
            </Box>
            <Box>
              {Number(inv.units) > 0 && (
                <Flex gap="2" align="center">
                  <Text fontSize="sm" color="fg.heading">
                    {Number(inv.units).toLocaleString("es-AR", {
                      maximumFractionDigits: 8,
                    })}{" "}
                    unidades
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    a {mask(formatCurrency(Number(inv.price_per_unit), inv.currency as Currency))}
                  </Text>
                </Flex>
              )}
              <Flex gap="2" align="center">
                <Text fontSize="xs" color="fg.muted">
                  {formatDate(inv.date)} · {inv.asset_type}
                </Text>
                {inv.platform && (
                  <Text fontSize="xs" color="fg.muted">
                    · {inv.platform.name}
                  </Text>
                )}
              </Flex>
            </Box>
          </Flex>

          <Flex align="center" gap="4">
            <Text fontSize="sm" fontWeight="semibold" color="fg.heading">
              {mask(formatCurrency(Number(inv.total_amount), inv.currency as Currency))}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              _hover={{ color: "red.400" }}
              onClick={() => setDeleteId(inv.id)}
            >
              ✕
            </Button>
          </Flex>
        </Flex>
      ))}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Eliminar inversión"
      />
    </Box>
  );
}
