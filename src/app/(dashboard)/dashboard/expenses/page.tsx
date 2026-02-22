import { VStack, Heading } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseList } from "@/components/expenses/ExpenseList";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, platform:platforms(*)")
    .eq("user_id", user!.id)
    .order("date", { ascending: false });

  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Gastos
      </Heading>
      <ExpenseForm />
      <ExpenseList expenses={expenses ?? []} />
    </VStack>
  );
}
