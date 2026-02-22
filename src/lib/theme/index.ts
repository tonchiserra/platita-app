import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    body: {
      bg: "bg.page",
      color: "fg.heading",
    },
    "input, select, textarea": {
      px: "3",
      py: "2",
    },
    button: {
      px: "4",
      py: "2",
    },
  },
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#eef2ff" },
          100: { value: "#e0e7ff" },
          200: { value: "#c7d2fe" },
          300: { value: "#a5b4fc" },
          400: { value: "#818cf8" },
          500: { value: "#6366f1" },
          600: { value: "#4f46e5" },
          700: { value: "#4338ca" },
          800: { value: "#3730a3" },
          900: { value: "#312e81" },
          950: { value: "#1e1b4b" },
        },
      },
    },
    semanticTokens: {
      radii: {
        l1: { value: "{radii.md}" },
        l2: { value: "{radii.lg}" },
        l3: { value: "{radii.xl}" },
      },
      colors: {
        bg: {
          page: { value: { base: "#f9fafb", _dark: "#030712" } },
          card: { value: { base: "#ffffff", _dark: "#111827" } },
          input: { value: { base: "#ffffff", _dark: "#1f2937" } },
          hover: { value: { base: "#f3f4f6", _dark: "#1f2937" } },
        },
        border: {
          card: { value: { base: "#e5e7eb", _dark: "#1f2937" } },
          input: { value: { base: "#d1d5db", _dark: "#374151" } },
        },
        fg: {
          heading: { value: { base: "#111827", _dark: "#f9fafb" } },
          body: { value: { base: "#4b5563", _dark: "#9ca3af" } },
          muted: { value: { base: "#9ca3af", _dark: "#6b7280" } },
        },
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.brand.50}" },
          fg: { value: "{colors.brand.400}" },
          muted: { value: "{colors.brand.900}" },
          subtle: { value: "{colors.brand.800}" },
          emphasized: { value: "{colors.brand.700}" },
          focusRing: { value: "{colors.brand.500}" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
