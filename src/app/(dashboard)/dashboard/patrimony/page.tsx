import dynamic from "next/dynamic";
import { createClient, getUser } from "@/lib/supabase/server";
import { LazySection } from "@/components/shared/LazySection";
import { getDolarBlue, getEuroBlue } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { convertToArs } from "@/lib/utils/currency-conversion";
import { PatrimonyPageClient } from "@/components/patrimony/PatrimonyPageClient";
import type { ExchangeRates, PatrimonySnapshotFull } from "@/types/database";

const PatrimonyChart = dynamic(() =>
  import("@/components/dashboard/PatrimonyChart").then((m) => m.PatrimonyChart)
);
const PatrimonyBreakdownChart = dynamic(() =>
  import("@/components/patrimony/PatrimonyBreakdownChart").then((m) => m.PatrimonyBreakdownChart)
);

export default async function PatrimonyPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: rawSnapshots }, dolarBlue, euroBlue, cryptoPrices] =
    await Promise.all([
      supabase
        .from("platforms")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("patrimony_snapshots")
        .select("*, patrimony_snapshot_items(id, snapshot_id, platform_id, currency, amount)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false }),
      getDolarBlue(),
      getEuroBlue(),
      getCryptoPrices(),
    ]);

  const exchangeRates: ExchangeRates = {
    usdRate: dolarBlue?.venta ?? 0,
    eurRate: euroBlue?.venta ?? 0,
    btcUsd: cryptoPrices?.bitcoin?.usd ?? 0,
    ethUsd: cryptoPrices?.ethereum?.usd ?? 0,
  };

  const platformMap = Object.fromEntries((platforms ?? []).map((p) => [p.id, p.name]));

  // Map raw snapshots to PatrimonySnapshotFull with platform names
  interface RawSnapshot {
    id: string;
    user_id: string;
    date: string;
    total_ars: number;
    notes: string | null;
    created_at: string;
    patrimony_snapshot_items: {
      id: string;
      snapshot_id: string;
      platform_id: string;
      currency: string;
      amount: number;
    }[];
  }

  const snapshotsWithItems: PatrimonySnapshotFull[] = ((rawSnapshots ?? []) as RawSnapshot[]).map((s) => ({
    id: s.id,
    user_id: s.user_id,
    date: s.date,
    total_ars: Number(s.total_ars),
    notes: s.notes,
    created_at: s.created_at,
    items: (s.patrimony_snapshot_items ?? []).map((item) => ({
      id: item.id,
      snapshot_id: item.snapshot_id,
      platform_id: item.platform_id,
      currency: item.currency,
      amount: Number(item.amount),
      platform_name: platformMap[item.platform_id] || "Desconocida",
    })),
  }));

  // Chart data (ascending for time series)
  const chartData = [...snapshotsWithItems].reverse().map((s) => ({
    date: s.date,
    total_ars: s.total_ars,
  }));

  // Breakdown data from latest snapshot
  const latestItems = snapshotsWithItems[0]?.items ?? [];
  const platformTotals = new Map<string, number>();

  for (const item of latestItems) {
    const arsValue = convertToArs(item.amount, item.currency, exchangeRates);
    platformTotals.set(
      item.platform_id,
      (platformTotals.get(item.platform_id) ?? 0) + arsValue
    );
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
    <PatrimonyPageClient
      snapshots={snapshotsWithItems}
      platforms={platforms ?? []}
      exchangeRates={exchangeRates}
    >
      <LazySection minHeight="300px">
        <PatrimonyChart data={chartData} />
      </LazySection>
      {breakdownData.length > 0 && (
        <LazySection minHeight="300px">
          <PatrimonyBreakdownChart data={breakdownData} totalArs={totalArs} />
        </LazySection>
      )}
    </PatrimonyPageClient>
  );
}
