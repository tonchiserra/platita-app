"use client";

import { Box, Grid, Text } from "@chakra-ui/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useMoneyVisibility } from "@/lib/context/money-visibility";
import { CHART, CURRENCY_COLOR } from "@/lib/constants/colors";

interface AssetData {
  asset: string;
  invested: number;
  currentValue: number | null;
}

interface AssetSummary {
  asset: string;
  invested: number;
  units: number;
  avgPrice: number | null;
  currentValue: number | null;
}

interface InvestmentChartProps {
  data: AssetData[];
  assetSummary: AssetSummary[];
  assetsWithoutPrice?: string[];
}

function CustomTooltip({ active, payload, label, mask }: any) {
  if (!active || !payload?.length) return null;

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.card" borderRadius="lg" p="3">
      <Text fontSize="xs" fontWeight="semibold" color="fg.heading" mb="1">
        {label}
      </Text>
      {payload.map((entry: any) => (
        <Text key={entry.name} fontSize="xs" color="fg.body">
          {entry.name}:{" "}
          {mask(
            "US$ " +
            Number(entry.value).toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          )}
        </Text>
      ))}
    </Box>
  );
}

export function InvestmentChart({
  data,
  assetSummary,
  assetsWithoutPrice = [],
}: InvestmentChartProps) {
  const { mask } = useMoneyVisibility();

  const gridColor = CHART.grid;
  const axisColor = CHART.axis;

  const totalInvested = data.reduce((sum, d) => sum + d.invested, 0);
  const totalCurrent = data.reduce(
    (sum, d) => sum + (d.currentValue ?? 0),
    0
  );
  const hasCurrentValues = data.some((d) => d.currentValue !== null);
  const investedForPriced = assetSummary
    .filter((s) => s.currentValue !== null)
    .reduce((sum, s) => sum + s.invested, 0);
  const diff = hasCurrentValues ? totalCurrent - investedForPriced : null;
  const diffPct =
    diff !== null && investedForPriced > 0
      ? (diff / investedForPriced) * 100
      : null;

  const chartData = data.map((d) => ({
    asset: d.asset,
    Invertido: Number(d.invested.toFixed(2)),
    "Valor actual": d.currentValue !== null ? Number(d.currentValue.toFixed(2)) : undefined,
  }));

  const fmt = (n: number) =>
    "US$ " +
    n.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Box
      bg="bg.card"
      borderRadius="xl"
      border="1px solid"
      borderColor="border.card"
      p="6"
    >
      <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading" mb="4">
        Resumen de inversiones
      </Text>

      <Box mb="5" overflowX="auto">
        <Grid
          templateColumns="auto repeat(4, minmax(max-content, 1fr))"
          columnGap="6"
          rowGap="2"
          minW="fit-content"
        >
          <Box />
          <Text fontSize="xs" color="fg.muted">
            Total invertido
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Valor actual
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Precio prom. compra
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Ganancia / Pérdida
          </Text>

          {assetSummary.map((s) => {
            const assetDiff =
              s.currentValue !== null ? s.currentValue - s.invested : null;
            const assetDiffPct =
              assetDiff !== null && s.invested > 0
                ? (assetDiff / s.invested) * 100
                : null;
            return (
              <Box key={s.asset} display="contents">
                <Text fontSize="sm" color="fg.muted">
                  {s.asset}
                </Text>
                <Text fontSize="sm" color="fg.body" fontFamily="mono" data-num>
                  {mask(fmt(s.invested))}
                </Text>
                <Text fontSize="sm" color="fg.body" fontFamily="mono" data-num>
                  {s.currentValue !== null ? mask(fmt(s.currentValue)) : "—"}
                </Text>
                <Text fontSize="sm" color="fg.body" fontFamily="mono" data-num>
                  {s.avgPrice !== null ? mask(fmt(s.avgPrice)) : "—"}
                </Text>
                <Text
                  fontSize="sm"
                  fontFamily="mono"
                  data-num
                  color={
                    assetDiff === null
                      ? "fg.body"
                      : assetDiff >= 0
                        ? "trend.up"
                        : "trend.down"
                  }
                >
                  {assetDiff !== null && assetDiffPct !== null
                    ? mask(
                        `${assetDiff >= 0 ? "+" : ""}${fmt(assetDiff)} (${assetDiff >= 0 ? "+" : ""}${assetDiffPct.toFixed(2)}%)`
                      )
                    : "—"}
                </Text>
              </Box>
            );
          })}

          <Text fontSize="sm" fontWeight="bold" color="fg.heading">
            Total
          </Text>
          <Text fontSize="sm" fontWeight="bold" color="fg.heading" fontFamily="mono" data-num>
            {mask(fmt(totalInvested))}
          </Text>
          <Text fontSize="sm" fontWeight="bold" color="fg.heading" fontFamily="mono" data-num>
            {hasCurrentValues ? mask(fmt(totalCurrent)) : "—"}
          </Text>
          <Text fontSize="sm" fontWeight="bold" color="fg.heading">
            —
          </Text>
          <Text
            fontSize="sm"
            fontWeight="bold"
            fontFamily="mono"
            data-num
            color={
              diff === null
                ? "fg.heading"
                : diff >= 0
                  ? "trend.up"
                  : "trend.down"
            }
          >
            {diff !== null && diffPct !== null
              ? mask(
                  `${diff >= 0 ? "+" : ""}${fmt(diff)} (${diff >= 0 ? "+" : ""}${diffPct.toFixed(2)}%)`
                )
              : "—"}
          </Text>
        </Grid>
      </Box>

      {chartData.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py="12">
          No hay inversiones todavía
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="asset"
              stroke={axisColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={axisColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) =>
                mask(
                  val >= 1_000_000
                    ? `${(val / 1_000_000).toFixed(1)}M`
                    : val >= 1_000
                      ? `${(val / 1_000).toFixed(0)}K`
                      : val.toString()
                )
              }
            />
            <Tooltip content={<CustomTooltip mask={mask} />} />
            <Legend />
            <Bar dataKey="Invertido" fill={CURRENCY_COLOR.ARS} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Valor actual" fill={CHART.up} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {assetsWithoutPrice.length > 0 && (
        <Text fontSize="xs" color="fg.muted" mt="3">
          El valor actual de {assetsWithoutPrice.join(", ")} no está disponible porque no son criptomonedas con cotización automática.
        </Text>
      )}
    </Box>
  );
}
