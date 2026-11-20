"use client";

import { useId, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Money, SegmentedRadio, Select, Textarea, ui } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { useWrite } from "@/lib/supabase/use-write";
import { defaultLabel } from "@/lib/utils/trading";
import { formatDayMonth, formatNumber, formatPercent, parseArgentineNumber, todayKey } from "@/lib/utils/format";
import type { PlatformOption } from "@/components/movements/MovementForm";
import s from "./investments.module.css";

export interface TradeItem {
  id: string;
  date: string;
  asset: string;
  direction: string;
  pnl_usd: number;
  pnl_pct: number | null;
  leverage: number | null;
  platform_id: string | null;
  notes: string | null;
}

/**
 * One closed operation and its result. The sign comes from Ganancia/Pérdida,
 * never from the typed amount, so a stray minus can't flip a win. Zero is not
 * allowed: the table's check constraint rejects it too.
 */
function TradeForm({ platforms, initial, onDone }: { platforms: PlatformOption[]; initial?: TradeItem; onDone?: () => void }) {
  const id = useId();
  const { run, saving, error, setError } = useWrite();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const sign = data.get("result") === "loss" ? -1 : 1;
    const amount = Math.abs(parseArgentineNumber(String(data.get("pnl_usd") ?? "")));
    if (!(amount > 0)) return setError("El resultado tiene que ser distinto de cero.");
    const asset = String(data.get("asset") ?? "").trim().toUpperCase();
    if (!asset) return setError("Indicá el mercado operado.");
    const pct = String(data.get("pnl_pct") ?? "").trim();
    const lev = String(data.get("leverage") ?? "").trim();
    const row = {
      date: String(data.get("date")),
      asset,
      direction: String(data.get("direction")),
      pnl_usd: sign * amount,
      pnl_pct: pct ? sign * Math.abs(parseArgentineNumber(pct)) : null,
      leverage: lev ? Math.abs(parseArgentineNumber(lev)) : null,
      platform_id: (data.get("platform_id") as string) || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    };
    const ok = await run((supabase, userId) =>
      initial ? supabase.from("trades").update(row).eq("id", initial.id) : supabase.from("trades").insert({ ...row, user_id: userId })
    );
    if (ok) onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className={ui.stack} noValidate>
      <SegmentedRadio
        name="result"
        label="Resultado"
        block
        defaultValue={initial && initial.pnl_usd < 0 ? "loss" : "win"}
        options={[
          { value: "win", label: "Ganancia" },
          { value: "loss", label: "Pérdida" },
        ]}
      />
      <Field label="Resultado en USD" htmlFor={`${id}-pnl`} error={error}>
        <Input id={`${id}-pnl`} name="pnl_usd" amount inputMode="decimal" placeholder="0" defaultValue={initial ? String(Math.abs(initial.pnl_usd)).replace(".", ",") : ""} data-autofocus={!initial || undefined} />
      </Field>
      <div className={ui.grid2}>
        <Field label="Mercado" htmlFor={`${id}-asset`}>
          <Input id={`${id}-asset`} name="asset" placeholder="BTC" defaultValue={initial?.asset} autoCapitalize="characters" autoComplete="off" />
        </Field>
        <Field label="Dirección" htmlFor={`${id}-dir`}>
          <Select id={`${id}-dir`} name="direction" defaultValue={initial?.direction ?? "long"}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </Select>
        </Field>
      </div>
      <div className={ui.grid2}>
        <Field label="% sobre el margen (opcional)" htmlFor={`${id}-pct`}>
          <Input id={`${id}-pct`} name="pnl_pct" inputMode="decimal" defaultValue={initial?.pnl_pct ? String(Math.abs(initial.pnl_pct)).replace(".", ",") : ""} />
        </Field>
        <Field label="Apalancamiento (opcional)" htmlFor={`${id}-lev`}>
          <Input id={`${id}-lev`} name="leverage" inputMode="decimal" placeholder="10" defaultValue={initial?.leverage ? String(initial.leverage) : ""} />
        </Field>
      </div>
      <div className={ui.grid2}>
        <Field label="Fecha" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} name="date" type="date" defaultValue={initial?.date ?? todayKey()} required />
        </Field>
        <Field label="Plataforma" htmlFor={`${id}-pl`}>
          <Select id={`${id}-pl`} name="platform_id" defaultValue={initial?.platform_id ?? ""}>
            <option value="">Sin plataforma</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notas (opcional)" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </Field>
      <Button type="submit" variant={initial ? "primary" : "accent"} size="lg" block loading={saving}>
        {initial ? "Guardar cambios" : "Guardar operación"}
      </Button>
    </form>
  );
}

export function NewTradeButton({ platforms }: { platforms: PlatformOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> Operación
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nueva operación de trading">
        {open && <TradeForm platforms={platforms} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

export function TradeList({ trades, platforms }: { trades: TradeItem[]; platforms: PlatformOption[] }) {
  const [editing, setEditing] = useState<TradeItem | null>(null);
  const [deleting, setDeleting] = useState<TradeItem | null>(null);
  const [limit, setLimit] = useState(30);
  const { run, saving } = useWrite();
  const names = Object.fromEntries(platforms.map((p) => [p.id, p.name]));

  if (trades.length === 0)
    return <EmptyState title="El libro está vacío" text="Cargá cada operación cerrada con su resultado. Las ganancias cuentan como ingreso; las pérdidas solo bajan el patrimonio estimado." />;

  return (
    <>
      <ul className={s.ops}>
        {trades.slice(0, limit).map((t, index) => (
          <li key={t.id} className={s.opItem} style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
            <button type="button" className={s.op} onClick={() => setEditing(t)} aria-label={`Editar ${defaultLabel(t)}`}>
              <Badge tone={t.direction === "long" ? "neutral" : "dark"}>{t.direction === "long" ? "Long" : "Short"}</Badge>
              <span className={s.opMain}>
                <span className={s.opTitle}>{t.notes || t.asset}</span>
                <span className={s.opMeta}>
                  {[
                    formatDayMonth(t.date),
                    t.notes ? t.asset : null,
                    t.leverage ? `x${formatNumber(t.leverage)}` : null,
                    t.pnl_pct !== null ? formatPercent(t.pnl_pct) : null,
                    t.platform_id ? names[t.platform_id] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Money className={`${s.opAmount} ${t.pnl_usd >= 0 ? s.in : s.out}`} value={t.pnl_usd} currency="USD" signed />
            </button>
          </li>
        ))}
      </ul>
      {trades.length > limit && (
        <Button variant="secondary" onClick={() => setLimit(limit + 50)}>
          Ver más ({trades.length - limit})
        </Button>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar operación">
        {editing && (
          <div className={ui.stack}>
            <TradeForm key={editing.id} platforms={platforms} initial={editing} onDone={() => setEditing(null)} />
            <Button variant="ghost" block onClick={() => setDeleting(editing)}>
              <Icon name="trash" size={18} /> Eliminar
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar esta operación?"
        message="Si fue una ganancia, también sale de tus ingresos. No se puede deshacer."
        loading={saving}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run((supabase) => supabase.from("trades").delete().eq("id", deleting.id));
          if (ok) {
            setDeleting(null);
            setEditing(null);
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
