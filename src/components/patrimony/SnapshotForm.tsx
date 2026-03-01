"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Select } from "@/components/shared/Select";
import { Box, Button, Flex, Input, Text, VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format";
import { convertToArs } from "@/lib/utils/currency-conversion";
import type { Platform, ExchangeRates, PatrimonySnapshotFull } from "@/types/database";
import { CURRENCIES, PLATFORM_TYPES, PLATFORM_TYPE_LABELS } from "@/lib/constants/currencies";

interface CurrencyRow {
  id: string;
  currency: string;
  amount: string;
}

interface PlatformBalances {
  [platformId: string]: CurrencyRow[];
}

interface SnapshotFormProps {
  platforms: Platform[];
  exchangeRates: ExchangeRates;
  editingSnapshot: PatrimonySnapshotFull | null;
  onClose: () => void;
}

let rowCounter = 0;
function nextRowId() {
  return `row_${++rowCounter}`;
}

function buildNotesFromRates(rates: ExchangeRates): string {
  const parts: string[] = [];
  if (rates.usdRate > 0) {
    parts.push(`Dolar ${Math.round(rates.usdRate)}`);
  }
  if (rates.btcUsd > 0) {
    const btcK =
      rates.btcUsd >= 1000
        ? `${Math.round(rates.btcUsd / 1000)}k`
        : Math.round(rates.btcUsd).toString();
    parts.push(`BTC ${btcK}`);
  }
  if (rates.ethUsd > 0) {
    const ethVal =
      rates.ethUsd >= 1000
        ? `${(rates.ethUsd / 1000).toFixed(1)}k`
        : Math.round(rates.ethUsd).toString();
    parts.push(`ETH ${ethVal}`);
  }
  return parts.join(", ");
}

export function SnapshotForm({
  platforms: initialPlatforms,
  exchangeRates,
  editingSnapshot,
  onClose,
}: SnapshotFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [balances, setBalances] = useState<PlatformBalances>({});
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hiddenPlatformIds, setHiddenPlatformIds] = useState<Set<string>>(new Set());

  // New platform form
  const [showNewPlatform, setShowNewPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [newPlatformType, setNewPlatformType] = useState("bank");
  const [newPlatformCurrency, setNewPlatformCurrency] = useState("ARS");
  const [savingPlatform, setSavingPlatform] = useState(false);

  const isEditing = !!editingSnapshot;

  // Initialize balances with one default row per platform
  const initBalances = useCallback((plats: Platform[]) => {
    const b: PlatformBalances = {};
    for (const p of plats) {
      b[p.id] = [{ id: nextRowId(), currency: p.default_currency, amount: "" }];
    }
    setBalances(b);
  }, []);

  // Initialize from editing snapshot
  const initFromSnapshot = useCallback(
    (snapshot: PatrimonySnapshotFull, plats: Platform[]) => {
      const b: PlatformBalances = {};
      // Group items by platform
      for (const item of snapshot.items) {
        if (!b[item.platform_id]) {
          b[item.platform_id] = [];
        }
        b[item.platform_id].push({
          id: nextRowId(),
          currency: item.currency,
          amount: String(item.amount),
        });
      }
      // Add empty row for platforms that have no items in this snapshot
      for (const p of plats) {
        if (!b[p.id]) {
          b[p.id] = [{ id: nextRowId(), currency: p.default_currency, amount: "" }];
        }
      }
      setBalances(b);
      setDate(snapshot.date);
      setNotes(snapshot.notes || "");
    },
    []
  );

  useEffect(() => {
    setPlatforms(initialPlatforms);
  }, [initialPlatforms]);

  // Handle edit mode trigger or initialize new form
  useEffect(() => {
    if (editingSnapshot) {
      setError("");
      initFromSnapshot(editingSnapshot, initialPlatforms);
    } else {
      initBalances(initialPlatforms);
      setNotes(buildNotesFromRates(exchangeRates));
      setDate(new Date().toISOString().split("T")[0]);
      setHiddenPlatformIds(new Set());
    }
  }, [editingSnapshot, initialPlatforms, initFromSnapshot, initBalances, exchangeRates]);

  // Live total calculation (skip hidden platforms)
  const liveTotal = useMemo(() => {
    let total = 0;
    for (const [platformId, rows] of Object.entries(balances)) {
      if (hiddenPlatformIds.has(platformId)) continue;
      for (const row of rows) {
        const amount = parseFloat(row.amount) || 0;
        total += convertToArs(amount, row.currency, exchangeRates);
      }
    }
    return total;
  }, [balances, exchangeRates, hiddenPlatformIds]);

  // Hide/show platforms in the form
  const hidePlatform = (platformId: string) => {
    setHiddenPlatformIds((prev) => new Set([...prev, platformId]));
  };

  const restorePlatform = (platformId: string) => {
    setHiddenPlatformIds((prev) => {
      const next = new Set(prev);
      next.delete(platformId);
      return next;
    });
    // Ensure the platform has at least one row
    setBalances((prev) => {
      if (!prev[platformId] || prev[platformId].length === 0) {
        const plat = platforms.find((p) => p.id === platformId);
        return {
          ...prev,
          [platformId]: [{ id: nextRowId(), currency: plat?.default_currency || "ARS", amount: "" }],
        };
      }
      return prev;
    });
  };

  const visiblePlatforms = platforms.filter((p) => !hiddenPlatformIds.has(p.id));
  const hiddenPlatforms = platforms.filter((p) => hiddenPlatformIds.has(p.id));

  const handleClose = () => {
    setError("");
    setNotes("");
    setHiddenPlatformIds(new Set());
    onClose();
  };

  // Add currency row to a platform
  const addRow = (platformId: string) => {
    setBalances((prev) => {
      const existing = prev[platformId] || [];
      const usedCurrencies = existing.map((r) => r.currency);
      const available = CURRENCIES.filter((c) => !usedCurrencies.includes(c));
      const nextCurrency = available[0] || "ARS";
      return {
        ...prev,
        [platformId]: [...existing, { id: nextRowId(), currency: nextCurrency, amount: "" }],
      };
    });
  };

  // Remove currency row
  const removeRow = (platformId: string, rowId: string) => {
    setBalances((prev) => ({
      ...prev,
      [platformId]: (prev[platformId] || []).filter((r) => r.id !== rowId),
    }));
  };

  // Update a row's currency or amount
  const updateRow = (platformId: string, rowId: string, field: "currency" | "amount", value: string) => {
    setBalances((prev) => ({
      ...prev,
      [platformId]: (prev[platformId] || []).map((r) =>
        r.id === rowId ? { ...r, [field]: value } : r
      ),
    }));
  };

  // Add new platform
  const handleAddPlatform = async () => {
    if (!newPlatformName.trim()) return;
    setSavingPlatform(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("platforms")
      .insert({
        user_id: user!.id,
        name: newPlatformName.trim(),
        type: newPlatformType,
        default_currency: newPlatformCurrency,
        is_active: true,
      })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingPlatform(false);
      return;
    }

    const newPlatform = data as Platform;
    setPlatforms((prev) => [...prev, newPlatform]);
    setBalances((prev) => ({
      ...prev,
      [newPlatform.id]: [{ id: nextRowId(), currency: newPlatform.default_currency, amount: "" }],
    }));

    setNewPlatformName("");
    setNewPlatformType("bank");
    setNewPlatformCurrency("ARS");
    setShowNewPlatform(false);
    setSavingPlatform(false);
  };

  // Collect non-zero items from balances (skip hidden platforms)
  const collectItems = () => {
    const items: { platform_id: string; currency: string; amount: number }[] = [];
    for (const [platformId, rows] of Object.entries(balances)) {
      if (hiddenPlatformIds.has(platformId)) continue;
      for (const row of rows) {
        const amount = parseFloat(row.amount);
        if (amount && amount !== 0) {
          items.push({ platform_id: platformId, currency: row.currency, amount });
        }
      }
    }
    return items;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const items = collectItems();

    // Auto-calculate total ARS
    let totalArs = 0;
    for (const item of items) {
      totalArs += convertToArs(item.amount, item.currency, exchangeRates);
    }

    if (isEditing) {
      // Update existing snapshot
      const { error: updateError } = await supabase
        .from("patrimony_snapshots")
        .update({ date, total_ars: totalArs, notes: notes || null })
        .eq("id", editingSnapshot!.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Delete old items and insert new ones
      const { error: deleteError } = await supabase
        .from("patrimony_snapshot_items")
        .delete()
        .eq("snapshot_id", editingSnapshot!.id);

      if (deleteError) {
        setError(deleteError.message);
        setLoading(false);
        return;
      }

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("patrimony_snapshot_items")
          .insert(items.map((i) => ({ ...i, snapshot_id: editingSnapshot!.id })));

        if (itemsError) {
          setError(itemsError.message);
          setLoading(false);
          return;
        }
      }
    } else {
      // Create new snapshot
      const { data: snapshot, error: snapError } = await supabase
        .from("patrimony_snapshots")
        .insert({
          user_id: user!.id,
          date,
          total_ars: totalArs,
          notes: notes || null,
        })
        .select("id")
        .single();

      if (snapError) {
        setError(snapError.message);
        setLoading(false);
        return;
      }

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("patrimony_snapshot_items")
          .insert(items.map((i) => ({ ...i, snapshot_id: snapshot.id })));

        if (itemsError) {
          setError(itemsError.message);
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
    handleClose();
    router.refresh();
  };

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
    <form onSubmit={handleSubmit}>
      <Flex justify="space-between" align="center" mb="4">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
          {isEditing ? "Editar Snapshot" : "Nuevo Snapshot de Patrimonio"}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          color="fg.body"
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </Flex>

      <VStack gap="4" align="stretch">
        <Flex gap="4" flexWrap="wrap">
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Fecha</Text>
            <Input
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
            />
          </Box>
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Total en ARS (calculado)</Text>
            <Box bg="bg.hover" borderRadius="lg" px="4" py="2.5">
              <Text fontSize="lg" fontWeight="bold" color="fg.heading">
                {formatCurrency(liveTotal)}
              </Text>
            </Box>
          </Box>
        </Flex>

        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">
            Notas (opcional)
          </Text>
          <Input
            name="notes"
            placeholder="Ej: Dolar a 1400, BTC 100k"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            bg="bg.input"
            border="1px solid"
            borderColor="border.input"
            color="fg.heading"
            _placeholder={{ color: "fg.muted" }}
          />
        </Box>

        {/* Platform balances */}
        <Box>
          <Flex justify="space-between" align="center" mb="3" mt="2">
            <Heading size="sm" color="fg.heading">
              Balances por plataforma
            </Heading>
            <Button
              size="xs"
              variant="ghost"
              color="brand.500"
              _hover={{ bg: "bg.hover" }}
              onClick={() => setShowNewPlatform(!showNewPlatform)}
            >
              {showNewPlatform ? "Cancelar" : "+ Plataforma"}
            </Button>
          </Flex>

          {/* Inline new platform form */}
          {showNewPlatform && (
            <Box bg="bg.hover" borderRadius="lg" p="4" mb="4">
              <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="2">
                Nueva plataforma
              </Text>
              <Flex gap="3" flexWrap="wrap" align="flex-end">
                <Box flex="1" minW="120px">
                  <Text fontSize="xs" color="fg.muted" mb="1">Nombre</Text>
                  <Input
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    placeholder="Ej: Mercado Pago"
                    bg="bg.input"
                    border="1px solid"
                    borderColor="border.input"
                    color="fg.heading"
                    _placeholder={{ color: "fg.muted" }}
                  />
                </Box>
                <Box flex="1" minW="120px">
                  <Text fontSize="xs" color="fg.muted" mb="1">Tipo</Text>
                  <Select
                    value={newPlatformType}
                    onChange={(e) => setNewPlatformType(e.target.value)}
                  >
                    {PLATFORM_TYPES.map((t) => (
                      <option key={t} value={t}>{PLATFORM_TYPE_LABELS[t]}</option>
                    ))}
                  </Select>
                </Box>
                <Box flex="1" minW="100px">
                  <Text fontSize="xs" color="fg.muted" mb="1">Moneda</Text>
                  <Select
                    value={newPlatformCurrency}
                    onChange={(e) => setNewPlatformCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Box>
                <Button
                  size="sm"
                  bg="brand.600"
                  color="white"
                  _hover={{ bg: "brand.500" }}
                  onClick={handleAddPlatform}
                  loading={savingPlatform}
                  px="4"
                >
                  Agregar
                </Button>
              </Flex>
            </Box>
          )}

          <VStack gap="4" align="stretch">
            {visiblePlatforms.map((platform) => {
              const rows = balances[platform.id] || [];

              return (
                <Box key={platform.id}>
                  <Flex align="center" gap="2" mb="2">
                    <Text fontSize="sm" fontWeight="medium" color="fg.heading">
                      {platform.name}
                    </Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="brand.500"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => addRow(platform.id)}
                      px="2"
                    >
                      +
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="fg.muted"
                      _hover={{ color: "red.400" }}
                      onClick={() => hidePlatform(platform.id)}
                      px="2"
                    >
                      Quitar
                    </Button>
                  </Flex>

                  <VStack gap="2" align="stretch">
                    {rows.map((row) => (
                      <Flex key={row.id} gap="2" align="center">
                        <Box w="100px">
                          <Select
                            value={row.currency}
                            onChange={(e) => updateRow(platform.id, row.id, "currency", e.target.value)}
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </Select>
                        </Box>
                        <Box flex="1">
                          <Input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={row.amount}
                            onChange={(e) => updateRow(platform.id, row.id, "amount", e.target.value)}
                            bg="bg.input"
                            border="1px solid"
                            borderColor="border.input"
                            color="fg.heading"
                            _placeholder={{ color: "fg.muted" }}
                          />
                        </Box>
                        {rows.length > 1 && (
                          <Button
                            size="xs"
                            variant="ghost"
                            color="fg.muted"
                            _hover={{ color: "red.400" }}
                            onClick={() => removeRow(platform.id, row.id)}
                            px="2"
                          >
                            ✕
                          </Button>
                        )}
                      </Flex>
                    ))}
                  </VStack>
                </Box>
              );
            })}
          </VStack>

          {hiddenPlatforms.length > 0 && (
            <Flex gap="2" flexWrap="wrap" mt="3" align="center">
              <Text fontSize="xs" color="fg.muted">
                Ocultas:
              </Text>
              {hiddenPlatforms.map((p) => (
                <Button
                  key={p.id}
                  size="xs"
                  variant="outline"
                  color="fg.body"
                  borderColor="border.input"
                  _hover={{ bg: "bg.hover" }}
                  onClick={() => restorePlatform(p.id)}
                >
                  + {p.name}
                </Button>
              ))}
            </Flex>
          )}
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
          {isEditing ? "Guardar cambios" : "Guardar Snapshot"}
        </Button>
      </VStack>
    </form>
    </Box>
  );
}
