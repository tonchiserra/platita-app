export interface Platform {
  id: string;
  user_id: string;
  name: string;
  type: "bank" | "crypto_exchange" | "investment_broker" | "cash" | "other";
  default_currency: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  platform_id: string | null;
  created_at: string;
}

export interface Income {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  source: string;
  description: string;
  date: string;
  platform_id: string | null;
  created_at: string;
}

export interface PatrimonySnapshot {
  id: string;
  user_id: string;
  date: string;
  total_ars: number;
  notes: string | null;
  created_at: string;
}

export interface PatrimonySnapshotItem {
  id: string;
  snapshot_id: string;
  platform_id: string;
  currency: string;
  amount: number;
}

export interface Investment {
  id: string;
  user_id: string;
  date: string;
  asset: string;
  asset_type: "crypto" | "stock" | "bond" | "cedear" | "other";
  units: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  platform_id: string | null;
  notes: string | null;
  created_at: string;
}

// Joined types for queries
export interface PatrimonySnapshotWithItems extends PatrimonySnapshot {
  items: (PatrimonySnapshotItem & { platform: Platform })[];
}

export interface ExpenseWithPlatform extends Expense {
  platform: Platform | null;
}

export interface IncomeWithPlatform extends Income {
  platform: Platform | null;
}

export interface InvestmentWithPlatform extends Investment {
  platform: Platform | null;
}
