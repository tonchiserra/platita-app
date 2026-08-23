"use client";

import { useState } from "react";
import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/shared/Select";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { Platform } from "@/types/database";

interface TradeFormProps {
  platforms: Platform[];
}

type Result = "win" | "loss";

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * The result is chosen, never typed.
 *
 * A forgotten minus sign is the one mistake in this whole feature that silently
 * invents income, so the amount field is always positive and the sign is
 * composed from this toggle on submit. The strip underneath says what the row
 * will do before it exists, which is the only moment where saying it helps.
 */
function ResultToggle({ value, onChange }: { value: Result; onChange: (v: Result) => void }) {
  const options: { id: Result; label: string; token: string; path: string }[] = [
    { id: "win", label: "Ganancia", token: "trend.up", path: "M12 19V5|m5 12 7-7 7 7" },
    { id: "loss", label: "Pérdida", token: "trend.down", path: "M12 5v14|m19 12-7 7-7-7" },
  ];

  return (
    <Flex gap="0.5" bg="bg.sunk" borderRadius="lg" p="0.5" h="10">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Flex
            asChild
            key={option.id}
            flex="1"
            align="center"
            justify="center"
            gap="1.5"
            borderRadius="md"
            cursor="pointer"
            fontSize="sm"
            fontWeight={active ? "semibold" : "normal"}
            color={active ? option.token : "fg.body"}
            bg={active ? "bg.card" : "transparent"}
            border="1px solid"
            borderColor={active ? "border.card" : "transparent"}
            transition="color 0.14s, background 0.14s"
          >
            {/* A real button, and `type="button"`: it lives inside a form, so
                the default `submit` would send the form on every toggle. */}
            <button type="button" aria-pressed={active} onClick={() => onChange(option.id)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {option.path.split("|").map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              {option.label}
            </button>
          </Flex>
        );
      })}
    </Flex>
  );
}

