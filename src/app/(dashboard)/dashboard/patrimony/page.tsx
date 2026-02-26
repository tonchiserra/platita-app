import dynamic from "next/dynamic";
import { VStack, Heading } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { SnapshotForm } from "@/components/patrimony/SnapshotForm";
import { SnapshotList } from "@/components/patrimony/SnapshotList";
import { LazySection } from "@/components/shared/LazySection";
import { getDolarBlue, getEuroBlue } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";

const PatrimonyChart = dynamic(() =>
  import("@/components/dashboard/PatrimonyChart").then((m) => m.PatrimonyChart)
);
const PatrimonyBreakdownChart = dynamic(() =>
  import("@/components/patrimony/PatrimonyBreakdownChart").then((m) => m.PatrimonyBreakdownChart)
);

export default async function PatrimonyPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: snapshots }, { data: latestWithItems }, dolarBlue, euroBlue, cryptoPrices] =
    await Promise.all([
      supabase
        .from("platforms")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("patrimony_snapshots")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false }),
      supabase
        .from("patrimony_snapshots")
        .select("id, total_ars, patrimony_snapshot_items(platform_id, currency, amount)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getDolarBlue(),
      getEuroBlue(),
      getCryptoPrices(),
    ]);

  const chartData = [...(snapshots ?? [])].reverse().map((s) => ({
    date: s.date,
    total_ars: Number(s.total_ars),
  }));

  // Build patrimony breakdown by platform
  const platformMap = Object.fromEntries((platforms ?? []).map((p) => [p.id, p.name]));
  const usdRate = dolarBlue?.venta ?? 0;
  const eurRate = euroBlue?.venta ?? 0;
  const btcUsd = cryptoPrices?.bitcoin?.usd ?? 0;
  const ethUsd = cryptoPrices?.ethereum?.usd ?? 0;

  const latestItems = latestWithItems?.patrimony_snapshot_items ?? [];
  const platformTotals = new Map<string, number>();

  for (const item of latestItems) {
    const amount = Number((item as any).amount);
    const currency = (item as any).currency as string;
    const platformId = (item as any).platform_id as string;
    let arsValue = 0;
    switch (currency) {
      case "ARS": arsValue = amount; break;
      case "USD": arsValue = amount * usdRate; break;
      case "EUR": arsValue = amount * eurRate; break;
      case "BTC": arsValue = amount * btcUsd * usdRate; break;
      case "ETH": arsValue = amount * ethUsd * usdRate; break;
      default: arsValue = amount;
    }
    platformTotals.set(platformId, (platformTotals.get(platformId) ?? 0) + arsValue);
  }

  const totalArs = [...platformTotals.values()].reduce((s, v) => s + v, 0);
  const breakdownData = [...platformTotals.entries()]
    .map(([id, valueArs]) => ({
      platform: platformMap[id] || "Desconocida",
      valueArs,
      percentage: totalArs > 0 ? (valueArs / totalArs) * 100 : 0,
    }))
    .sort((a, b) => b.valueArs - a.valueArs);

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Patrimonio
      </Heading>
      <SnapshotForm platforms={platforms ?? []} />
      <LazySection minHeight="300px">
        <PatrimonyChart data={chartData} />
      </LazySection>
      {breakdownData.length > 0 && (
        <LazySection minHeight="300px">
          <PatrimonyBreakdownChart data={breakdownData} totalArs={totalArs} />
        </LazySection>
      )}
      <LazySection minHeight="200px">
        <SnapshotList snapshots={snapshots ?? []} platforms={platforms ?? []} />
      </LazySection>
    </VStack>
  );
}
