"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { system } from "@/lib/theme";
import { MoneyVisibilityProvider } from "@/lib/context/money-visibility";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <ChakraProvider value={system}>
        <MoneyVisibilityProvider>
          {children}
        </MoneyVisibilityProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