export function TradeForm({ platforms }: TradeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mirrored into state only because the echo strip below reads them live.
  const [result, setResult] = useState<Result>("win");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());

  const magnitude = Math.abs(Number(amount.replace(",", ".")));
  const hasAmount = Number.isFinite(magnitude) && magnitude > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const typed = Math.abs(parseFloat(formData.get("pnl_usd") as string));
    if (!Number.isFinite(typed) || typed === 0) {
      setError("El PnL tiene que ser distinto de cero.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const sign = result === "loss" ? -1 : 1;
    const pct = formData.get("pnl_pct") as string;
    const leverage = formData.get("leverage") as string;

    const { error: insertError } = await supabase.from("trades").insert({
      user_id: user!.id,
      date: formData.get("date") as string,
      asset: (formData.get("asset") as string).trim().toUpperCase(),
      direction: formData.get("direction") as string,
      pnl_usd: sign * typed,
      pnl_pct: pct ? sign * Math.abs(parseFloat(pct)) : null,
      leverage: leverage ? Math.abs(parseFloat(leverage)) : null,
      platform_id: (formData.get("platform_id") as string) || null,
      notes: ((formData.get("notes") as string) || "").trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
    (e.target as HTMLFormElement).reset();
    setResult("win");
    setAmount("");
    setDate(todayIso());
  };

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <form onSubmit={handleSubmit}>
        <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading" mb="4">
          Nueva operación
        </Text>

        <VStack gap="4" align="stretch">
          <Flex gap="4" flexWrap="wrap">
            <Box flex="1" minW="140px">
              <Text fontSize="sm" color="fg.body" mb="1">Moneda</Text>
              <Input
                name="asset"
                placeholder="BTC, ETH, SOL..."
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
              <Select name="direction" required defaultValue="long">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </Select>
            </Box>
            <Box flex="1" minW="140px">
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
          </Flex>

          <Flex gap="4" flexWrap="wrap" align="flex-end">
            <Box flex="1.2" minW="190px">
              <Text fontSize="sm" color="fg.body" mb="1">Resultado</Text>
              <ResultToggle value={result} onChange={setResult} />
            </Box>
            <Box flex="1" minW="130px">
              <Text fontSize="sm" color="fg.body" mb="1">PnL (USD)</Text>
              <Input
                name="pnl_usd"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                bg="bg.input"
                border="1px solid"
                borderColor="border.input"
                color={result === "loss" ? "trend.down" : "trend.up"}
                fontWeight="medium"
                _placeholder={{ color: "fg.muted", fontWeight: "normal" }}
              />
            </Box>
            <Box flex="1" minW="120px">
              <Text fontSize="sm" color="fg.body" mb="1">PnL (%)</Text>
              <Input
                name="pnl_pct"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                bg="bg.input"
                border="1px solid"
                borderColor="border.input"
                color={result === "loss" ? "trend.down" : "trend.up"}
                fontWeight="medium"
                _placeholder={{ color: "fg.muted", fontWeight: "normal" }}
              />
            </Box>
            <Box flex="1" minW="120px">
              <Text fontSize="sm" color="fg.body" mb="1">Apalancamiento</Text>
              <Input
                name="leverage"
                type="number"
                step="any"
                min="0"
                placeholder="10"
                bg="bg.input"
                border="1px solid"
                borderColor="border.input"
                color="fg.heading"
                _placeholder={{ color: "fg.muted" }}
              />
            </Box>
          </Flex>

          <Flex gap="4" flexWrap="wrap">
            <Box flex="2" minW="240px">
              <Text fontSize="sm" color="fg.body" mb="1">Nota (opcional)</Text>
              <Input
                name="notes"
                placeholder="Ej: breakout post-FOMC"
                bg="bg.input"
                border="1px solid"
                borderColor="border.input"
                color="fg.heading"
                _placeholder={{ color: "fg.muted" }}
              />
            </Box>
            <Box flex="1" minW="200px">
              <Text fontSize="sm" color="fg.body" mb="1">Plataforma (opcional)</Text>
              <Select name="platform_id">
                <option value="">Sin plataforma</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Box>
          </Flex>

          <Flex
            gap="2.5"
            align="flex-start"
            bg="bg.sunk"
            borderRadius="lg"
            px="3.5"
            py="3"
          >
            <Box color={result === "loss" ? "trend.down" : "trend.up"} flexShrink={0} mt="0.5">
              {result === "loss" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 17h.01" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </Box>
            <Text fontSize="xs" color="fg.body" lineHeight="1.6">
              {result === "loss" ? (
                <>
                  <Text as="span" color="fg.heading" fontWeight="medium">
                    No se carga como gasto.
                  </Text>{" "}
                  Baja tu patrimonio estimado
                  {hasAmount && (
                    <>
                      {" en "}
                      <Text as="span" fontFamily="mono" color="trend.down" fontWeight="medium" data-num>
                        {formatCurrency(magnitude, "USD")}
                      </Text>
                    </>
                  )}
                  {" "}y no toca el resumen del mes.
                </>
              ) : (
                <>
                  Se va a contar como ingreso
                  {hasAmount && (
                    <>
                      {" de "}
                      <Text as="span" fontFamily="mono" color="trend.up" fontWeight="medium" data-num>
                        {formatCurrency(magnitude, "USD")}
                      </Text>
                    </>
                  )}
                  {" en «Investment Returns»"}
                  {date && `, con fecha ${formatDate(date)}`}
                  . No hace falta cargarlo a mano en Ingresos.
                </>
              )}
            </Text>
          </Flex>

          {error && (
            <Text fontSize="sm" color="trend.down">
              {error}
            </Text>
          )}

          <Button
            type="submit"
            bg="brand.600"
            color="white"
            _hover={{ bg: "brand.500" }}
            loading={loading}
            alignSelf={{ base: "stretch", md: "flex-end" }}
            px="5"
          >
            Agregar operación
          </Button>
        </VStack>
      </form>
    </Box>
  );
}
