import { ViewTransition } from "react";
import { Delta, LineLabel, Money } from "@/components/ui";
import { CountUp } from "@/components/ui/CountUp";
import { formatDayMonth, formatNumber } from "@/lib/utils/format";
import type { ExchangeRates } from "@/types/database";
import s from "./dashboard.module.css";

export interface HeroProps {
  label: string;
  ars: number | null;
  usd: number | null;
  /** Which currency is the big figure. Investments lead in dollars. */
  lead?: "ARS" | "USD";
  change?: number | null;
  changeLabel?: string;
  /** Which direction of `change` is good news. */
  goodWhen?: "up" | "down";
  meta?: React.ReactNode;
  /** Pages showing the same figure share it, so it morphs between them on navigation. */
  shareName?: string;
  /** A result rather than a balance: green when positive, red when negative, with its sign. */
  bySign?: boolean;
}

/** The one figure the page leads with, with the other currency beside it. */
export function Hero({ label, ars, usd, lead = "ARS", change, changeLabel, goodWhen, meta, shareName, bySign }: HeroProps) {
  const big = lead === "ARS" ? ars : usd;
  const small = lead === "ARS" ? usd : ars;
  const smallCur = lead === "ARS" ? "USD" : "ARS";
  const figureClass = bySign && big ? `${s.heroFigure} ${big < 0 ? s.heroDown : s.heroUp}` : s.heroFigure;
  return (
    <section className={s.hero} aria-label={label}>
      <LineLabel>{label}</LineLabel>
      {shareName ? (
        <ViewTransition name={shareName} share="hero-share">
          <p className={figureClass}>
            <CountUp value={big ?? 0} currency={lead} signed={bySign} />
          </p>
        </ViewTransition>
      ) : (
        <p className={figureClass}>
          <CountUp value={big ?? 0} currency={lead} signed={bySign} />
        </p>
      )}
      <div className={s.heroSub}>
        {small !== null && (
          <span className={`${s.pill} ${s.pillIn}`}>
            <Money value={small} currency={smallCur} decimals={0} />
          </span>
        )}
        {change !== null && change !== undefined && <Delta value={change} suffix={changeLabel} goodWhen={goodWhen} />}
      </div>
      {meta && <p className={s.heroMeta}>{meta}</p>}
    </section>
  );
}

/**
 * How the estimate is built, the way you would add it up by hand: each
 * holding of the last close with the conversion that turns it into pesos,
 * then what came in and went out since.
 */
export function Equation({
  byCurrency,
  fx,
  sinceIncomesArs,
  sinceExpensesArs,
  sinceLossesArs,
  windowLabel,
  totalArs,
}: {
  byCurrency: Record<string, number>;
  fx: ExchangeRates;
  sinceIncomesArs: number;
  sinceExpensesArs: number;
  sinceLossesArs: number;
  windowLabel: string;
  totalArs: number;
}) {
  const terms: { op: string; main: React.ReactNode; chain?: string; ars: number }[] = [];
  const add = (main: React.ReactNode, ars: number, chain?: string, op?: string) =>
    terms.push({ op: op ?? (terms.length ? "+" : ""), main, chain, ars });

  if (byCurrency.ARS) add(<Money value={byCurrency.ARS} currency="ARS" />, byCurrency.ARS, "Pesos");
  if (byCurrency.USD) add(<Money value={byCurrency.USD} currency="USD" />, byCurrency.USD * fx.usdRate, `× ${formatNumber(fx.usdRate)} blue`);
  if (byCurrency.EUR) add(<Money value={byCurrency.EUR} currency="EUR" />, byCurrency.EUR * fx.eurRate, `× ${formatNumber(fx.eurRate)} euro`);
  if (byCurrency.BTC)
    add(<Money value={byCurrency.BTC} currency="BTC" />, byCurrency.BTC * fx.btcUsd * fx.usdRate, `× US$ ${formatNumber(fx.btcUsd)} × ${formatNumber(fx.usdRate)}`);
  if (byCurrency.ETH)
    add(<Money value={byCurrency.ETH} currency="ETH" />, byCurrency.ETH * fx.ethUsd * fx.usdRate, `× US$ ${formatNumber(fx.ethUsd)} × ${formatNumber(fx.usdRate)}`);
  if (sinceIncomesArs > 0) add(`Ingresos ${windowLabel}`, sinceIncomesArs, undefined, "+");
  if (sinceExpensesArs > 0) add(`Gastos ${windowLabel}`, -sinceExpensesArs, undefined, "−");
  if (sinceLossesArs > 0) add(`Pérdidas de trading ${windowLabel}`, -sinceLossesArs, "No son gastos: no se compró nada", "−");

  if (terms.length === 0) return null;

  return (
    <details className={s.equation}>
      <summary>Cómo se calcula</summary>
      <ol className={s.terms}>
        {terms.map((t, i) => (
          <li key={i} className={s.term}>
            <span className={s.op} aria-hidden="true">
              {t.op}
            </span>
            <span className={s.termMain}>
              <span>{t.main}</span>
              {t.chain && <span className={s.termChain}>{t.chain}</span>}
            </span>
            <Money className={s.termValue} value={Math.abs(t.ars)} currency="ARS" />
          </li>
        ))}
        <li className={`${s.term} ${s.termTotal}`}>
          <span className={s.op} aria-hidden="true">
            =
          </span>
          <span>Patrimonio estimado</span>
          <Money className={s.termValue} value={totalArs} currency="ARS" />
        </li>
      </ol>
    </details>
  );
}

export function closeMeta(lastCloseDate: string | undefined, lastCloseArs: number | undefined) {
  if (!lastCloseDate || lastCloseArs === undefined) return undefined;
  return (
    <>
      Último cierre, {formatDayMonth(lastCloseDate)}: <Money value={lastCloseArs} currency="ARS" />
    </>
  );
}
