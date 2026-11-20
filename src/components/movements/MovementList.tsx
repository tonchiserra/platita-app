"use client";

import { useState } from "react";
import { Badge, Button, Delta, EmptyState, Money } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { useWrite } from "@/lib/supabase/use-write";
import { categoryLabel, sourceLabel } from "@/lib/constants/labels";
import { addMonths, formatDayMonth, formatMonthKey } from "@/lib/utils/format";
import type { Currency } from "@/lib/constants/currencies";
import type { CategoryOption } from "@/lib/utils/expense-categories";
import { MovementForm, type MovementKind, type PlatformOption } from "./MovementForm";
import s from "./movements.module.css";

export interface ListRow {
  id: string;
  date: string;
  amount: number;
  currency: string;
  bucket: string;
  description: string;
  platform_id: string | null;
  /** Rows derived from elsewhere (trading profits) show this badge and can't be edited here. */
  readonly?: string;
}

export interface MonthGroup {
  month: string;
  totalArs: number;
  totalUsd: number;
  rows: ListRow[];
}

export function MovementList({
  kind,
  groups,
  categories,
  platforms,
}: {
  kind: MovementKind;
  groups: MonthGroup[];
  categories: CategoryOption[];
  platforms: PlatformOption[];
}) {
  // A month renders its rows the first time it opens and keeps them, so it can
  // also animate closed. Months never opened stay out of the DOM.
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.month)));
  const [seen, setSeen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.month)));
  const [editing, setEditing] = useState<ListRow | null>(null);
  const [deleting, setDeleting] = useState<ListRow | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const { run, saving } = useWrite();

  // Rows that were not there on the previous render are new: they flash in.
  const ids = groups.flatMap((g) => g.rows.map((r) => r.id)).join("|");
  const [known, setKnown] = useState(ids);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  if (ids !== known) {
    const before = new Set(known.split("|"));
    setFresh(new Set(ids.split("|").filter((id) => id && !before.has(id))));
    setKnown(ids);
  }
  const isExpense = kind === "expense";
  const icons = Object.fromEntries(categories.map((c) => [c.name, c.icon]));
  // Each month against the calendar month before it, in pesos. A month with no
  // movements before it shows no change rather than a misleading one.
  const totalByMonth = new Map(groups.map((g) => [g.month, g.totalArs]));
  const changeOf = (month: string, total: number) => {
    const prev = totalByMonth.get(addMonths(month, -1));
    return prev && prev > 0 ? ((total - prev) / prev) * 100 : null;
  };
  const platformName = Object.fromEntries(platforms.map((p) => [p.id, p.name]));

  if (groups.length === 0)
    return (
      <EmptyState
        title={isExpense ? "Todavía no hay gastos" : "Todavía no hay ingresos"}
        text={`Tocá el botón + para cargar ${isExpense ? "el primero" : "tu primer ingreso"}.`}
      />
    );

  const toggle = (month: string) => {
    setSeen((prev) => (prev.has(month) ? prev : new Set(prev).add(month)));
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  async function remove() {
    if (!deleting) return;
    const id = deleting.id;
    // Collapse the row while the delete is in flight; put it back if it fails.
    setLeaving((prev) => new Set(prev).add(id));
    setDeleting(null);
    setEditing(null);
    const ok = await run((supabase) => supabase.from(isExpense ? "expenses" : "incomes").delete().eq("id", id));
    if (!ok)
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
  }

  return (
    <div className={s.list}>
      {groups.map((g) => {
        const isOpen = open.has(g.month);
        return (
          <section key={g.month} className={s.month}>
            <button type="button" className={s.monthHead} aria-expanded={isOpen} onClick={() => toggle(g.month)}>
              <span className={s.monthName}>{formatMonthKey(g.month)}</span>
              <span className={s.monthCount}>{g.rows.length}</span>
              <span className={s.monthTotal}>
                <Money value={g.totalArs} currency="ARS" />
                <span className={s.monthSub}>
                  <Money className={s.monthUsd} value={g.totalUsd} currency="USD" decimals={0} />
                  <Delta value={changeOf(g.month, g.totalArs)} goodWhen={isExpense ? "down" : "up"} />
                </span>
              </span>
              <Icon name="chevronDown" size={18} className={s.chev} />
            </button>
            <div className={s.collapse} data-open={isOpen}>
              <div className={s.collapseInner}>
            {seen.has(g.month) && (
              <ul className={s.rows}>
                {g.rows.map((r, index) => {
                  const label = isExpense ? categoryLabel(r.bucket) : sourceLabel(r.bucket);
                  const meta = [formatDayMonth(r.date), r.platform_id ? platformName[r.platform_id] : null].filter(Boolean).join(" · ");
                  const body = (
                    <>
                      <span className={s.rowIcon} aria-hidden="true">
                        {isExpense ? icons[r.bucket] ?? "📌" : r.readonly ? "📈" : "↓"}
                      </span>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{r.description || label}</span>
                        <span className={s.rowMeta}>
                          {r.description ? `${label} · ${meta}` : meta}
                          {r.readonly && (
                            <>
                              {" "}
                              <Badge>{r.readonly}</Badge>
                            </>
                          )}
                        </span>
                      </span>
                      <Money className={`${s.rowAmount} ${isExpense ? s.out : s.in}`} value={isExpense ? -r.amount : r.amount} currency={r.currency as Currency} signed />
                    </>
                  );
                  return (
                    <li
                      key={r.id}
                      className={`${s.rowItem} ${leaving.has(r.id) ? s.leaving : ""} ${fresh.has(r.id) ? s.fresh : ""}`}
                      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
                    >
                      <div className={s.rowClip}>
                        {r.readonly ? (
                          <div className={s.row}>{body}</div>
                        ) : (
                          <button type="button" className={`${s.row} ${s.rowButton}`} onClick={() => setEditing(r)} aria-label={`Editar ${r.description || label}`}>
                            {body}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
              </div>
            </div>
          </section>
        );
      })}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={isExpense ? "Editar gasto" : "Editar ingreso"}>
        {editing && (
          <div className={s.editWrap}>
            <MovementForm
              key={editing.id}
              kind={kind}
              categories={categories}
              platforms={platforms}
              initial={{ ...editing }}
              onDone={() => setEditing(null)}
            />
            <Button variant="ghost" block onClick={() => setDeleting(editing)}>
              <Icon name="trash" size={18} />
              Eliminar
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title={isExpense ? "¿Eliminar este gasto?" : "¿Eliminar este ingreso?"}
        message="No se puede deshacer."
        loading={saving}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
