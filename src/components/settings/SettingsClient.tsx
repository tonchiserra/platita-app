"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Field, Input, Select, ui } from "@/components/ui";
import { ConfirmDialog, MoneyToggle, Sheet, ThemeSwitch } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import { useWrite } from "@/lib/supabase/use-write";
import { CURRENCIES, PLATFORM_TYPES, PLATFORM_TYPE_LABELS, type PlatformType } from "@/lib/constants/currencies";
import { categoryLabel } from "@/lib/constants/labels";
import { DEFAULT_CATEGORY_OPTIONS } from "@/lib/utils/expense-categories";
import type { ExpenseCategoryRow, Platform } from "@/types/database";
import s from "./settings.module.css";

/* ---------- Account ---------- */

export function AccountSettings({ email }: { email?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = await createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <ul className={s.rows}>
      <li className={s.row}>
        <span className={s.rowLabel}>Cuenta</span>
        <span className={s.rowValue}>{email}</span>
      </li>
      <li className={s.row}>
        <span className={s.rowLabel}>Apariencia</span>
        <ThemeSwitch />
      </li>
      <li className={s.row}>
        <span className={s.rowLabel}>
          Montos
          <span className={s.rowHint}>Ocultalos si mirás la app en público.</span>
        </span>
        <MoneyToggle withLabel />
      </li>
      <li className={s.row}>
        <span className={s.rowLabel}>Sesión</span>
        <Button variant="secondary" size="sm" onClick={signOut} loading={signingOut}>
          <Icon name="logout" size={16} /> Cerrar sesión
        </Button>
      </li>
    </ul>
  );
}

/* ---------- Platforms ---------- */

