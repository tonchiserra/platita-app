"use client";

import { useId } from "react";
import { Button, Field, Input, SegmentedRadio, Select, ui } from "@/components/ui";
import { useWrite } from "@/lib/supabase/use-write";
import { INCOME_SOURCES } from "@/lib/constants/sources";
import { categoryLabel, sourceLabel } from "@/lib/constants/labels";
import { parseArgentineNumber, todayKey } from "@/lib/utils/format";
import type { CategoryOption } from "@/lib/utils/expense-categories";

export type MovementKind = "expense" | "income";

export interface MovementInitial {
  id: string;
  amount: number;
  currency: string;
  date: string;
  /** Category for an expense, source for an income. */
  bucket: string;
  description: string;
  platform_id: string | null;
}

export interface PlatformOption {
  id: string;
  name: string;
}

/**
 * Create or edit an expense or an income. Values are read from FormData — no
 * controlled state — and read **before** the first await, since React clears
 * `currentTarget` once the handler yields.
 */
export function MovementForm({
  kind,
  categories,
  platforms,
  initial,
  onDone,
}: {
  kind: MovementKind;
  categories: CategoryOption[];
  platforms: PlatformOption[];
  initial?: MovementInitial;
  onDone?: () => void;
}) {
  const id = useId();
  const { run, saving, error, setError } = useWrite();
  const isExpense = kind === "expense";
  const table = isExpense ? "expenses" : "incomes";
  const bucketField = isExpense ? "category" : "source";

  // A stored value that is no longer in the list (a deleted category) stays selectable when editing.
  const bucketOptions = isExpense
    ? categories.map((c) => ({ value: c.name, label: `${c.icon} ${categoryLabel(c.name)}` }))
    : INCOME_SOURCES.map((src) => ({ value: src, label: sourceLabel(src) }));
  if (initial && !bucketOptions.some((o) => o.value === initial.bucket)) {
    bucketOptions.unshift({ value: initial.bucket, label: isExpense ? categoryLabel(initial.bucket) : sourceLabel(initial.bucket) });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const amount = parseArgentineNumber(String(data.get("amount") ?? ""));
    if (!(amount > 0)) {
      setError("Ingresá un monto mayor a cero.");
      return;
    }
    const row = {
      amount,
      currency: String(data.get("currency") ?? "ARS"),
      date: String(data.get("date")),
      [bucketField]: String(data.get("bucket")),
      description: String(data.get("description") ?? "").trim(),
      platform_id: (data.get("platform_id") as string) || null,
    };

    const ok = await run((supabase, userId) =>
      initial ? supabase.from(table).update(row).eq("id", initial.id) : supabase.from(table).insert({ ...row, user_id: userId })
    );
    if (ok) {
      if (!initial) {
        form.reset();
        (form.elements.namedItem("amount") as HTMLInputElement | null)?.focus();
      }
      onDone?.();
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${ui.stack} ${ui.formIn}`} noValidate>
      <Field label="Monto" htmlFor={`${id}-amount`} error={error}>
        <Input
          id={`${id}-amount`}
          name="amount"
          amount
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          required
          defaultValue={initial ? String(initial.amount).replace(".", ",") : undefined}
          aria-invalid={!!error || undefined}
          data-autofocus={!initial || undefined}
        />
      </Field>

      <SegmentedRadio
        name="currency"
        label="Moneda"
        defaultValue={initial?.currency ?? "ARS"}
        options={[
          { value: "ARS", label: "ARS" },
          { value: "USD", label: "USD" },
        ]}
      />

      <div className={ui.grid2}>
        <Field label={isExpense ? "Categoría" : "Fuente"} htmlFor={`${id}-bucket`}>
          <Select id={`${id}-bucket`} name="bucket" required defaultValue={initial?.bucket ?? bucketOptions[0]?.value}>
            {bucketOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} name="date" type="date" required defaultValue={initial?.date ?? todayKey()} />
        </Field>
      </div>

      <Field label="Descripción" htmlFor={`${id}-description`}>
        <Input
          id={`${id}-description`}
          name="description"
          placeholder={isExpense ? "Ej: compra en el súper" : "Ej: sueldo de noviembre"}
          defaultValue={initial?.description}
          autoComplete="off"
        />
      </Field>

      {platforms.length > 0 && (
        <Field label="Plataforma (opcional)" htmlFor={`${id}-platform`}>
          <Select id={`${id}-platform`} name="platform_id" defaultValue={initial?.platform_id ?? ""}>
            <option value="">Sin plataforma</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Button type="submit" variant={initial ? "primary" : "accent"} size="lg" block loading={saving}>
        {initial ? "Guardar cambios" : isExpense ? "Cargar gasto" : "Cargar ingreso"}
      </Button>
    </form>
  );
}
