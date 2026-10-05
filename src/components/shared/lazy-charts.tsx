"use client";

// Every Recharts chart, code-split. `next/dynamic` only splits when it runs in
// a Client Component: called from a Server Component page it still lists the
// chart in the page's client manifest, so Recharts shipped with the first load
// of every page that drew one. Imported from here instead, a chart's chunk is
// fetched when `<LazySection>` first renders it — that is, when it scrolls near.
import dynamic from "next/dynamic";
import { SectionPlaceholder } from "@/components/shared/LazySection";

// Holds the section's space while the chart's chunk downloads.
const loading = () => <SectionPlaceholder />;

export const ExpenseCategoryChart = dynamic(() =>
  import("@/components/expenses/ExpenseCategoryChart").then((m) => m.ExpenseCategoryChart),
  { loading }
);
export const ExpenseTrendChart = dynamic(() =>
  import("@/components/expenses/ExpenseTrendChart").then((m) => m.ExpenseTrendChart),
  { loading }
);
export const IncomeSourceChart = dynamic(() =>
  import("@/components/income/IncomeSourceChart").then((m) => m.IncomeSourceChart),
  { loading }
);
export const IncomeTrendChart = dynamic(() =>
  import("@/components/income/IncomeTrendChart").then((m) => m.IncomeTrendChart),
  { loading }
);
export const CashflowChart = dynamic(() =>
  import("@/components/dashboard/CashflowChart").then((m) => m.CashflowChart),
  { loading }
);
export const PatrimonyChart = dynamic(() =>
  import("@/components/dashboard/PatrimonyChart").then((m) => m.PatrimonyChart),
  { loading }
);
export const PatrimonyBreakdownChart = dynamic(() =>
  import("@/components/patrimony/PatrimonyBreakdownChart").then((m) => m.PatrimonyBreakdownChart),
  { loading }
);
export const AlternativesChart = dynamic(() =>
  import("@/components/patrimony/AlternativesChart").then((m) => m.AlternativesChart),
  { loading }
);
export const InvestmentChart = dynamic(() =>
  import("@/components/investments/InvestmentChart").then((m) => m.InvestmentChart),
  { loading }
);
export const TradePnlChart = dynamic(() =>
  import("@/components/investments/TradePnlChart").then((m) => m.TradePnlChart),
  { loading }
);
