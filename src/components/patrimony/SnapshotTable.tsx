"use client";

import { useState, useMemo } from "react";
import { Box, Flex, Text, Button, VStack, Grid } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatMonthYear, formatPercentage } from "@/lib/utils/format";
import type { PatrimonySnapshotFull } from "@/types/database";
import { CURRENCY_SYMBOLS, type Currency } from "@/lib/constants/currencies";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";

interface SnapshotTableProps {
  snapshots: PatrimonySnapshotFull[];
  onEdit: (snapshot: PatrimonySnapshotFull) => void;
}

interface PlatformColumn {
  platformId: string;
  platformName: string;
  currencies: string[];
}

type CellColor = "green" | "red" | "yellow" | "neutral";

type AmountLookup = Map<string, number>;

const CURRENCY_ORDER = ["ARS", "USD", "EUR", "BTC", "ETH"];

function buildColumnsForSnapshot(
  snapshot: PatrimonySnapshotFull
): PlatformColumn[] {
  const columnMap = new Map<string, { name: string; currencies: Set<string> }>();

  for (const item of snapshot.items) {
    if (!columnMap.has(item.platform_id)) {
      columnMap.set(item.platform_id, {
        name: item.platform_name,
        currencies: new Set(),
      });
    }
    columnMap.get(item.platform_id)!.currencies.add(item.currency);
  }

  return [...columnMap.entries()]
    .map(([platformId, { name, currencies }]) => ({
      platformId,
      platformName: name,
      currencies: [...currencies].sort(
        (a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b)
      ),
    }))
    .sort((a, b) => a.platformName.localeCompare(b.platformName));
}

function buildLookup(items: PatrimonySnapshotFull["items"]): AmountLookup {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(`${item.platform_id}-${item.currency}`, Number(item.amount));
  }
  return map;
}

function getCellColor(
  current: number | undefined,
  previous: number | undefined
): CellColor {
  if (current === undefined || previous === undefined) return "neutral";
  if (current === 0 && previous === 0) return "neutral";
  if (current > previous) return "green";
  if (current < previous) return "red";
  return "yellow";
}

