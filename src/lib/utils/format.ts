import type { Currency } from "@/lib/constants/currencies";
import { CURRENCY_SYMBOLS } from "@/lib/constants/currencies";

/** `YYYY-MM-DD` → a local Date. A bare `new Date("2026-01-01")` is UTC and lands on the previous day here. */
export function parseLocalDate(date: string): Date {
  return new Date(date.length === 10 ? `${date}T00:00:00` : date);
}

const toDate = (date: string | Date) => (typeof date === "string" ? parseLocalDate(date) : date);

export interface MoneyOptions {
  /** Fraction digits. Defaults: 0 for ARS, 2 for USD/EUR, up to 8 for crypto. */
  decimals?: number;
  /** Abbreviate: 1,2 M · 950 k. For axes and tight labels. */
  compact?: boolean;
  /** Prefix a + on positive values. */
  signed?: boolean;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${formatNumber(abs / 1e9, abs >= 1e10 ? 0 : 1)} B`;
  if (abs >= 1e6) return `${sign}${formatNumber(abs / 1e6, abs >= 1e7 ? 0 : 1)} M`;
  if (abs >= 1e3) return `${sign}${formatNumber(abs / 1e3, abs >= 1e4 ? 0 : 1)} k`;
  return `${sign}${formatNumber(abs, 0)}`;
}

export function formatMoney(amount: number, currency: Currency = "ARS", options: MoneyOptions = {}): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const value = Number.isFinite(amount) ? amount : 0;
  const sign = value < 0 ? "−" : options.signed && value > 0 ? "+" : "";
  const abs = Math.abs(value);

  if (options.compact) return `${sign}${symbol} ${formatCompactNumber(abs)}`;

  if (currency === "BTC" || currency === "ETH") {
    const digits = abs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: options.decimals ?? 8 });
    return `${sign}${symbol} ${digits}`;
  }

  const decimals = options.decimals ?? (currency === "ARS" ? 0 : 2);
  return `${sign}${symbol} ${formatNumber(abs, decimals)}`;
}

/** Kept for the code that predates `formatMoney`: always two decimals. */
export function formatCurrency(amount: number, currency: Currency = "ARS"): string {
  return formatMoney(amount, currency, { decimals: currency === "BTC" || currency === "ETH" ? 8 : 2 });
}

/** `3,25 %`, or `+3,25 %` when signed. The value is already a percentage. */
export function formatPercent(value: number, { signed = true, decimals = 1 } = {}): string {
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return `${sign}${formatNumber(Math.abs(value), decimals)} %`;
}

/** Kept for existing callers: signed, two decimals. */
export function formatPercentage(value: number): string {
  return formatPercent(value, { signed: true, decimals: 2 }).replace(/^(?![−+])/, "+");
}

export function formatDate(date: string | Date): string {
  return toDate(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** `11 ago` — for pointing at a single movement. */
export function formatDayMonth(date: string | Date): string {
  return toDate(date).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
}

/** `jue 11 ago` */
export function formatWeekdayDay(date: string | Date): string {
  return toDate(date)
    .toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })
    .replaceAll(".", "")
    .replace(",", "");
}

export function formatDateShort(date: string | Date): string {
  return toDate(date).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

export function formatMonthYear(date: string | Date): string {
  const label = toDate(date).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** `2026-08` → `Agosto 2026` */
export function formatMonthKey(key: string): string {
  return formatMonthYear(`${key}-01`);
}

/** `2026-08` → `ago` or `ago 26` — axis labels. */
export function formatMonthTick(key: string, withYear = false): string {
  const d = parseLocalDate(`${key}-01`);
  const month = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return withYear ? `${month} ${String(d.getFullYear()).slice(2)}` : month;
}

/** `2026-08` → `agosto` */
export function formatMonthName(key: string): string {
  return parseLocalDate(`${key}-01`).toLocaleDateString("es-AR", { month: "long" });
}

/**
 * Time of day as `05:57 p.m.`. Built by hand rather than via toLocaleTimeString,
 * whose es-AR output inserts a narrow no-break space inside "p. m.".
 */
export function formatTimeOfDay(date: Date): string {
  // In Buenos Aires time: the server runs in UTC.
  const [h, min] = date
    .toLocaleTimeString("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  const hours = h % 24;
  const suffix = hours < 12 ? "a.m." : "p.m.";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(min).padStart(2, "0");
  return `${String(hour12).padStart(2, "0")}:${mm} ${suffix}`;
}

/** Argentine format: 1.234.567,89. Also accepts a plain 1234.56. */
export function parseArgentineNumber(value: string): number {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  return parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
}

/** Today in Buenos Aires as `YYYY-MM-DD`, regardless of the server's zone. */
export function todayKey(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * How long ago a moment was: `recién`, `hace 5 min`, `hace 3 h`, `hace 2 días`,
 * then the day (`11 ago`, in Buenos Aires) past a week.
 */
export function formatAgo(moment: string | Date, now = new Date()): string {
  const date = typeof moment === "string" ? new Date(moment) : moment;
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "hace 1 día" : `hace ${days} días`;
  return `el ${formatDayMonth(todayKey(date))}`;
}

/** Current `YYYY-MM` in Buenos Aires. */
export function currentMonthKey(now = new Date()): string {
  return todayKey(now).slice(0, 7);
}

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Inclusive list of `YYYY-MM` keys from `from` to `to`. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

export function endOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${key}-${String(day).padStart(2, "0")}`;
}
