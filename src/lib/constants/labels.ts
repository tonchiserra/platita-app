import type { AssetType } from "./currencies";

/**
 * Spanish display names for the built-in values the database stores in
 * English. The stored strings never change — renaming them would rewrite
 * history — so translation happens only at render time. A user's own
 * categories show as typed.
 */

export const SOURCE_LABELS: Record<string, string> = {
  Salary: "Sueldo",
  Freelance: "Freelance",
  "Investment Returns": "Rendimientos",
  Gifts: "Regalos",
  Bonus: "Bono",
  Refund: "Reintegro",
  Sale: "Venta",
  Rental: "Alquiler",
  Other: "Otro",
};

export const CATEGORY_LABELS: Record<string, string> = {
  Shopping: "Compras",
  Entertainment: "Entretenimiento",
  "Bills & Utilities": "Servicios",
  Education: "Educación",
  Travel: "Viajes",
  Food: "Comida",
  "Health & Wellness": "Salud",
  Supermarket: "Supermercado",
  Transport: "Transporte",
  Home: "Casa",
  Friends: "Amigos",
  Pets: "Mascotas",
  Gifts: "Regalos",
  "Personal Care": "Cuidado personal",
  Subscriptions: "Suscripciones",
  Savings: "Ahorro",
  Other: "Otros",
};

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;
export const categoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  crypto: "Cripto",
  cedear: "CEDEAR",
  stock: "Acción",
  bond: "Bono / ON",
  other: "Otro",
};

export const assetTypeLabel = (t: string) => ASSET_TYPE_LABELS[t as AssetType] ?? t;
