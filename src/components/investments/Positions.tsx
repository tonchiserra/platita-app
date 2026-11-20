import { Badge, Box, Delta, Money, Section } from "@/components/ui";
import { assetTypeLabel } from "@/lib/constants/labels";
import { formatPercent } from "@/lib/utils/format";
import type { PortfolioSummary, Position } from "@/lib/utils/portfolio";
import { PriceButton } from "./PortfolioClient";
import s from "./investments.module.css";

const SOURCE_LABEL = { crypto: "Binance", market: "BYMA · data912", manual: "Manual" } as const;

export function PortfolioSummaryBoxes({ summary, usdRate }: { summary: PortfolioSummary; usdRate: number }) {
  // Pesos first, at today's blue; the dollars the results are computed in stay underneath.
  const ars = (usd: number) => (usdRate > 0 ? usd * usdRate : 0);
  return (
    <div className={s.summary}>
      <Box tone="grey" className={s.stat}>
        <span className={s.statLabel}>Invertido hoy</span>
        <Money className={s.statValue} value={ars(summary.costUsd)} currency="ARS" />
        <Money className={s.statSub} value={summary.costUsd} currency="USD" decimals={0} />
      </Box>
      <Box tone={summary.unrealizedUsd >= 0 ? "up" : "down"} className={s.stat}>
        <span className={s.statLabel}>Resultado sin realizar</span>
        <Money className={s.statValue} value={ars(summary.unrealizedUsd)} currency="ARS" signed />
        <span className={s.statSub}>
          <Money value={summary.unrealizedUsd} currency="USD" decimals={0} signed /> <Delta value={summary.unrealizedPct} />
        </span>
      </Box>
      <Box tone="grey" className={s.stat}>
        <span className={s.statLabel}>Resultado realizado</span>
        <Money className={s.statValue} value={ars(summary.realizedUsd)} currency="ARS" signed />
        <span className={s.statSub}>
          <Money value={summary.realizedUsd} currency="USD" decimals={0} signed /> · por ventas
        </span>
      </Box>
    </div>
  );
}

export function PositionCards({
  positions,
  manual,
  manualAvailable,
}: {
  positions: Position[];
  manual: Map<string, { price: number; currency: string }>;
  manualAvailable: boolean;
}) {
  const open = positions.filter((p) => !p.closed);
  const closed = positions.filter((p) => p.closed);
  const units = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: n < 1 ? 8 : 4 });

  return (
    <Section label="Posiciones" title="Lo que tenés">
      {open.length === 0 ? (
        <p className="muted">No tenés posiciones abiertas.</p>
      ) : (
        <div className={s.positions}>
          {open.map((p, index) => (
            <article key={p.key} className={s.position} style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
              <div className={s.posHead}>
                <div className={s.posName}>
                  <span className={s.posAsset}>{p.asset}</span>
                  <Badge>{assetTypeLabel(p.assetType)}</Badge>
                </div>
                <span className={s.posWeight}>{formatPercent(p.weight, { signed: false, decimals: 0 })} de la cartera</span>
              </div>
              <div className={s.bar} aria-hidden="true">
                <div className={s.barFill} style={{ width: `${Math.max(2, p.weight)}%` }} />
              </div>
              <div className={s.posValue}>
                {p.valueUsd !== null ? (
                  <Money className={s.posFigure} value={p.valueUsd} currency="USD" decimals={p.valueUsd < 100 ? 2 : 0} />
                ) : (
                  <span className={s.posFigure}>Sin precio</span>
                )}
                {p.unrealizedUsd !== null && (
                  <span>
                    <Money value={p.unrealizedUsd} currency="USD" decimals={0} signed /> <Delta value={p.unrealizedPct} />
                  </span>
                )}
              </div>
              <dl className={s.facts}>
                <div className={s.fact}>
                  <dt>Unidades</dt>
                  <dd>{units(p.units)}</dd>
                </div>
                <div className={s.fact}>
                  <dt>Invertido</dt>
                  <dd>
                    <Money value={p.costUsd} currency="USD" decimals={0} />
                  </dd>
                </div>
                <div className={s.fact}>
                  <dt>Costo promedio</dt>
                  <dd>{p.avgCostUsd !== null ? <Money value={p.avgCostUsd} currency="USD" decimals={p.avgCostUsd < 10 ? 4 : 2} /> : "—"}</dd>
                </div>
                <div className={s.fact}>
                  <dt>Precio actual</dt>
                  <dd>{p.priceUsd !== null ? <Money value={p.priceUsd} currency="USD" decimals={p.priceUsd < 10 ? 4 : 2} /> : "—"}</dd>
                </div>
                {p.realizedUsd !== 0 && (
                  <div className={s.fact}>
                    <dt>Realizado</dt>
                    <dd>
                      <Money value={p.realizedUsd} currency="USD" decimals={0} signed />
                    </dd>
                  </div>
                )}
              </dl>
              <div className={s.posFoot}>
                <span>
                  {p.priceSource ? SOURCE_LABEL[p.priceSource] : "Sin cotización"}
                  {p.priceChange !== null && p.priceSource === "market" && <> · hoy {formatPercent(p.priceChange)}</>}
                </span>
                <PriceButton asset={p.asset} assetType={p.assetType} current={manual.get(p.key) ?? null} available={manualAvailable} quoted={p.priceSource !== null && p.priceSource !== "manual"} />
              </div>
            </article>
          ))}
        </div>
      )}
      {closed.length > 0 && (
        <>
          <p className={s.closedTitle}>Posiciones cerradas</p>
          <ul className={s.closed}>
            {closed.map((p) => (
              <li key={p.key} className={s.closedRow}>
                <span>{p.asset}</span>
                <span>
                  Realizado <Money value={p.realizedUsd} currency="USD" decimals={0} signed />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
