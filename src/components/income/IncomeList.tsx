"use client";

import { useMemo, useState } from "react";
import { Box, Collapsible, Flex, Text, Button } from "@chakra-ui/react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/format";
import type { Platform } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * What this list needs from a row, which is less than a full `Income`.
 *
 * Stated as its own type because not every row here has a row in the `incomes`
 * table: a winning trade is derived from the trade book at render time, so it is
 * shown but cannot be deleted from here.
 */
export interface IncomeListRow {
  id: string;
  amount: number;
  currency: string;
  source: string;
  description: string;
  date: string;
  platform: Pick<Platform, "name"> | null;
  /** Set only on rows derived from the trading book. */
  trade?: { asset: string; direction: string; leverage: number | null };
}

interface MonthGroup {
  key: string;
  label: string;
  totalArs: number;
  totalUsd: number;
  change?: number;
  items: IncomeListRow[];
}

function groupByMonth(incomes: IncomeListRow[], usdRate: number): MonthGroup[] {
  const map = new Map<string, IncomeListRow[]>();

  for (const inc of incomes) {
    const key = inc.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inc);
  }

  const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));

  const groups: MonthGroup[] = sortedKeys.map((key) => {
    const items = map.get(key)!;
    const totalArs = items.filter((i) => i.currency === "ARS").reduce((sum, i) => sum + Number(i.amount), 0);
    const totalUsd = items.filter((i) => i.currency === "USD").reduce((sum, i) => sum + Number(i.amount), 0);
    const d = new Date(key + "-01T00:00:00");
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1), totalArs, totalUsd, items };
  });

  for (let i = 0; i < groups.length; i++) {
    const prev = groups[i + 1];
    if (!prev) continue;
    const curTotal = groups[i].totalArs + groups[i].totalUsd * usdRate;
    const prevTotal = prev.totalArs + prev.totalUsd * usdRate;
    if (prevTotal > 0) {
      groups[i].change = ((curTotal - prevTotal) / prevTotal) * 100;
    }
  }

  return groups;
}

interface IncomeListProps {
  incomes: IncomeListRow[];
  usdRate: number;
}

export function IncomeList({ incomes, usdRate }: IncomeListProps) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const groups = useMemo(() => groupByMonth(incomes, usdRate), [incomes, usdRate]);
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
                      color={group.change >= 0 ? "trend.up" : "trend.down"}
                    >
                      {formatPercentage(group.change)}
                    </Text>
                  )}
                  <Text fontSize="sm" fontWeight="semibold" color="trend.up" fontFamily="mono" data-num>
                    +{mask(formatCurrency(group.totalArs))}
                  </Text>
                  {group.totalUsd > 0 && (
                    <Text fontSize="sm" fontWeight="semibold" color="trend.up" fontFamily="mono" data-num>
                      +{mask(formatCurrency(group.totalUsd, "USD"))}
                    </Text>
                  )}
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
                  // Derived rows sit on the recessed ground: they are shown here
                  // but they are not editable here.
                  bg={income.trade ? "bg.sunk" : undefined}
                  _hover={{ bg: "bg.hover" }}
                >
                  <Flex align="center" gap="3" flex="1" minW="0">
                    {income.trade ? (
                      <Box bg="brand.100" borderRadius="lg" px="2.5" py="1" minW="fit-content">
                        <Text fontSize="sm" fontWeight="bold" color="brand.700">
                          {income.trade.asset}
                        </Text>
                      </Box>
                    ) : (
                      <Text fontSize="xl">💵</Text>
                    )}
                    <Box minW="0">
                      <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                        {income.description || income.source}
                      </Text>
                      <Flex gap="2" align="center" wrap="wrap">
                        <Text fontSize="xs" color="fg.muted">
                          {formatDate(income.date)} · {income.source}
                        </Text>
                        {income.platform && (
                          <Text fontSize="xs" color="fg.muted">
                            · {income.platform.name}
                          </Text>
                        )}
                        {income.trade && (
                          <Text
                            fontSize="2xs"
                            color="fg.muted"
                            border="1px solid"
                            borderColor="border.input"
                            borderRadius="sm"
                            px="1.5"
                          >
                            del libro de trading
                          </Text>
                        )}
                      </Flex>
                    </Box>
                  </Flex>

                  <Flex align="center" gap="4">
                    <Text fontSize="sm" fontWeight="semibold" color="trend.up" fontFamily="mono" data-num>
                      +{mask(formatCurrency(Number(income.amount), income.currency as any))}
                    </Text>
                    {income.trade ? (
                      <Button
                        asChild
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        _hover={{ color: "fg.heading" }}
                      >
                        <Link
                          href="/dashboard/investments/trading"
                          aria-label="Ver en el libro de trading"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        _hover={{ color: "trend.down" }}
                        aria-label="Eliminar"
                        onClick={() => setDeleteId(income.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </Button>
                    )}
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
