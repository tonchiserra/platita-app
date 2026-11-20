"use client";

import { useId, useState } from "react";
import { Button, Field, Input, Money, Select, Textarea, ui } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useWrite } from "@/lib/supabase/use-write";
import { CURRENCIES, PLATFORM_TYPES, PLATFORM_TYPE_LABELS } from "@/lib/constants/currencies";
import { convertToArs } from "@/lib/utils/currency-conversion";
import { formatNumber, parseArgentineNumber, todayKey } from "@/lib/utils/format";
import type { ExchangeRates } from "@/types/database";
import s from "./patrimony.module.css";

export interface FormPlatform {
  id: string;
  name: string;
  default_currency: string;
}

export interface FormSnapshot {
  id: string;
  date: string;
  notes: string | null;
  items: { platform_id: string; currency: string; amount: number }[];
}

interface Row {
  key: number;
  currency: string;
  amount: string;
}

let seq = 0;
const row = (currency: string, amount = ""): Row => ({ key: ++seq, currency, amount });
const toInput = (n: number) => String(n).replace(".", ",");

function ratesNote(fx: ExchangeRates) {
  const parts: string[] = [];
  if (fx.usdRate > 0) parts.push(`Dólar ${Math.round(fx.usdRate)}`);
  if (fx.btcUsd > 0) parts.push(`BTC ${Math.round(fx.btcUsd / 1000)}k`);
  if (fx.ethUsd > 0) parts.push(`ETH ${(fx.ethUsd / 1000).toFixed(1)}k`);
  return parts.join(", ");
}

/**
 * A monthly close: the balance of every platform, in each currency it holds.
 * A new close starts from the last one's balances, so only what moved needs
 * typing. The total is valued at today's rates and stored with the close.
 */
