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
          50: { value: "#f0f5fb" },
          100: { value: "#dce7f4" },
          200: { value: "#bdd1eb" },
          300: { value: "#93b6de" },
          400: { value: "#6397ce" },
          500: { value: "#3d77b8" },
          600: { value: "#275396" },
          700: { value: "#21447a" },
          800: { value: "#1b3a66" },
          900: { value: "#163054" },
          950: { value: "#0e1f37" },
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
