"use client";

import { useEffect, useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useMoneyVisibility } from "@/lib/context/money-visibility";

/**
 * What used to live in the top bar as bare icons: the account's email, the two
 * display toggles and signing out.
 *
 * They read as labelled rows here rather than icons. In a bar an eye glyph is
 * about all that fits; on a settings page there is room to say what it does and
 * what state it is in, which is the point of moving them.
 */
export function AccountSettings({ email }: { email?: string }) {
  const router = useRouter();
  const { showMoney, toggleMoney } = useMoneyVisibility();
  const { resolvedTheme, setTheme } = useTheme();

  // The resolved theme is unknown until after hydration. The row still renders
  // so the card does not change height; only the button holds its place.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const rowButton = {
    size: "xs" as const,
    variant: "ghost" as const,
    color: "fg.body",
    borderRadius: "l2",
    flexShrink: 0,
    _hover: { color: "fg.heading", bg: "bg.sunk" },
  };

  return (
    <Box bg="bg.card" borderRadius="xl" border="1px solid" borderColor="border.card" p="6">
      <Text fontFamily="heading" fontSize="md" fontWeight="semibold" color="fg.heading" mb="1">
        Cuenta
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="4">
        Tu sesión y cómo se ve la app
      </Text>

      <Box>
        <Row label="Sesión" hint="La cuenta con la que entraste">
          <Text fontFamily="mono" fontSize="xs" color="fg.body" truncate>
            {email ?? "—"}
          </Text>
        </Row>

        <Row
          label="Montos"
          hint={
            showMoney
              ? "Se muestran los importes en toda la app"
              : "Los importes están tapados en toda la app"
          }
        >
          <Button {...rowButton} onClick={toggleMoney}>
            {showMoney ? "Ocultar montos" : "Mostrar montos"}
          </Button>
        </Row>

        <Row
          label="Tema"
          hint={
            mounted
              ? resolvedTheme === "dark"
                ? "Estás usando el modo oscuro"
                : "Estás usando el modo claro"
              : " "
          }
        >
          <Button
            {...rowButton}
            visibility={mounted ? "visible" : "hidden"}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
          </Button>
        </Row>

        <Row label="Salir" hint="Cerrá la sesión en este dispositivo" last>
          <Button
            {...rowButton}
            _hover={{ color: "trend.down", bg: "bg.sunk" }}
            loading={signingOut}
            onClick={handleSignOut}
          >
            Cerrar sesión
          </Button>
        </Row>
      </Box>
    </Box>
  );
}

function Row({
  label,
  hint,
  children,
  last = false,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="4"
      py="3"
      borderBottom={last ? "none" : "1px solid"}
      borderColor="border.card"
    >
      <Box minW="0">
        <Text fontSize="sm" fontWeight="medium" color="fg.heading">
          {label}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {hint}
        </Text>
      </Box>
      {children}
    </Flex>
  );
}
