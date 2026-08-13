import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    body: {
      bg: "bg.page",
      color: "fg.heading",
      fontFamily: "body",
    },
    "input, select, textarea": {
      px: "3",
      py: "2",
      fontFamily: "body",
      transition: "border-color 0.14s, box-shadow 0.14s",
      "&:hover:not(:disabled)": {
        borderColor: "border.strong",
      },
      "&:focus-visible": {
        borderColor: "cur.ars",
        outline: "none",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--chakra-colors-cur-ars) 22%, transparent)",
      },
    },
    // Fields that take money or dates are read as figures, so they get the mono
    // face and tabular digits.
    'input[type="number"], input[type="date"]': {
      fontFamily: "mono",
      fontVariantNumeric: "tabular-nums",
    },
    button: {
      px: "4",
      py: "2",
      fontFamily: "body",
    },
    // A visible focus ring everywhere, in the base currency's hue.
    "*:focus-visible": {
      outline: "2px solid",
      outlineColor: "cur.ars",
      outlineOffset: "2px",
    },
  },
  theme: {
    tokens: {
      fonts: {
        // Omnibus-Type (Buenos Aires) — an Argentine app set in Argentine type.
        heading: { value: "var(--font-display), system-ui, sans-serif" },
        body: { value: "var(--font-ui), system-ui, sans-serif" },
        mono: { value: "var(--font-mono), ui-monospace, monospace" },
      },
      colors: {
        brand: {
          50: { value: "#eef4fa" },
          100: { value: "#d7e6f4" },
          200: { value: "#b3d0ea" },
          300: { value: "#86b4dc" },
          400: { value: "#5c9cd1" },
          500: { value: "#3a86c8" },
          600: { value: "#2c6ba5" },
          700: { value: "#245785" },
          800: { value: "#1e486d" },
          900: { value: "#1a3c5a" },
          950: { value: "#10253a" },
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
        // Ground: banknote stock in light, intaglio ink in dark — both carry a
        // faint green cast so the neutrals read as chosen, not inherited grey.
        bg: {
          page: { value: { base: "#eff1ec", _dark: "#0d1211" } },
          card: { value: { base: "#fbfcf8", _dark: "#151a18" } },
          sunk: { value: { base: "#e7eae2", _dark: "#0a0e0d" } },
          input: { value: { base: "#ffffff", _dark: "#1b2220" } },
          hover: { value: { base: "#e7eae2", _dark: "#1f2724" } },
        },
        border: {
          card: { value: { base: "#dde1d8", _dark: "#242b28" } },
          input: { value: { base: "#c9cfc2", _dark: "#333c38" } },
          strong: { value: { base: "#c3c9bc", _dark: "#333c38" } },
        },
        fg: {
          heading: { value: { base: "#14181a", _dark: "#e8ede6" } },
          body: { value: { base: "#5a625e", _dark: "#9ba49e" } },
          muted: { value: { base: "#8d958f", _dark: "#6b746f" } },
        },
        // Direction of travel. Kept clear of the currency hues below so a
        // gain never reads as a currency and vice versa.
        trend: {
          up: { value: { base: "#2e8b57", _dark: "#4fb37b" } },
          down: { value: { base: "#c4453a", _dark: "#e06a5e" } },
        },
        // Denominational palette: colour encodes the currency, not decoration.
        cur: {
          ars: { value: { base: "#3a86c8", _dark: "#5aa3e0" } },
          usd: { value: { base: "#16706c", _dark: "#3ea6a0" } },
          eur: { value: { base: "#8b4a7f", _dark: "#c07bb4" } },
          btc: { value: { base: "#d18c2e", _dark: "#e5a64b" } },
          eth: { value: { base: "#7b6fd4", _dark: "#9b91e8" } },
        },
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "#ffffff" },
          fg: { value: { base: "{colors.brand.600}", _dark: "{colors.brand.300}" } },
          muted: { value: { base: "{colors.brand.100}", _dark: "{colors.brand.900}" } },
          subtle: { value: { base: "{colors.brand.50}", _dark: "{colors.brand.950}" } },
          emphasized: { value: "{colors.brand.600}" },
          focusRing: { value: "{colors.brand.500}" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
