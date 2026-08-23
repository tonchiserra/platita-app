"use client";

import { Box, Flex } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/investments", label: "Cartera" },
  { href: "/dashboard/investments/trading", label: "Trading" },
] as const;

/**
 * Two routes, not two states.
 *
 * Each half is a Server Component that fetches only what it needs — Trading
 * does not pay for the CoinGecko round-trip, Cartera does not read the trade
 * book — which a client-side toggle would make impossible.
 *
 * A segmented control on `bg.sunk`, matching `BreakdownPanel`'s view toggle.
 * Chakra's `Tabs` is deliberately not used: the app has no other instance of it.
 */
export function InvestmentTabs() {
  const pathname = usePathname();

  return (
    <Flex
      gap="0.5"
      bg="bg.sunk"
      borderRadius="xl"
      p="1"
      alignSelf={{ base: "stretch", md: "flex-start" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Box
            key={tab.href}
            asChild
            flex={{ base: "1", md: "initial" }}
            textAlign="center"
            px="4"
            py="2"
            borderRadius="lg"
            fontSize="sm"
            fontWeight={active ? "semibold" : "normal"}
            color={active ? "fg.heading" : "fg.body"}
            bg={active ? "bg.card" : "transparent"}
            border="1px solid"
            borderColor={active ? "border.card" : "transparent"}
            _hover={active ? undefined : { color: "fg.heading" }}
            transition="color 0.14s, background 0.14s"
          >
            <Link href={tab.href} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          </Box>
        );
      })}
    </Flex>
  );
}
