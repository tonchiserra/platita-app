import { VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/server";
import { PlatformManager } from "@/components/settings/PlatformManager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
