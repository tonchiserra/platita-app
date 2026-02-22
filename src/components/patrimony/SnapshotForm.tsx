"use client";

import { useState, useEffect, useCallback } from "react";
import { Select } from "@/components/shared/Select";
import { Box, Button, Flex, Input, Text, VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Platform } from "@/types/database";
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
}

let rowCounter = 0;
function nextRowId() {
  return `row_${++rowCounter}`;
}

export function SnapshotForm({ platforms: initialPlatforms }: SnapshotFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [balances, setBalances] = useState<PlatformBalances>({});
  const [notes, setNotes] = useState("");
  const [ratesLoading, setRatesLoading] = useState(false);

  // New platform form
  const [showNewPlatform, setShowNewPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [newPlatformType, setNewPlatformType] = useState("bank");
  const [newPlatformCurrency, setNewPlatformCurrency] = useState("ARS");
  const [savingPlatform, setSavingPlatform] = useState(false);

  // Initialize balances with one default row per platform
  const initBalances = useCallback((plats: Platform[]) => {
    const b: PlatformBalances = {};
    for (const p of plats) {
      b[p.id] = [{ id: nextRowId(), currency: p.default_currency, amount: "" }];
    }
    setBalances(b);
  }, []);

  useEffect(() => {
    setPlatforms(initialPlatforms);
    initBalances(initialPlatforms);
  }, [initialPlatforms, initBalances]);

  // Fetch exchange rates and auto-fill notes
  const fetchRatesForNotes = async () => {
    setRatesLoading(true);
    try {
      const [dolarRes, cryptoRes] = await Promise.all([
        fetch("https://dolarapi.com/v1/dolares/blue").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd").then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);

      const parts: string[] = [];
      if (dolarRes?.venta) {
        parts.push(`Dolar ${Math.round(dolarRes.venta)}`);
      }
      if (cryptoRes?.bitcoin?.usd) {
        const btcK = cryptoRes.bitcoin.usd >= 1000
          ? `${Math.round(cryptoRes.bitcoin.usd / 1000)}k`
          : Math.round(cryptoRes.bitcoin.usd).toString();
        parts.push(`BTC ${btcK}`);
      }
      if (cryptoRes?.ethereum?.usd) {
        const ethVal = cryptoRes.ethereum.usd >= 1000
          ? `${(cryptoRes.ethereum.usd / 1000).toFixed(1)}k`
          : Math.round(cryptoRes.ethereum.usd).toString();
        parts.push(`ETH ${ethVal}`);
      }

      if (parts.length > 0) {
        setNotes(parts.join(", "));
      }
    } catch {
      // silently fail
    }
    setRatesLoading(false);
  };

  // When form opens, fetch rates
  const handleOpen = () => {
    setIsOpen(true);
    initBalances(platforms);
    fetchRatesForNotes();
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const date = formData.get("date") as string;
    const totalArs = parseFloat((formData.get("total_ars") as string) || "0");

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

    // Collect items from balances state
    const items: {
      snapshot_id: string;
      platform_id: string;
      currency: string;
      amount: number;
    }[] = [];

    for (const [platformId, rows] of Object.entries(balances)) {
      for (const row of rows) {
        const amount = parseFloat(row.amount);
        if (amount && amount !== 0) {
          items.push({
            snapshot_id: snapshot.id,
            platform_id: platformId,
            currency: row.currency,
            amount,
          });
        }
      }
    }

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("patrimony_snapshot_items")
        .insert(items);

      if (itemsError) {
        setError(itemsError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setIsOpen(false);
    setNotes("");
    router.refresh();
  };

  if (!isOpen) {
    return (
      <Button
        onClick={handleOpen}
        bg="brand.600"
        color="white"
        _hover={{ bg: "brand.500" }}
        alignSelf="flex-start"
        px="5"
      >
        + Agregar
      </Button>
    );
  }

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
    <form onSubmit={handleSubmit}>
      <Flex justify="space-between" align="center" mb="4">
        <Text fontSize="lg" fontWeight="semibold" color="fg.heading">
          Nuevo Snapshot de Patrimonio
        </Text>
        <Button
          size="sm"
          variant="ghost"
          color="fg.body"
          onClick={() => setIsOpen(false)}
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
              defaultValue={new Date().toISOString().split("T")[0]}
              bg="bg.input"
              border="1px solid"
              borderColor="border.input"
              color="fg.heading"
            />
          </Box>
          <Box flex="1" minW="200px">
            <Text fontSize="sm" color="fg.body" mb="1">Total en ARS</Text>
            <Input
              name="total_ars"
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
        </Flex>

        <Box>
          <Text fontSize="sm" color="fg.body" mb="1">
            Notas (opcional){" "}
            {ratesLoading && (
              <Text as="span" fontSize="xs" color="fg.muted">cargando cotizaciones...</Text>
            )}
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
            {platforms.map((platform) => {
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
          Guardar Snapshot
        </Button>
      </VStack>
    </form>
    </Box>
  );
}
