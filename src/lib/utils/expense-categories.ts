import {
  EXPENSE_CATEGORIES,
  CATEGORY_ICONS,
  FIXED_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/constants/categories";
import type { ExpenseCategoryRow } from "@/types/database";

/** What the pickers and charts consume, whichever source it came from. */
export interface CategoryOption {
  name: string;
  icon: string;
  isFixed: boolean;
}

export const DEFAULT_CATEGORY_OPTIONS: CategoryOption[] = EXPENSE_CATEGORIES.map((name) => ({
  name,
  icon: CATEGORY_ICONS[name as ExpenseCategory] ?? "📌",
  isFixed: FIXED_CATEGORIES.has(name),
}));

/**
 * Users who have never customised their list have no rows, so the built-in set
 * stands in. That keeps every read path working before the user opts in — and
 * before the categories migration has been applied.
 */
export function resolveCategories(rows: ExpenseCategoryRow[] | null): CategoryOption[] {
  if (!rows || rows.length === 0) return DEFAULT_CATEGORY_OPTIONS;
  return rows.map((r) => ({ name: r.name, icon: r.icon, isFixed: r.is_fixed }));
}

export function iconMap(options: CategoryOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.name, o.icon]));
}

export function fixedCategoryNames(options: CategoryOption[]): Set<string> {
  return new Set(options.filter((o) => o.isFixed).map((o) => o.name));
}
