"use client";

import { useMemo, useState } from "react";
import { Box, Collapsible, Flex, Text, Button } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/format";
import type { IncomeWithPlatform } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  change?: number;
  items: IncomeWithPlatform[];
}

function groupByMonth(incomes: IncomeWithPlatform[]): MonthGroup[] {
  const map = new Map<string, IncomeWithPlatform[]>();

  for (const inc of incomes) {
    const key = inc.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inc);
  }

  const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));

  const groups: MonthGroup[] = sortedKeys.map((key) => {
    const items = map.get(key)!;
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
    const d = new Date(key + "-01T00:00:00");
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1), total, items };
  });

  for (let i = 0; i < groups.length; i++) {
    const prev = groups[i + 1];
    if (prev && prev.total > 0) {
      groups[i].change = ((groups[i].total - prev.total) / prev.total) * 100;
    }
  }

  return groups;
}

interface IncomeListProps {
  incomes: IncomeWithPlatform[];
}

export function IncomeList({ incomes }: IncomeListProps) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const groups = useMemo(() => groupByMonth(incomes), [incomes]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("incomes").delete().eq("id", id);
    router.refresh();
  };

  if (incomes.length === 0) {
    return (
      <EmptyState
        icon="💵"
        title="Sin ingresos"
        description="Registrá tu primer ingreso con el formulario de arriba"
      />
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap="4">
      {groups.map((group, gi) => (
        <Collapsible.Root key={group.key} defaultOpen={gi === 0}>
          <Box
            bg="bg.card"
            borderRadius="xl"
            border="1px solid"
            borderColor="border.card"
            overflow="hidden"
          >
            <Collapsible.Trigger asChild>
              <Flex
                as="button"
                width="100%"
                align="center"
                justify="space-between"
                px="5"
                py="4"
                cursor="pointer"
                _hover={{ bg: "bg.hover" }}
              >
                <Flex align="center" gap="3">
                  <Collapsible.Indicator transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Collapsible.Indicator>
                  <Text fontSize="sm" fontWeight="semibold" color="fg.heading">
                    {group.label}
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  {group.change !== undefined && (
                    <Text
                      fontSize="xs"
                      color={group.change >= 0 ? "green.400" : "red.400"}
                    >
                      {formatPercentage(group.change)}
                    </Text>
                  )}
                  <Text fontSize="sm" fontWeight="semibold" color="green.400">
                    +{mask(formatCurrency(group.total))}
                  </Text>
                </Flex>
              </Flex>
            </Collapsible.Trigger>

            <Collapsible.Content>
              {group.items.map((income) => (
                <Flex
                  key={income.id}
                  align="center"
                  justify="space-between"
                  px="5"
                  py="4"
                  borderTop="1px solid"
                  borderColor="border.card"
                  _hover={{ bg: "bg.hover" }}
                >
                  <Flex align="center" gap="3" flex="1">
                    <Text fontSize="xl">💵</Text>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                        {income.description || income.source}
                      </Text>
                      <Flex gap="2" align="center">
                        <Text fontSize="xs" color="fg.muted">
                          {formatDate(income.date)} · {income.source}
                        </Text>
                        {income.platform && (
                          <Text fontSize="xs" color="fg.muted">
                            · {income.platform.name}
                          </Text>
                        )}
                      </Flex>
                    </Box>
                  </Flex>

                  <Flex align="center" gap="4">
                    <Text fontSize="sm" fontWeight="semibold" color="green.400">
                      +{mask(formatCurrency(Number(income.amount), income.currency as any))}
                    </Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="fg.muted"
                      _hover={{ color: "red.400" }}
                      onClick={() => setDeleteId(income.id)}
                    >
                      ✕
                    </Button>
                  </Flex>
                </Flex>
              ))}
            </Collapsible.Content>
          </Box>
        </Collapsible.Root>
      ))}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Eliminar ingreso"
      />
    </Box>
  );
}