export function SnapshotForm({
  platforms: initialPlatforms,
  fx,
  editing,
  base,
  onDone,
}: {
  platforms: FormPlatform[];
  fx: ExchangeRates;
  /** The close being edited. */
  editing?: FormSnapshot;
  /** The last close, used to prefill a new one. */
  base?: FormSnapshot;
  onDone?: () => void;
}) {
  const id = useId();
  const { run, saving, error, setError } = useWrite();
  const source = editing ?? base;
  const [platforms, setPlatforms] = useState(() => {
    const known = new Map(initialPlatforms.map((p) => [p.id, p]));
    // A platform since deactivated still shows when this close holds money in it.
    for (const item of source?.items ?? [])
      if (!known.has(item.platform_id)) known.set(item.platform_id, { id: item.platform_id, name: "Plataforma archivada", default_currency: item.currency });
    return [...known.values()];
  });
  const [rows, setRows] = useState<Record<string, Row[]>>(() => {
    const out: Record<string, Row[]> = {};
    for (const item of source?.items ?? []) (out[item.platform_id] ??= []).push(row(item.currency, toInput(item.amount)));
    for (const p of initialPlatforms) out[p.id] ??= [row(p.default_currency)];
    return out;
  });
  const [date, setDate] = useState(editing?.date ?? todayKey());
  const [notes, setNotes] = useState(editing?.notes ?? ratesNote(fx));
  const [adding, setAdding] = useState(false);

  const items = platforms.flatMap((p) =>
    (rows[p.id] ?? [])
      .map((r) => ({ platform_id: p.id, currency: r.currency, amount: parseArgentineNumber(r.amount) }))
      .filter((i) => Number.isFinite(i.amount) && i.amount !== 0)
  );
  const totalArs = items.reduce((sum, i) => sum + convertToArs(i.amount, i.currency, fx), 0);

  const update = (platformId: string, key: number, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [platformId]: prev[platformId].map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addRow = (platformId: string) =>
    setRows((prev) => {
      const used = new Set(prev[platformId]?.map((r) => r.currency));
      return { ...prev, [platformId]: [...(prev[platformId] ?? []), row(CURRENCIES.find((c) => !used.has(c)) ?? "ARS")] };
    });
  const removeRow = (platformId: string, key: number) =>
    setRows((prev) => ({ ...prev, [platformId]: prev[platformId].filter((r) => r.key !== key) }));

  async function createPlatform(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const type = String(data.get("type"));
    const currency = String(data.get("currency"));
    if (!name) return;
    const holder: { created: FormPlatform | null } = { created: null };
    const ok = await run(async (supabase, userId) => {
      const res = await supabase
        .from("platforms")
        .insert({ user_id: userId, name, type, default_currency: currency })
        .select("id, name, default_currency")
        .single();
      holder.created = res.data as FormPlatform | null;
      return res;
    });
    const p = holder.created;
    if (ok && p) {
      setPlatforms((prev) => [...prev, p]);
      setRows((prev) => ({ ...prev, [p.id]: [row(p.default_currency)] }));
      setAdding(false);
    }
  }

  async function save() {
    if (items.length === 0) {
      setError("Cargá al menos un saldo.");
      return;
    }
    const header = { date, total_ars: totalArs, notes: notes.trim() || null };
    const ok = await run(async (supabase, userId) => {
      let snapshotId = editing?.id;
      if (editing) {
        const up = await supabase.from("patrimony_snapshots").update(header).eq("id", editing.id);
        if (up.error) return up;
        const del = await supabase.from("patrimony_snapshot_items").delete().eq("snapshot_id", editing.id);
        if (del.error) return del;
      } else {
        const ins = await supabase.from("patrimony_snapshots").insert({ ...header, user_id: userId }).select("id").single();
        if (ins.error) return ins;
        snapshotId = ins.data.id as string;
      }
      return supabase.from("patrimony_snapshot_items").insert(items.map((i) => ({ ...i, snapshot_id: snapshotId })));
    });
    if (ok) onDone?.();
  }

  return (
    <div className={ui.stack}>
      {!editing && base && <p className={s.hint}>Arranca con los saldos del último cierre: cambiá solo lo que se movió.</p>}

      <div className={ui.grid2}>
        <Field label="Fecha del cierre" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <div className={s.liveTotal} aria-live="polite">
          <span className={ui.label}>Total a hoy</span>
          <Money className={s.liveFigure} value={totalArs} currency="ARS" />
          {fx.usdRate > 0 && <Money className={s.liveUsd} value={totalArs / fx.usdRate} currency="USD" decimals={0} />}
        </div>
      </div>

      <div className={s.platforms}>
        {platforms.map((p) => (
          <fieldset key={p.id} className={s.platform}>
            <legend className={s.platformName}>{p.name}</legend>
            {(rows[p.id] ?? []).map((r) => (
              <div key={r.key} className={s.balanceRow}>
                <Select aria-label={`Moneda en ${p.name}`} value={r.currency} onChange={(e) => update(p.id, r.key, { currency: e.target.value })} className={s.curSelect}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Saldo en ${p.name} (${r.currency})`}
                  inputMode="decimal"
                  placeholder="0"
                  value={r.amount}
                  onChange={(e) => update(p.id, r.key, { amount: e.target.value })}
                  autoComplete="off"
                />
                <Button variant="ghost" size="sm" iconOnly aria-label="Quitar" onClick={() => removeRow(p.id, r.key)}>
                  <Icon name="close" size={16} />
                </Button>
              </div>
            ))}
            <button type="button" className={s.addCurrency} onClick={() => addRow(p.id)}>
              + Otra moneda
            </button>
          </fieldset>
        ))}
      </div>

      {adding ? (
        <form className={s.newPlatform} onSubmit={createPlatform}>
          <p className="h3">Nueva plataforma</p>
          <Field label="Nombre" htmlFor={`${id}-pname`}>
            <Input id={`${id}-pname`} name="name" placeholder="Ej: Mercado Pago" required autoFocus />
          </Field>
          <div className={ui.grid2}>
            <Field label="Tipo" htmlFor={`${id}-ptype`}>
              <Select id={`${id}-ptype`} name="type" defaultValue="bank">
                {PLATFORM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PLATFORM_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda principal" htmlFor={`${id}-pcur`}>
              <Select id={`${id}-pcur`} name="currency" defaultValue="ARS">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className={ui.actions}>
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Agregar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Nueva plataforma
        </Button>
      )}

      <Field label="Notas" htmlFor={`${id}-notes`} hint="Por defecto, las cotizaciones del día.">
        <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <Button variant="accent" size="lg" block onClick={save} loading={saving}>
        {editing ? "Guardar cambios" : "Guardar cierre"}
      </Button>
      {fx.usdRate > 0 && (
        <p className={s.hint}>
          Valuado con el blue a {formatNumber(fx.usdRate)}
          {fx.btcUsd > 0 && `, BTC a US$ ${formatNumber(fx.btcUsd)}`}.
        </p>
      )}
    </div>
  );
}
