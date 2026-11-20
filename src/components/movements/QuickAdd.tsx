"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { ui } from "@/components/ui";
import type { CategoryOption } from "@/lib/utils/expense-categories";
import { MovementForm, type MovementKind, type PlatformOption } from "./MovementForm";
import s from "./movements.module.css";

/**
 * The blue "+": load an expense or an income from anywhere. On the phone it
 * floats above the bottom bar; in the sidebar it is a full-width button.
 */
export function QuickAdd({
  categories,
  platforms,
  variant = "fab",
}: {
  categories: CategoryOption[];
  platforms: PlatformOption[];
  variant?: "fab" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MovementKind>("expense");

  return (
    <>
      {variant === "fab" ? (
        <button type="button" className={s.fab} onClick={() => setOpen(true)} aria-label="Cargar un movimiento">
          <Icon name="plus" size={26} />
        </button>
      ) : (
        <button type="button" className={s.sidebarAdd} onClick={() => setOpen(true)}>
          <Icon name="plus" size={18} />
          Cargar movimiento
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo movimiento">
        <div className={ui.stack}>
          <div
            className={`${ui.segmented} ${ui.segmentedBlock}`}
            role="tablist"
            aria-label="Tipo de movimiento"
            style={{ "--seg-n": 2, "--seg-i": kind === "expense" ? 0 : 1 } as React.CSSProperties}
          >
            <span className={ui.segThumb} aria-hidden="true" />
            {(
              [
                ["expense", "Gasto"],
                ["income", "Ingreso"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={kind === value}
                className={ui.segButton}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <MovementForm key={kind} kind={kind} categories={categories} platforms={platforms} onDone={() => setOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}
