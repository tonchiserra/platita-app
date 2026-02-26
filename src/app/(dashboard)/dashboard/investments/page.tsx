import dynamic from "next/dynamic";
import { VStack, Heading } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { InvestmentList } from "@/components/investments/InvestmentList";
import { LazySection } from "@/components/shared/LazySection";
import { getCryptoPriceMap } from "@/lib/api/crypto-prices";
import { getDolarBlue } from "@/lib/api/exchange-rates";

const InvestmentChart = dynamic(() =>
  import("@/components/investments/InvestmentChart").then((m) => m.InvestmentChart)
);

export default async function InvestmentsPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: investments }, dolarBlue] =
    await Promise.all([
      supabase
        .from("platforms")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("investments")
        .select("*, platform:platforms(*)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(50),
      getDolarBlue(),
    ]);

  // Get unique crypto asset names from user investments
  const cryptoAssets = [
    ...new Set(
      (investments ?? [])
        .filter((inv) => inv.asset_type === "crypto")
        .map((inv) => inv.asset as string)
    ),
  ];

  // Fetch prices dynamically for whatever the user has
  const priceMap = await getCryptoPriceMap(cryptoAssets);

  // Group investments by asset
  const byAsset: Record<string, { invested: number; units: number }> = {};
  for (const inv of investments ?? []) {
    const asset = inv.asset;
    if (!byAsset[asset]) byAsset[asset] = { invested: 0, units: 0 };

    let investedUsd = Number(inv.total_amount);
    if (inv.currency === "ARS" && dolarBlue) {
      investedUsd = investedUsd / dolarBlue.venta;
    }

    byAsset[asset].invested += investedUsd;
    byAsset[asset].units += Number(inv.units);
  }

  const chartData = Object.entries(byAsset).map(([asset, data]) => ({
    asset,
    invested: data.invested,
    currentValue:
      priceMap[asset] !== undefined ? data.units * priceMap[asset] : null,
  }));

  const assetsWithoutPrice = chartData
    .filter((d) => d.currentValue === null)
    .map((d) => d.asset);

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Inversiones
      </Heading>
      <InvestmentForm platforms={platforms ?? []} />
      {(investments ?? []).length > 0 && (
        <LazySection minHeight="300px">
          <InvestmentChart data={chartData} assetsWithoutPrice={assetsWithoutPrice} />
        </LazySection>
      )}
      <LazySection minHeight="200px">
        <InvestmentList investments={investments ?? []} />
      </LazySection>
    </VStack>
  );
}
