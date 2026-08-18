import { VStack, Heading } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { PlatformManager } from "@/components/settings/PlatformManager";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { DataTransfer } from "@/components/settings/DataTransfer";

export default async function SettingsPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const [{ data: platforms }, { data: categories }] = await Promise.all([
    supabase.from("platforms").select("*").eq("user_id", user!.id).order("name"),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("user_id", user!.id)
      .order("sort_order"),
  ]);

  return (
    <VStack gap="8" align="stretch">
      <Heading size="lg" color="fg.heading">
        Ajustes
      </Heading>
      <PlatformManager platforms={platforms ?? []} />
      <CategoryManager categories={categories ?? []} />
      <DataTransfer />
    </VStack>
  );
}
