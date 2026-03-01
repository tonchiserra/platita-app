import type { Currency } from "@/lib/constants/currencies";
import { CURRENCY_SYMBOLS } from "@/lib/constants/currencies";

export function formatCurrency(
  amount: number,
  currency: Currency = "ARS"
): string {
  const symbol = CURRENCY_SYMBOLS[currency];

  if (currency === "BTC" || currency === "ETH") {
    return `${symbol} ${amount.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })}`;
  }

  return `${symbol} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: string | Date): string {
  let d: Date;
  if (typeof date === "string") {
    // Date-only strings (YYYY-MM-DD) are parsed as UTC, causing off-by-one in negative timezones.
    // Append T00:00:00 to force local time parsing.
    d = date.length === 10 ? new Date(date + "T00:00:00") : new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateShort(date: string | Date): string {
  let d: Date;
  if (typeof date === "string") {
    d = date.length === 10 ? new Date(date + "T00:00:00") : new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatMonthYear(date: string | Date): string {
  let d: Date;
  if (typeof date === "string") {
    d = date.length === 10 ? new Date(date + "T00:00:00") : new Date(date);
  } else {
    d = date;
  }
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function parseArgentineNumber(value: string): number {
  // Argentine format: 1.234.567,89
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}