export function PlatformManager({ platforms }: { platforms: Platform[] }) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Platform | null>(null);
  const { run, saving, error } = useWrite();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    const ok = await run((supabase, userId) =>
      supabase.from("platforms").insert({ user_id: userId, name, type: String(data.get("type")), default_currency: String(data.get("currency")) })
    );
    if (ok) {
      form.reset();
      setAdding(false);
    }
  }

  return (
    <div className={ui.stack} style={{ gap: 14 }}>
      {platforms.length === 0 ? (
        <p className="muted">Todavía no hay plataformas. Son tus cuentas: bancos, billeteras, exchanges, efectivo.</p>
      ) : (
        <ul className={s.rows}>
          {platforms.map((p) => (
            <li key={p.id} className={s.row} data-inactive={!p.is_active || undefined}>
              <span className={s.rowLabel}>
                {p.name}
                <span className={s.rowHint}>
                  {PLATFORM_TYPE_LABELS[p.type as PlatformType] ?? p.type} · {p.default_currency}
                </span>
              </span>
              <span className={ui.row} style={{ gap: 4 }}>
                {!p.is_active && <Badge>Archivada</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run((supabase) => supabase.from("platforms").update({ is_active: !p.is_active }).eq("id", p.id))}
                >
                  {p.is_active ? "Archivar" : "Reactivar"}
                </Button>
                <Button variant="ghost" size="sm" iconOnly aria-label={`Eliminar ${p.name}`} onClick={() => setDeleting(p)}>
                  <Icon name="trash" size={16} />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={ui.error}>{error}</p>}
      {adding ? (
        <form className={s.inlineForm} onSubmit={add}>
          <Field label="Nombre" htmlFor={`${id}-name`}>
            <Input id={`${id}-name`} name="name" placeholder="Ej: Brubank" required autoFocus />
          </Field>
          <div className={ui.grid2}>
            <Field label="Tipo" htmlFor={`${id}-type`}>
              <Select id={`${id}-type`} name="type" defaultValue="bank">
                {PLATFORM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PLATFORM_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda principal" htmlFor={`${id}-cur`}>
              <Select id={`${id}-cur`} name="currency" defaultValue="ARS">
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
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Nueva plataforma
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`¿Eliminar ${deleting?.name ?? "la plataforma"}?`}
        message="Sus saldos desaparecen de todos los cierres y los movimientos quedan sin plataforma. Si solo dejaste de usarla, archivala."
        loading={saving}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run((supabase) => supabase.from("platforms").delete().eq("id", deleting.id));
          if (ok) setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* ---------- Categories ---------- */

function CategoryForm({ initial, nextOrder, onDone }: { initial?: ExpenseCategoryRow; nextOrder: number; onDone: () => void }) {
  const id = useId();
  const { run, saving, error } = useWrite();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const row = {
      name: String(data.get("name") ?? "").trim(),
      icon: String(data.get("icon") ?? "").trim() || "📌",
      is_fixed: data.get("is_fixed") === "on",
    };
    if (!row.name) return;
    const ok = await run((supabase, userId) =>
      initial
        ? supabase.from("expense_categories").update(row).eq("id", initial.id)
        : supabase.from("expense_categories").insert({ ...row, user_id: userId, sort_order: nextOrder })
    );
    if (ok) onDone();
  }

  return (
    <form className={ui.stack} onSubmit={submit}>
      <div className={s.catFields}>
        <Field label="Ícono" htmlFor={`${id}-icon`}>
          <Input id={`${id}-icon`} name="icon" maxLength={4} defaultValue={initial?.icon ?? "📌"} />
        </Field>
        <Field label="Nombre" htmlFor={`${id}-name`} error={error}>
          <Input id={`${id}-name`} name="name" defaultValue={initial?.name} required data-autofocus />
        </Field>
      </div>
      <label className={s.check}>
        <input type="checkbox" name="is_fixed" defaultChecked={initial?.is_fixed} />
        <span>
          Es un gasto fijo mensual
          <span className={s.rowHint}>Alquiler, servicios, suscripciones.</span>
        </span>
      </label>
      <p className={s.hint}>Cambiar el nombre no modifica los gastos ya cargados con el nombre anterior.</p>
      <Button type="submit" loading={saving} block>
        {initial ? "Guardar" : "Agregar categoría"}
      </Button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: ExpenseCategoryRow[] }) {
  const [editing, setEditing] = useState<ExpenseCategoryRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ExpenseCategoryRow | null>(null);
  const { run, saving, error } = useWrite();
  const customised = categories.length > 0;

  if (!customised)
    return (
      <div className={ui.stack} style={{ gap: 14 }}>
        <p className="muted">Estás usando la lista por defecto. Copiala a tu cuenta para renombrar, agregar o borrar categorías.</p>
        <div className={s.chips}>
          {DEFAULT_CATEGORY_OPTIONS.map((c) => (
            <span key={c.name} className={s.chip}>
              {c.icon} {categoryLabel(c.name)}
            </span>
          ))}
        </div>
        {error && <p className={ui.error}>{error}</p>}
        <div>
          <Button
            variant="secondary"
            size="sm"
            loading={saving}
            onClick={() =>
              run((supabase, userId) =>
                supabase
                  .from("expense_categories")
                  .insert(DEFAULT_CATEGORY_OPTIONS.map((c, i) => ({ user_id: userId, name: c.name, icon: c.icon, is_fixed: c.isFixed, sort_order: i })))
              )
            }
          >
            Personalizar la lista
          </Button>
        </div>
      </div>
    );

  return (
    <div className={ui.stack} style={{ gap: 14 }}>
      <ul className={s.rows}>
        {categories.map((c) => (
          <li key={c.id} className={s.row}>
            <span className={s.rowLabel}>
              <span>
                {c.icon} {categoryLabel(c.name)}
              </span>
              {c.is_fixed && <span className={s.rowHint}>Fija mensual</span>}
            </span>
            <span className={ui.row} style={{ gap: 4 }}>
              <Button variant="ghost" size="sm" iconOnly aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                <Icon name="edit" size={16} />
              </Button>
              <Button variant="ghost" size="sm" iconOnly aria-label={`Eliminar ${c.name}`} onClick={() => setDeleting(c)}>
                <Icon name="trash" size={16} />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} /> Nueva categoría
        </Button>
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Nueva categoría" : "Editar categoría"} narrow>
        {editing && (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            nextOrder={categories.length}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        title={`¿Eliminar ${deleting ? categoryLabel(deleting.name) : "la categoría"}?`}
        message="Sale de la lista para cargar gastos. Los gastos que ya tenían esta categoría la conservan."
        loading={saving}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run((supabase) => supabase.from("expense_categories").delete().eq("id", deleting.id));
          if (ok) setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
