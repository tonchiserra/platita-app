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

/**
 * Income that is a return on money you already had, rather than new money
 * arriving from outside your patrimony.
 *
 * It counts as income everywhere in the app — it is income. But the patrimony
 * alternatives chart leaves it out: those lines answer "what if this money had
 * just sat there", so crediting them with a return would hand the do-nothing
 * scenario a gain that only existed because you did something.
 */
export const RETURN_SOURCES: ReadonlySet<string> = new Set<IncomeSource>([
  "Investment Returns",
]);
