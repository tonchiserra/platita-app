"use client";

import { useState } from "react";
import { Button, Delta, EmptyState, Money } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { useWrite } from "@/lib/supabase/use-write";
import { formatDate } from "@/lib/utils/format";
import type { Currency } from "@/lib/constants/currencies";
import type { ExchangeRates } from "@/types/database";
import { SnapshotForm, type FormPlatform, type FormSnapshot } from "./SnapshotForm";
import s from "./patrimony.module.css";

export interface CloseRow extends FormSnapshot {
  total_ars: number;
  /** At the blue of the close's own date. */
  total_usd: number | null;
}

export function NewCloseButton({ platforms, fx, base }: { platforms: FormPlatform[]; fx: ExchangeRates; base?: FormSnapshot }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> Cargar cierre
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo cierre">
        {open && <SnapshotForm platforms={platforms} fx={fx} base={base} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

export function CloseList({ closes, platforms, fx }: { closes: CloseRow[]; platforms: FormPlatform[]; fx: ExchangeRates }) {
  const [expanded, setExpanded] = useState<string | null>(closes[0]?.id ?? null);
  // Bodies mount on first open and stay, so they can animate closed too.
  const [seen, setSeen] = useState<Set<string>>(() => new Set(closes[0] ? [closes[0].id] : []));
  const [editing, setEditing] = useState<CloseRow | null>(null);
  const [deleting, setDeleting] = useState<CloseRow | null>(null);
  const { run, saving } = useWrite();
  const names = Object.fromEntries(platforms.map((p) => [p.id, p.name]));

  if (closes.length === 0)
    return <EmptyState title="Todavía no hay cierres" text="Un cierre es la foto de tus saldos a fin de mes. Con uno ya se calcula tu patrimonio estimado." />;

  async function remove() {
    if (!deleting) return;
    const ok = await run((supabase) => supabase.from("patrimony_snapshots").delete().eq("id", deleting.id));
    if (ok) setDeleting(null);
  }

  return (
    <div className={s.closes}>
      {closes.map((c, i) => {
        const prev = closes[i + 1];
        const change = prev && prev.total_ars > 0 ? ((c.total_ars - prev.total_ars) / prev.total_ars) * 100 : null;
        const open = expanded === c.id;
        const byPlatform = new Map<string, { currency: string; amount: number }[]>();
        for (const item of c.items) byPlatform.set(item.platform_id, [...(byPlatform.get(item.platform_id) ?? []), item]);
        return (
          <article key={c.id} className={s.close}>
            <button
              type="button"
              className={s.closeHead}
              aria-expanded={open}
              onClick={() => {
                setSeen((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
                setExpanded(open ? null : c.id);
              }}
            >
              <span className={s.closeDate}>{formatDate(c.date)}</span>
              <span className={s.closeFigures}>
                <Money className={s.closeTotal} value={c.total_ars} currency="ARS" />
                {c.total_usd !== null && <Money className={s.closeUsd} value={c.total_usd} currency="USD" decimals={0} />}
              </span>
              <span className={s.closeDelta}>{change !== null && <Delta value={change} />}</span>
              <Icon name="chevronDown" size={18} className={s.chev} />
            </button>
            <div className={s.collapse} data-open={open}>
              <div className={s.collapseInner}>
            {seen.has(c.id) && (
              <div className={s.closeBody}>
                <ul className={s.items}>
                  {[...byPlatform.entries()].map(([pid, rows]) => (
                    <li key={pid} className={s.item}>
                      <span>{names[pid] ?? "Plataforma archivada"}</span>
                      <span className={s.itemAmounts}>
                        {rows.map((r, j) => (
                          <Money key={j} value={r.amount} currency={r.currency as Currency} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                {c.notes && <p className={s.hint}>{c.notes}</p>}
                <div className={s.closeActions}>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>
                    <Icon name="edit" size={16} /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
                    <Icon name="trash" size={16} /> Eliminar
                  </Button>
                </div>
              </div>
            )}
              </div>
            </div>
          </article>
        );
      })}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar cierre">
        {editing && <SnapshotForm key={editing.id} platforms={platforms} fx={fx} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar este cierre?"
        message={deleting ? `Se borra el cierre del ${formatDate(deleting.date)} con todos sus saldos. No se puede deshacer.` : ""}
        loading={saving}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
