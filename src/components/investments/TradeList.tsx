"use client";

import { useMemo, useState } from "react";
import { Box, Collapsible, Flex, Text, Button } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils/format";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { defaultLabel } from "@/lib/utils/trading";
import type { TradeWithPlatform } from "@/types/database";

interface MonthGroup {
  key: string;
  label: string;
  net: number;
  items: TradeWithPlatform[];
}

function groupByMonth(trades: TradeWithPlatform[]): MonthGroup[] {
  const map = new Map<string, TradeWithPlatform[]>();
  for (const trade of trades) {
    const key = trade.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trade);
  }

  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      label: formatMonthYear(`${key}-01`),
      net: map.get(key)!.reduce((sum, trade) => sum + Number(trade.pnl_usd), 0),
      items: map.get(key)!,
    }));
}

/**
 * Long and Short get a neutral chip with an arrow, never `trend.up` /
 * `trend.down`: those encode the *result*. A winning Short painted red would be
 * a lie told in colour.
 */
function DirectionChip({ direction }: { direction: "long" | "short" }) {
  const long = direction === "long";
  return (
    <Flex
      align="center"
      gap="1"
      border="1px solid"
      borderColor="border.input"
      borderRadius="md"
      px="1.5"
      py="0.5"
      flexShrink={0}
    >
      <Box as="span" color="fg.body" display="inline-flex">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {long ? (
            <>
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </>
          ) : (
            <>
              <path d="M7 7l10 10" />
              <path d="M17 7v10H7" />
            </>
          )}
        </svg>
      </Box>
      <Text as="span" fontSize="2xs" color="fg.body">
        {long ? "Long" : "Short"}
      </Text>
    </Flex>
  );
}

/** `+US$ 420,00`. The sign is carried explicitly, never inferred from colour. */
function signed(usd: number, currency: "USD" = "USD"): string {
  return `${usd >= 0 ? "+" : "−"}${formatCurrency(Math.abs(usd), currency)}`;
}

function signedPercent(pct: number): string {
  const n = Math.abs(pct).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${pct >= 0 ? "+" : "−"}${n} %`;
}

export function TradeList({ trades }: { trades: TradeWithPlatform[] }) {
  const router = useRouter();
  const { mask } = useMoneyVisibility();
  const groups = useMemo(() => groupByMonth(trades), [trades]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("trades").delete().eq("id", id);
    router.refresh();
  };

  if (trades.length === 0) {
    return (
      <EmptyState
        icon="📓"
        title="Sin operaciones"
        description="Cargá tu primera operación con el formulario de arriba. Las ganancias se cuentan como ingreso solas."
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
                gap="3"
                px="5"
                py="4"
                cursor="pointer"
                _hover={{ bg: "bg.hover" }}
              >
                <Flex align="center" gap="3" minW="0">
                  <Collapsible.Indicator transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Collapsible.Indicator>
                  <Text fontSize="sm" fontWeight="semibold" color="fg.heading" truncate>
                    {group.label}
                  </Text>
                </Flex>
                <Flex align="center" gap="3" flexShrink={0}>
                  <Text fontSize="xs" color="fg.muted" display={{ base: "none", sm: "block" }}>
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "operación" : "operaciones"}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    fontFamily="mono"
                    color={group.net >= 0 ? "trend.up" : "trend.down"}
                    data-num
                  >
                    {mask(signed(group.net))}
                  </Text>
                </Flex>
              </Flex>
            </Collapsible.Trigger>

            <Collapsible.Content>
              {group.items.map((trade) => {
                const pnl = Number(trade.pnl_usd);
                const token = pnl >= 0 ? "trend.up" : "trend.down";
                const meta = [
                  formatDate(trade.date),
                  trade.leverage ? `${Number(trade.leverage)}×` : null,
                  trade.platform?.name,
                ].filter(Boolean);

                return (
                  <Flex
                    key={trade.id}
                    direction={{ base: "column", sm: "row" }}
                    align={{ base: "stretch", sm: "center" }}
                    justify="space-between"
                    gap={{ base: "2", sm: "4" }}
                    px="5"
                    py="4"
                    borderTop="1px solid"
                    borderColor="border.card"
                    _hover={{ bg: "bg.hover" }}
                  >
                    <Flex align="center" gap="2" flexWrap="wrap" flex="1" minW="0">
                      <Box bg="brand.100" borderRadius="lg" px="2.5" py="1" minW="fit-content">
                        <Text fontSize="sm" fontWeight="bold" color="brand.700">
                          {trade.asset}
                        </Text>
                      </Box>
                      <DirectionChip direction={trade.direction} />
                      <Box minW="0">
                        <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                          {trade.notes?.trim() || defaultLabel(trade)}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" data-num>
                          {meta.join(" · ")}
                        </Text>
                      </Box>
                    </Flex>

                    <Flex align="center" gap="4" justify="space-between" flexShrink={0}>
                      <Box textAlign={{ base: "left", sm: "right" }}>
                        <Text fontSize="sm" fontWeight="semibold" fontFamily="mono" color={token} data-num>
                          {mask(signed(pnl))}
                        </Text>
                        {trade.pnl_pct !== null && (
                          <Text fontSize="xs" color="fg.muted" fontFamily="mono" data-num>
                            {signedPercent(Number(trade.pnl_pct))}
                          </Text>
                        )}
                      </Box>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        _hover={{ color: "trend.down" }}
                        aria-label="Eliminar operación"
                        onClick={() => setDeleteId(trade.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </Button>
                    </Flex>
                  </Flex>
                );
              })}
            </Collapsible.Content>
          </Box>
        </Collapsible.Root>
      ))}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Eliminar operación"
        description="Si era una ganancia, también deja de contarse como ingreso. Si era una pérdida, tu patrimonio estimado sube."
      />
    </Box>
  );
}
