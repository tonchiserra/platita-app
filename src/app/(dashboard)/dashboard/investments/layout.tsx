import { VStack, Heading } from "@chakra-ui/react";
import { InvestmentTabs } from "@/components/investments/InvestmentTabs";

/**
 * The heading and the tab bar live here so both halves share them and neither
 * re-renders the chrome. Each page below fetches only its own data.
 */
export default function InvestmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <VStack gap="6" align="stretch">
      <Heading size="lg" color="fg.heading">
        Inversiones
      </Heading>
      <InvestmentTabs />
      {children}
    </VStack>
  );
}
