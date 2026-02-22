import { VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/server";
import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeList } from "@/components/income/IncomeList";

export default async function IncomePage() {
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

  const { data: incomes } = await supabase
    .from("incomes")
    .select("*, platform:platforms(*)")
    .eq("user_id", user!.id)
    .order("date", { ascending: false });

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Ingresos
      </Heading>
      <IncomeForm platforms={platforms ?? []} />
      <IncomeList incomes={incomes ?? []} />
    </VStack>
  );
}
