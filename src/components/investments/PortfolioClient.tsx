"use client";

import { useId, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Money, Select, ui } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { useWrite } from "@/lib/supabase/use-write";
import { assetTypeLabel } from "@/lib/constants/labels";
import { formatDayMonth, formatNumber, parseArgentineNumber } from "@/lib/utils/format";
import type { Currency } from "@/lib/constants/currencies";
import type { PlatformOption } from "@/components/movements/MovementForm";
import { OperationForm, type KnownAsset, type OperationInitial } from "./OperationForm";
import s from "./investments.module.css";

export function NewOperationButton({ platforms, assets, canSell }: { platforms: PlatformOption[]; assets: KnownAsset[]; canSell: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> Operación
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nueva operación">
        {open && <OperationForm platforms={platforms} assets={assets} canSell={canSell} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

export function OperationList({
  operations,
  platforms,
  assets,
  canSell,
}: {
  operations: OperationInitial[];
  platforms: PlatformOption[];
  assets: KnownAsset[];
  canSell: boolean;
}) {
  const [editing, setEditing] = useState<OperationInitial | null>(null);
  const [deleting, setDeleting] = useState<OperationInitial | null>(null);
  const [limit, setLimit] = useState(20);
  const { run, saving } = useWrite();

  if (operations.length === 0)
    return <EmptyState title="Todavía no hay operaciones" text="Cargá una compra para empezar a seguir tu cartera." />;

  return (
    <>
      <ul className={s.ops}>
        {operations.slice(0, limit).map((op, index) => (
          <li key={op.id} className={s.opItem} style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
            <button type="button" className={s.op} onClick={() => setEditing(op)} aria-label={`Editar ${op.side === "sell" ? "venta" : "compra"} de ${op.asset}`}>
              <Badge tone={op.side === "sell" ? "dark" : "neutral"}>{op.side === "sell" ? "Venta" : "Compra"}</Badge>
              <span className={s.opMain}>
                <span className={s.opTitle}>
                  {op.asset} <span className="muted">· {formatNumber(op.units, op.units < 1 ? 6 : 2)} u.</span>
                </span>
                <span className={s.opMeta}>
                  {formatDayMonth(op.date)} {op.date.slice(0, 4)} · a <Money value={op.price_per_unit} currency={op.currency as Currency} decimals={op.price_per_unit < 10 ? 4 : 2} />
                </span>
              </span>
              <Money
                className={`${s.opAmount} ${op.side === "sell" ? s.in : s.out}`}
                value={op.side === "sell" ? op.total_amount : -op.total_amount}
                currency={op.currency as Currency}
                signed
              />
            </button>
          </li>
        ))}
      </ul>
      {operations.length > limit && (
        <Button variant="secondary" onClick={() => setLimit(limit + 40)}>
          Ver más ({operations.length - limit})
        </Button>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar operación">
        {editing && (
          <div className={ui.stack}>
            <OperationForm key={editing.id} platforms={platforms} assets={assets} canSell={canSell} initial={editing} onDone={() => setEditing(null)} />
            <Button variant="ghost" block onClick={() => setDeleting(editing)}>
              <Icon name="trash" size={18} /> Eliminar
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar esta operación?"
        message="La posición y sus resultados se recalculan sin ella. No se puede deshacer."
        loading={saving}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run((supabase) => supabase.from("investments").delete().eq("id", deleting.id));
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

/** Set, change or clear the manual price of one asset. */
export function PriceButton({
  asset,
  assetType,
  current,
  available,
  quoted,
}: {
  asset: string;
  assetType: string;
  current?: { price: number; currency: string } | null;
  available: boolean;
  /** Already has a market quote: setting a price is an override, not a gap. */
  quoted?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { run, saving, error, setError } = useWrite();
  const key = asset.trim().toUpperCase();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const price = parseArgentineNumber(String(data.get("price") ?? ""));
    if (!(price > 0)) return setError("Ingresá un precio mayor a cero.");
    const ok = await run((supabase, userId) =>
      supabase
        .from("asset_prices")
        .upsert({ user_id: userId, asset: key, price, currency: String(data.get("currency")), updated_at: new Date().toISOString() }, { onConflict: "user_id,asset" })
    );
    if (ok) setOpen(false);
  }

  async function clear() {
    const ok = await run((supabase, userId) => supabase.from("asset_prices").delete().eq("user_id", userId).eq("asset", key));
    if (ok) setOpen(false);
  }

  return (
    <>
      <Button variant={current || quoted ? "ghost" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {current ? "Editar precio" : quoted ? "Precio manual" : "Cargar precio"}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Precio de ${asset}`} narrow>
        {!available ? (
          <p className="muted">Para guardar precios manuales falta aplicar la migración 004 en Supabase.</p>
        ) : (
          <form className={ui.stack} onSubmit={save} noValidate>
            <p className="muted">
              {assetType === "other"
                ? "Este activo no cotiza en ningún mercado que lea la app. Cargá su valor actual por unidad."
                : "Un precio manual pisa la cotización automática. Sirve si la app no encuentra el ticker o lo lee mal."}
            </p>
            <div className={ui.grid2}>
              <Field label="Precio por unidad" htmlFor={`${id}-price`} error={error}>
                <Input id={`${id}-price`} name="price" inputMode="decimal" defaultValue={current ? String(current.price).replace(".", ",") : ""} data-autofocus />
              </Field>
              <Field label="Moneda" htmlFor={`${id}-cur`}>
                <Select id={`${id}-cur`} name="currency" defaultValue={current?.currency ?? "USD"}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </Select>
              </Field>
            </div>
            <div className={ui.actions}>
              {current && (
                <Button variant="ghost" onClick={clear} disabled={saving}>
                  Quitar precio manual
                </Button>
              )}
              <Button type="submit" loading={saving}>
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

export { assetTypeLabel };
