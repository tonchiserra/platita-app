import { InvestmentTabs } from "@/components/investments/PortfolioClient";
import s from "@/components/investments/investments.module.css";

/** Two routes, not two states: Trading never pays for the price lookups, Cartera never reads the trade book. */
export default function InvestmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className={s.top}>
        <h1 className="h1">Inversiones</h1>
        <InvestmentTabs />
      </div>
      {children}
    </>
  );
}