const cellBg: Record<CellColor, string> = {
  green: "rgba(34,197,94,0.12)",
  red: "rgba(239,68,68,0.12)",
  yellow: "rgba(245,158,11,0.12)",
  neutral: "transparent",
};

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency as Currency] || "";
  if (currency === "BTC" || currency === "ETH") {
    return `${symbol} ${amount.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })}`;
  }
  return `${symbol} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PAGE_SIZE = 5;

export function SnapshotTable({
  snapshots,
  onEdit,
}: SnapshotTableProps) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const lookups = useMemo(
    () => snapshots.map((s) => buildLookup(s.items)),
    [snapshots]
  );

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("patrimony_snapshots").delete().eq("id", id);
    router.refresh();
  };

  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon="🏦"
        title="Sin snapshots"
        description="Crea tu primer snapshot de patrimonio"
      />
    );
  }

  const visibleSnapshots = snapshots.slice(0, visibleCount);
  const hasMore = visibleCount < snapshots.length;

  return (
    <>
      <VStack gap="4" align="stretch">
        {visibleSnapshots.map((snapshot, i) => {
          const prevSnapshot = snapshots[i + 1];
          const totalChange =
            prevSnapshot && Number(prevSnapshot.total_ars) > 0
              ? ((Number(snapshot.total_ars) - Number(prevSnapshot.total_ars)) /
                  Number(prevSnapshot.total_ars)) *
                100
              : undefined;

          return (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              currentLookup={lookups[i]}
              prevLookup={lookups[i + 1]}
              totalChange={totalChange}
              mask={mask}
              onEdit={() => onEdit(snapshot)}
              onDelete={() => setDeleteId(snapshot.id)}
            />
          );
        })}
        {hasMore && (
          <Button
            variant="ghost"
            color="fg.muted"
            size="sm"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            alignSelf="center"
          >
            Cargar más
          </Button>
        )}
      </VStack>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Eliminar snapshot"
      />
    </>
  );
}

// --- SnapshotCard ---

interface SnapshotCardProps {
  snapshot: PatrimonySnapshotFull;
  currentLookup: AmountLookup;
  prevLookup: AmountLookup | undefined;
  totalChange: number | undefined;
  mask: (v: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}

function SnapshotCard({
  snapshot,
  currentLookup,
  prevLookup,
  totalChange,
  mask,
  onEdit,
  onDelete,
}: SnapshotCardProps) {
  const platformColumns = useMemo(
    () => buildColumnsForSnapshot(snapshot),
    [snapshot]
  );
  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      overflow="hidden"
    >
      {/* Header */}
      <Box
        px="5"
        py="4"
        borderBottom="1px solid"
        borderColor="border.card"
      >
        <Flex justify="space-between" align="center">
          <Flex align="center" gap="3">
            <Text fontWeight="semibold" color="fg.heading">
              {formatMonthYear(snapshot.date)}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {formatDate(snapshot.date)}
            </Text>
          </Flex>
          <Flex align="center" gap="1">
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              _hover={{ color: "brand.500" }}
              onClick={onEdit}
              px="2"
            >
              Editar
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              _hover={{ color: "red.400" }}
              onClick={onDelete}
              px="2"
            >
              ✕
            </Button>
          </Flex>
        </Flex>
        {snapshot.notes && (
          <Text fontSize="xs" color="fg.muted" mt="0.5">
            {snapshot.notes}
          </Text>
        )}
        <Flex align="center" gap="2" mt="1">
          <Text fontWeight="bold" fontSize="lg" color="fg.heading">
            {mask(formatCurrency(Number(snapshot.total_ars)))}
          </Text>
          {totalChange !== undefined && (
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={totalChange >= 0 ? "green.400" : "red.400"}
            >
              {formatPercentage(totalChange)}
            </Text>
          )}
        </Flex>
      </Box>

      {/* Desktop: Grid layout */}
      <Box overflowX="auto" display={{ base: "none", lg: "block" }}>
        <Grid
          templateColumns={`repeat(${platformColumns.length}, minmax(140px, 1fr))`}
          minW={`${platformColumns.length * 150}px`}
          gap="0"
        >
          {platformColumns.map((col, colIdx) => (
            <Box
              key={col.platformId}
              px="4"
              py="3"
              borderRight={
                colIdx < platformColumns.length - 1 ? "1px solid" : "none"
              }
              borderColor="border.card"
            >
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color="fg.heading"
                mb="2"
              >
                {col.platformName}
              </Text>
              <VStack gap="1" align="stretch">
                {col.currencies.map((currency) => {
                  const key = `${col.platformId}-${currency}`;
                  const current = currentLookup.get(key);
                  const previous = prevLookup?.get(key);
                  const color = getCellColor(current, previous);

                  return (
                    <Flex
                      key={currency}
                      justify="space-between"
                      align="center"
                      py="1"
                      px="2"
                      borderRadius="md"
                      bg={cellBg[color]}
                    >
                      <Text fontSize="xs" color="fg.muted">
                        {currency}
                      </Text>
                      <Text fontSize="xs" color="fg.body" fontWeight="medium">
                        {current !== undefined
                          ? mask(formatAmount(current, currency))
                          : "-"}
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            </Box>
          ))}
        </Grid>
      </Box>

      {/* Mobile/Tablet: Stacked layout */}
      <VStack
        display={{ base: "flex", lg: "none" }}
        gap="0"
        align="stretch"
        divideY="1px"
        divideColor="border.card"
      >
        {platformColumns.map((col) => {
          const hasData = col.currencies.some(
            (c) => currentLookup.get(`${col.platformId}-${c}`) !== undefined
          );
          if (!hasData) return null;

          return (
            <Box key={col.platformId} px="4" py="3">
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color="fg.heading"
                mb="1.5"
              >
                {col.platformName}
              </Text>
              <VStack gap="1" align="stretch">
                {col.currencies.map((currency) => {
                  const key = `${col.platformId}-${currency}`;
                  const current = currentLookup.get(key);
                  if (current === undefined) return null;
                  const previous = prevLookup?.get(key);
                  const color = getCellColor(current, previous);

                  return (
                    <Flex
                      key={currency}
                      justify="space-between"
                      align="center"
                      py="1"
                      px="2"
                      borderRadius="md"
                      bg={cellBg[color]}
                    >
                      <Text fontSize="xs" color="fg.muted">
                        {currency}
                      </Text>
                      <Text fontSize="xs" color="fg.body" fontWeight="medium">
                        {mask(formatAmount(current, currency))}
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
