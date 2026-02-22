"use client";

import { useState } from "react";
import { Box, Flex, Text, Button, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/format";
import type { PatrimonySnapshot, PatrimonySnapshotItem, Platform } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/constants/currencies";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface SnapshotListProps {
  snapshots: PatrimonySnapshot[];
  platforms: Platform[];
}

interface LoadedItems {
  [snapshotId: string]: (PatrimonySnapshotItem & { platform_name: string })[];
}

export function SnapshotList({ snapshots, platforms }: SnapshotListProps) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadedItems, setLoadedItems] = useState<LoadedItems>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p.name]));

  const handleToggle = async (snapshotId: string) => {
    if (expandedId === snapshotId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(snapshotId);

    if (loadedItems[snapshotId]) return;

    setLoadingId(snapshotId);
    const supabase = createClient();
    const { data } = await supabase
      .from("patrimony_snapshot_items")
      .select("*")
      .eq("snapshot_id", snapshotId);

    if (data) {
      setLoadedItems((prev) => ({
        ...prev,
        [snapshotId]: data.map((item) => ({
          ...item,
          platform_name: platformMap[item.platform_id] || "Desconocida",
        })),
      }));
    }
    setLoadingId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    await supabase.from("patrimony_snapshots").delete().eq("id", id);
    router.refresh();
  };

  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon="🏦"
        title="Sin snapshots"
        description="Creá tu primer snapshot de patrimonio"
      />
    );
  }

  // Group items by platform for display
  function groupByPlatform(items: (PatrimonySnapshotItem & { platform_name: string })[]) {
    const groups: Record<string, { name: string; entries: { currency: string; amount: number }[] }> = {};
    for (const item of items) {
      if (!groups[item.platform_id]) {
        groups[item.platform_id] = { name: item.platform_name, entries: [] };
      }
      groups[item.platform_id].entries.push({
        currency: item.currency,
        amount: Number(item.amount),
      });
    }
    return Object.values(groups);
  }

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      overflow="hidden"
    >
      {snapshots.map((snapshot, i) => {
        const prev = snapshots[i + 1];
        const change =
          prev && Number(prev.total_ars) > 0
            ? ((Number(snapshot.total_ars) - Number(prev.total_ars)) /
                Number(prev.total_ars)) *
              100
            : undefined;

        const isExpanded = expandedId === snapshot.id;
        const items = loadedItems[snapshot.id];
        const isLoading = loadingId === snapshot.id;

        return (
          <Box
            key={snapshot.id}
            borderBottom={i < snapshots.length - 1 ? "1px solid" : "none"}
            borderColor="border.card"
          >
            <Flex
              align="center"
              justify="space-between"
              px="5"
              py="4"
              cursor="pointer"
              _hover={{ bg: "bg.hover" }}
              onClick={() => handleToggle(snapshot.id)}
            >
              <Box flex="1">
                <Flex align="center" gap="3">
                  <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                    {formatDate(snapshot.date)}
                  </Text>
                  {change !== undefined && (
                    <Text
                      fontSize="xs"
                      color={change >= 0 ? "green.400" : "red.400"}
                    >
                      {formatPercentage(change)}
                    </Text>
                  )}
                </Flex>
                {snapshot.notes && (
                  <Text fontSize="xs" color="fg.muted" mt="0.5">
                    {snapshot.notes}
                  </Text>
                )}
              </Box>

              <Flex align="center" gap="4">
                <Text fontSize="sm" fontWeight="semibold" color="fg.heading">
                  {mask(formatCurrency(Number(snapshot.total_ars)))}
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.muted"
                  _hover={{ color: "red.400" }}
                  onClick={(e) => handleDelete(snapshot.id, e)}
                >
                  ✕
                </Button>
              </Flex>
            </Flex>

            {isExpanded && (
              <Box px="5" pb="4" pt="2">
                {isLoading ? (
                  <Text fontSize="xs" color="fg.muted" py="2">
                    Cargando detalle...
                  </Text>
                ) : items && items.length > 0 ? (
                  <VStack gap="3" align="stretch">
                    {groupByPlatform(items).map((group) => (
                      <Box
                        key={group.name}
                        bg="bg.hover"
                        borderRadius="lg"
                        px="4"
                        py="3"
                      >
                        <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
                          {group.name}
                        </Text>
                        <Flex gap="4" flexWrap="wrap">
                          {group.entries.map((entry) => (
                            <Text key={entry.currency} fontSize="xs" color="fg.body">
                              {mask(
                                `${CURRENCY_SYMBOLS[entry.currency as Currency] || ""} ${entry.amount.toLocaleString("es-AR", {
                                  minimumFractionDigits: entry.currency === "BTC" || entry.currency === "ETH" ? 8 : 2,
                                  maximumFractionDigits: entry.currency === "BTC" || entry.currency === "ETH" ? 8 : 2,
                                })}`
                              )}{" "}
                              <Text as="span" color="fg.muted">{entry.currency}</Text>
                            </Text>
                          ))}
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="xs" color="fg.muted" py="2">
                    Sin items detallados
                  </Text>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
