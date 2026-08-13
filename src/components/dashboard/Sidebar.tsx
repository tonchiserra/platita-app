"use client";

import { Box, Flex, Image, Text, VStack } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/constants/navigation";

interface SidebarProps {
  rates?: { label: string; value: string; token?: string }[];
}

export function Sidebar({ rates }: SidebarProps) {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      w="248px"
      minH="100vh"
      bg="bg.page"
      borderRight="1px solid"
      borderColor="border.card"
      pt="5"
      pb="5"
      position="fixed"
      left="0"
      top="0"
      display={{ base: "none", md: "flex" }}
      flexDirection="column"
    >
      <Link href="/dashboard">
        <Box px="5" mb="7">
          <Image
            src="/platita-logo.svg"
            alt="Platita"
            h="30px"
            _dark={{ filter: "invert(1) hue-rotate(180deg)" }}
          />
        </Box>
      </Link>

      {/* The marker sits flush to the rail edge — an index, not a row of buttons. */}
      <Flex direction="column">
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
                pl="5"
                pr="4"
                py="2.5"
                position="relative"
                color={isActive ? "fg.heading" : "fg.body"}
                _hover={{ color: "fg.heading", bg: "bg.sunk" }}
                transition="color 0.14s, background 0.14s"
                cursor="pointer"
              >
                <Box
                  position="absolute"
                  left="0"
                  top="0"
                  bottom="0"
                  w="3px"
                  bg={isActive ? "cur.ars" : "transparent"}
                />
                <Box color={isActive ? "cur.ars" : "fg.muted"} display="inline-flex">
                  {item.icon}
                </Box>
                <Text
                  fontSize="sm"
                  fontWeight={isActive ? "semibold" : "normal"}
                  letterSpacing={isActive ? "-0.005em" : undefined}
                >
                  {item.label}
                </Text>
              </Flex>
            </Link>
          );
        })}
      </Flex>

      {rates && rates.length > 0 && (
        <Box mt="auto" px="3" pt="4" borderTop="1px solid" borderColor="border.card">
          <Text
            px="2"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="0.13em"
            textTransform="uppercase"
            color="fg.muted"
            mb="2"
          >
            Cotizaciones
          </Text>
          <VStack gap="0" align="stretch">
            {rates.map((rate) => (
              <Flex
                key={rate.label}
                justify="space-between"
                align="center"
                gap="2"
                px="2"
                py="1"
                borderRadius="sm"
                _hover={{ bg: "bg.sunk" }}
              >
                <Flex align="center" gap="2" minW="0">
                  <Box
                    w="3px"
                    h="12px"
                    borderRadius="1px"
                    bg={rate.token ?? "fg.muted"}
                    flexShrink={0}
                  />
                  <Text fontSize="xs" color="fg.body" truncate>
                    {rate.label}
                  </Text>
                </Flex>
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  fontWeight="medium"
                  color="fg.heading"
                  whiteSpace="nowrap"
                  data-num
                >
                  {rate.value}
                </Text>
              </Flex>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
}
