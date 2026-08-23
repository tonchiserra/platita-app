import dynamic from "next/dynamic";
import { VStack } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { TradeForm } from "@/components/investments/TradeForm";
import { TradeList } from "@/components/investments/TradeList";
import { TradeStats } from "@/components/investments/TradeStats";
import { LazySection } from "@/components/shared/LazySection";
import { tradePnlByMonth, tradeStats } from "@/lib/utils/trading";
import type { TradeWithPlatform } from "@/types/database";

const TradePnlChart = dynamic(() =>
  import("@/components/investments/TradePnlChart").then((m) => m.TradePnlChart)
);

function formatMonthLabel(key: string) {
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

/**
 * The trading book.
 *
 * Everything here is in USD, like the rest of Inversiones — it is the one
 * section that does not normalise to pesos, and the PnL already arrives in
 * dollars. The profits' effect on income and the losses' effect on the estimated
 * patrimony are computed by the pages that own those figures, not here.
 */
export default async function TradingPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: trades }] = await Promise.all([
    supabase
      .from("platforms")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("trades")
      .select("*, platform:platforms(*)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
  ]);

  // A null here is migration 003 not being applied yet, which reads as an empty
  // book rather than a broken page.
  const book = (trades ?? []) as TradeWithPlatform[];

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long" });

  const monthStats = tradeStats(book, curMonth);
  const allTimeStats = tradeStats(book);

  const byMonth = tradePnlByMonth(book);
  const chartData = byMonth.map((row) => ({
    label: formatMonthLabel(row.month),
    net: row.net,
    wins: row.wins,
    losses: row.losses,
  }));

  return (
    <VStack gap="6" align="stretch">
      <TradeForm platforms={platforms ?? []} />
      {book.length > 0 && (
        <TradeStats month={monthStats} allTime={allTimeStats} monthLabel={monthLabel} />
      )}
      {chartData.length > 1 && (
        <LazySection minHeight="340px">
          <TradePnlChart data={chartData} total={allTimeStats.net} />
        </LazySection>
      )}
      <LazySection minHeight="200px">
        <TradeList trades={book} />
      </LazySection>
    </VStack>
  );
}
