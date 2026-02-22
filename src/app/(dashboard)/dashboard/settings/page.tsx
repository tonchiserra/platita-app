import { VStack, Heading } from "@chakra-ui/react";
import { createClient, getUser } from "@/lib/supabase/server";
import { PlatformManager } from "@/components/settings/PlatformManager";

export default async function SettingsPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);

  const { data: platforms } = await supabase
    .from("platforms")
    .select("*")
    .eq("user_id", user!.id)
    .order("name");

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Ajustes
      </Heading>
      <PlatformManager platforms={platforms ?? []} />
    </VStack>
  );
}
