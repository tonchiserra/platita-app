import { VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/server";
import { SnapshotForm } from "@/components/patrimony/SnapshotForm";
import { SnapshotList } from "@/components/patrimony/SnapshotList";
import { PatrimonyChart } from "@/components/dashboard/PatrimonyChart";

export default async function PatrimonyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: platforms } = await supabase
    .from("platforms")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .order("name");

  const { data: snapshots } = await supabase
    .from("patrimony_snapshots")
    .select("*")
    .eq("user_id", user!.id)
    .order("date", { ascending: false });

  const chartData = [...(snapshots ?? [])].reverse().map((s) => ({
    date: s.date,
    total_ars: Number(s.total_ars),
  }));

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Patrimonio
      </Heading>
      <SnapshotForm platforms={platforms ?? []} />
      <PatrimonyChart data={chartData} />
      <SnapshotList snapshots={snapshots ?? []} platforms={platforms ?? []} />
    </VStack>
  );
}
