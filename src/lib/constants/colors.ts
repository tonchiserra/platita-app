import type { Currency } from "./currencies";

/**
 * Single source of colour for every chart.
 *
 * Chakra emits each semantic token as a CSS custom property, so referencing the
 * var (rather than a literal) means Recharts fills follow the colour mode with
 * no `isDark` branching in the components.
 */
export const CHART = {
  grid: "var(--chakra-colors-border-card)",
  axis: "var(--chakra-colors-fg-muted)",
  surface: "var(--chakra-colors-bg-card)",
  up: "var(--chakra-colors-trend-up)",
  down: "var(--chakra-colors-trend-down)",
} as const;

/** Colour encodes the currency — see `cur.*` in the theme. */
export const CURRENCY_COLOR: Record<Currency, string> = {
  ARS: "var(--chakra-colors-cur-ars)",
  USD: "var(--chakra-colors-cur-usd)",
  EUR: "var(--chakra-colors-cur-eur)",
  BTC: "var(--chakra-colors-cur-btc)",
  ETH: "var(--chakra-colors-cur-eth)",
};

/** Chakra token names (for `color=` / `bg=` props rather than SVG fills). */
export const CURRENCY_TOKEN: Record<Currency, string> = {
  ARS: "cur.ars",
  USD: "cur.usd",
  EUR: "cur.eur",
  BTC: "cur.btc",
  ETH: "cur.eth",
};

/**
 * Categories and income sources are open-ended lists — a user can run seventeen
 * of them — so each needs to be told apart at a glance. Hues are ordered to
 * alternate, since rank-adjacent slices sit next to each other in the list and
 * around the pie. Mid-range values so the same set holds on both grounds.
 */
export const CATEGORY_COLORS = [
  "#3a86c8", // celeste
  "#d18c2e", // ámbar
  "#16706c", // verde azulado
  "#c2528a", // magenta
  "#5f8f3e", // musgo
  "#7b6fd4", // periwinkle
  "#c2543f", // ladrillo
  "#2b8fa0", // cian
  "#8b4a7f", // ciruela
  "#e8b34a", // oro
  "#4f8fbf", // azul medio
  "#e0785c", // salmón
  "#9dbd4a", // verde lima
  "#5c6bbf", // índigo
  "#4fb8a5", // aguamarina
  "#a8769e", // malva
  "#7e5a3c", // marrón
  "#6b7a8f", // pizarra
];

/**
 * Platforms are identities, not a ranking — "Galicia" is not more or less than
 * "Lemon", it is a different thing. So they get well-spaced hues rather than a
 * ramp, whose adjacent steps are too close to tell apart. Hue angles avoid
 * ~150° and ~5° so a slice never reads as `trend.up` / `trend.down`.
 */
export const PLATFORM_COLORS = [
  "#3a86c8", // celeste
  "#d18c2e", // ámbar
  "#16706c", // verde azulado
  "#8b4a7f", // ciruela
  "#7b6fd4", // periwinkle
  "#b8703a", // terracota
  "#5f8f3e", // musgo
  "#c2528a", // magenta
  "#2b8fa0", // cian
  "#4a5fa8", // índigo
];

/** Palettes wrap, so a list longer than the palette still gets distinct neighbours. */
export function categoricalColor(palette: string[], index: number): string {
  return palette[index % palette.length];
}
