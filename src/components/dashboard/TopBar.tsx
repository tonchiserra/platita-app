"use client";

import { Box, Flex, Image, Text, Button } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ColorModeToggle } from "./ColorModeToggle";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

interface TopBarProps {
  userEmail?: string;
}

export function TopBar({ userEmail }: TopBarProps) {
  const router = useRouter();
  const { showMoney, toggleMoney } = useMoneyVisibility();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const iconButton = {
    size: "sm" as const,
    variant: "ghost" as const,
    color: "fg.body",
    px: "2",
    _hover: { color: "fg.heading", bg: "bg.sunk" },
    _focusVisible: { outline: "2px solid", outlineColor: "cur.ars", outlineOffset: "1px" },
  };

  return (
    <Box
      as="header"
      h="14"
      bg="bg.card"
      borderBottom="1px solid"
      borderColor="border.card"
      px={{ base: "4", md: "6" }}
      position="sticky"
      top="0"
      zIndex="10"
    >
      <Flex h="full" align="center" justify="space-between" gap="4">
        <Image
          src="/platita-logo.svg"
          alt="Platita"
          h="30px"
          display={{ base: "block", md: "none" }}
          _dark={{ filter: "invert(1) hue-rotate(180deg)" }}
        />
        <Flex align="center" gap="1" ml="auto">
          {userEmail && (
            <Text
              fontSize="xs"
              color="fg.muted"
              display={{ base: "none", md: "block" }}
              mr="3"
            >
              {userEmail}
            </Text>
          )}
          <Button
            {...iconButton}
            onClick={toggleMoney}
            aria-label={showMoney ? "Ocultar montos" : "Mostrar montos"}
          >
            {showMoney ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                <path d="m2 2 20 20" />
              </svg>
            )}
          </Button>
          <ColorModeToggle />
          <Button {...iconButton} onClick={handleSignOut} aria-label="Salir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
