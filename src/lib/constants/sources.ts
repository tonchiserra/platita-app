export const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Investment Returns",
  "Gifts",
  "Bonus",
  "Refund",
  "Sale",
  "Rental",
  "Other",
] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];
