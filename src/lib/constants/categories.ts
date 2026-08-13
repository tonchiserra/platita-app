export const EXPENSE_CATEGORIES = [
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Education",
  "Travel",
  "Food",
  "Health & Wellness",
  "Supermarket",
  "Transport",
  "Home",
  "Friends",
  "Pets",
  "Gifts",
  "Personal Care",
  "Subscriptions",
  "Savings",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Charges that land once a month and don't recur within it — rent, utilities,
 * subscriptions. Projecting month-end spend by scaling the month-to-date total
 * would multiply these as if they repeated daily, so they're held flat instead.
 * Add a category here if its spend is monthly-fixed rather than day-to-day.
 */
export const FIXED_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>([
  "Home",
  "Subscriptions",
]);

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Shopping: "🛍️",
  Entertainment: "🎬",
  "Bills & Utilities": "💡",
  Education: "📚",
  Travel: "✈️",
  Food: "🍽️",
  "Health & Wellness": "💊",
  Supermarket: "🛒",
  Transport: "🚗",
  Home: "🏠",
  Friends: "👥",
  Pets: "🐾",
  Gifts: "🎁",
  "Personal Care": "💇",
  Subscriptions: "📱",
  Savings: "💰",
  Other: "📌",
};
