"use client";

import { Box, Flex, Image, Text, VStack } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/constants/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      w="240px"
      minH="100vh"
      bg="bg.card"
      borderRight="1px solid"
      borderColor="border.card"
      py="6"
      px="3"
      position="fixed"
      left="0"
      top="0"
      display={{ base: "none", md: "block" }}
    >
      <Link href="/dashboard">
        <Box px="3" mb="8">
          <Image
            src="/platita-logo.svg"
            alt="Platita"
            h="32px"
            _dark={{ filter: "invert(1) hue-rotate(180deg)" }}
          />
        </Box>
      </Link>

      <VStack gap="1" align="stretch">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <Flex
                align="center"
                gap="3"
                px="3"
                py="2.5"
                borderRadius="lg"
                bg={isActive ? "bg.hover" : "transparent"}
                color={isActive ? "fg.heading" : "fg.body"}
                _hover={{ bg: "bg.hover", color: "fg.heading" }}
                transition="all 0.15s"
                cursor="pointer"
              >
                <Text fontSize="lg">{item.icon}</Text>
                <Text fontSize="sm" fontWeight={isActive ? "semibold" : "normal"}>
                  {item.label}
                </Text>
              </Flex>
            </Link>
          );
        })}
      </VStack>
    </Box>
  );
}
