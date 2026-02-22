import { Box, Flex, Text, Link } from "@chakra-ui/react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { getDolarBlue } from "@/lib/api/exchange-rates";
import { getCryptoPrices } from "@/lib/api/crypto-prices";
import { formatCurrency } from "@/lib/utils/format";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, dolarBlue, cryptoPrices] = await Promise.all([
    getUser(),
    getDolarBlue(),
    getCryptoPrices(),
  ]);

  if (!user) {
    redirect("/login");
  }

  const sidebarRates: { label: string; value: string }[] = [];
  if (dolarBlue) {
    sidebarRates.push({ label: "USD Blue", value: formatCurrency(dolarBlue.venta) });
  }
  if (cryptoPrices?.bitcoin) {
    sidebarRates.push({ label: "BTC", value: formatCurrency(cryptoPrices.bitcoin.usd, "USD") });
  }
  if (cryptoPrices?.ethereum) {
    sidebarRates.push({ label: "ETH", value: formatCurrency(cryptoPrices.ethereum.usd, "USD") });
  }

  return (
    <Flex minH="100vh" bg="bg.page">
      <Sidebar rates={sidebarRates} />
      <Box ml={{ base: "0", md: "240px" }} flex="1">
        <TopBar userEmail={user.email} />
        <Box as="main" p={{ base: "4", md: "6" }} pb={{ base: "24", md: "6" }}>
          {children}
        </Box>
        <Box as="footer" py="6" px="6" pb={{ base: "24", md: "6" }} textAlign="center">
          <Text fontSize="xs" color="fg.muted">
            &copy; 2026 Built with 🤍 by{" "}
            <Link href="https://gserra.netlify.app" target="_blank" color="fg.body" _hover={{ color: "fg.heading" }}>
              Gonzalo Serra
            </Link>
            .
          </Text>
        </Box>
      </Box>
      <BottomNav />
    </Flex>
  );
}
