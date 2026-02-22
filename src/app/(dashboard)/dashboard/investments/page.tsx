import { VStack, Heading } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { InvestmentList } from "@/components/investments/InvestmentList";
import { InvestmentChart } from "@/components/investments/InvestmentChart";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { getDolarBlue } from "@/lib/api/exchange-rates";

export default async function InvestmentsPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: investments }, cryptoPrices, dolarBlue] =
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
      getCryptoPrices(),
      getDolarBlue(),
    ]);

  // Build price map for known assets
  const priceMap: Record<string, number> = {};
  if (cryptoPrices?.bitcoin) priceMap["BTC"] = cryptoPrices.bitcoin.usd;
  if (cryptoPrices?.ethereum) priceMap["ETH"] = cryptoPrices.ethereum.usd;

  // Group investments by asset
  const byAsset: Record<string, { invested: number; units: number }> = {};
  for (const inv of investments ?? []) {
    const asset = inv.asset;
    if (!byAsset[asset]) byAsset[asset] = { invested: 0, units: 0 };

    let investedUsd = Number(inv.total_amount);
    if (inv.currency === "ARS" && dolarBlue) {
      investedUsd = investedUsd / dolarBlue.venta;
    }
    // USD and EUR left as-is (EUR≈USD approximation is acceptable here)

    byAsset[asset].invested += investedUsd;
    byAsset[asset].units += Number(inv.units);
  }

  const chartData = Object.entries(byAsset).map(([asset, data]) => ({
    asset,
    invested: data.invested,
    currentValue:
      priceMap[asset] !== undefined ? data.units * priceMap[asset] : null,
  }));

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Inversiones
      </Heading>
      <InvestmentForm platforms={platforms ?? []} />
      {(investments ?? []).length > 0 && <InvestmentChart data={chartData} />}
      <InvestmentList investments={investments ?? []} />
    </VStack>
  );
}
