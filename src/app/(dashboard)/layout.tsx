import { Box, Flex, Text, Link } from "@chakra-ui/react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Flex minH="100vh" bg="bg.page">
      <Sidebar />
      <Box ml={{ base: "0", md: "240px" }} flex="1">
        <TopBar userEmail={user.email} />
        <Box as="main" p={{ base: "4", md: "6" }} pb={{ base: "24", md: "6" }}>
          {children}
        </Box>
        <Box as="footer" py="6" px="6" pb={{ base: "24", md: "6" }} textAlign="center">
          <Text fontSize="xs" color="fg.muted">
            Designed & developed by{" "}
            <Link href="https://gserra.netlify.app" target="_blank" color="fg.body" _hover={{ color: "fg.heading" }}>
              Gonzalo Serra
            </Link>
          </Text>
        </Box>
      </Box>
      <BottomNav />
    </Flex>
  );
}
