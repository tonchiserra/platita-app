"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/constants/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      display={{ base: "block", md: "none" }}
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      bg="bg.card"
      borderTop="1px solid"
      borderColor="border.card"
      zIndex="10"
      pb="env(safe-area-inset-bottom)"
    >
      <Flex justify="space-around" align="center" h="16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <Flex
                direction="column"
                align="center"
                gap="1"
                pt="2"
                pb="1.5"
                px="2"
                position="relative"
                color={isActive ? "fg.heading" : "fg.muted"}
                transition="color 0.15s"
                cursor="pointer"
              >
                <Box
                  position="absolute"
                  top="0"
                  left="50%"
                  transform="translateX(-50%)"
                  w="18px"
                  h="2px"
                  borderRadius="0 0 2px 2px"
                  bg={isActive ? "cur.ars" : "transparent"}
                />
                {item.icon}
                <Text
                  fontSize="2xs"
                  fontWeight={isActive ? "semibold" : "normal"}
                >
                  {item.label}
                </Text>
              </Flex>
            </Link>
          );
        })}
      </Flex>
    </Box>
  );
}
