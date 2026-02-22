"use client";

import { useTheme } from "next-themes";
import { Button } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export function ColorModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      color="fg.body"
      _hover={{ color: "fg.heading", bg: "bg.hover" }}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={resolvedTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </Button>
  );
}
