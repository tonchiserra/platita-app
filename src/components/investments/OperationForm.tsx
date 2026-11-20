"use client";

import { useId, useState } from "react";
import { Button, Field, Input, SegmentedRadio, Select, Textarea, ui } from "@/components/ui";
import { useWrite } from "@/lib/supabase/use-write";
import { ASSET_TYPES } from "@/lib/constants/currencies";
import { assetTypeLabel } from "@/lib/constants/labels";
import { formatNumber, parseArgentineNumber, todayKey } from "@/lib/utils/format";
import type { PlatformOption } from "@/components/movements/MovementForm";

export interface OperationInitial {
  id: string;
  date: string;
  asset: string;
  asset_type: string;
  side: "buy" | "sell";
  units: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  platform_id: string | null;
  notes: string | null;
}

export interface KnownAsset {
  asset: string;
  assetType: string;
  units: number;
}

/**
 * A purchase or a sale. You type what you paid (or got) and the price per
 * unit; the units follow, as in the original form. Bonds count units as face
 * value, because the market quotes them per 100 of it.
 */
export function OperationForm({
  platforms,
  assets,
  canSell,
  initial,
  defaultSide = "buy",
  onDone,
}: {
  platforms: PlatformOption[];
  assets: KnownAsset[];
  /** False until migration 004 adds the `side` column. */
  canSell: boolean;
  initial?: OperationInitial;
  defaultSide?: "buy" | "sell";
  onDone?: () => void;
}) {
  const id = useId();
  const { run, saving, error, setError } = useWrite();
  const [total, setTotal] = useState(initial ? String(initial.total_amount).replace(".", ",") : "");
  const [price, setPrice] = useState(initial ? String(initial.price_per_unit).replace(".", ",") : "");
  const [asset, setAsset] = useState(initial?.asset ?? "");
  const known = assets.find((a) => a.asset.toUpperCase() === asset.trim().toUpperCase());
  const [assetType, setAssetType] = useState(initial?.asset_type ?? "crypto");
  const t = parseArgentineNumber(total);
  const p = parseArgentineNumber(price);
  const units = t > 0 && p > 0 ? t / p : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const side = (data.get("side") as "buy" | "sell" | null) ?? "buy";
    if (!asset.trim()) return setError("Indicá el activo.");
    if (!(t > 0) || !(p > 0)) return setError("Ingresá el monto total y el precio por unidad.");
    if (side === "sell" && !canSell) return setError("Para cargar ventas falta aplicar la migración 004 en Supabase.");

    const row: Record<string, unknown> = {
      date: String(data.get("date")),
      asset: asset.trim(),
      asset_type: known?.assetType ?? assetType,
      units: t / p,
      price_per_unit: p,
      total_amount: t,
      currency: String(data.get("currency") ?? "USD"),
      platform_id: (data.get("platform_id") as string) || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    };
    // Before migration 004 the column does not exist, and naming it fails the write.
    if (canSell) row.side = side;

    const ok = await run((supabase, userId) =>
      initial ? supabase.from("investments").update(row).eq("id", initial.id) : supabase.from("investments").insert({ ...row, user_id: userId })
    );
    if (ok) onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className={ui.stack} noValidate>
      <SegmentedRadio
        name="side"
        label="Tipo de operación"
        block
        defaultValue={initial?.side ?? defaultSide}
        options={[
          { value: "buy", label: "Compra" },
          { value: "sell", label: canSell ? "Venta" : "Venta (falta migración)" },
        ]}
      />

      <div className={ui.grid2}>
        <Field label="Activo" htmlFor={`${id}-asset`} hint={known ? `Tenés ${formatNumber(known.units, known.units < 1 ? 6 : 2)}` : "Ticker: BTC, AAPL, GGAL, AL30…"}>
          <Input
            id={`${id}-asset`}
            list={`${id}-assets`}
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder="BTC"
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
          <datalist id={`${id}-assets`}>
            {assets.map((a) => (
              <option key={a.asset} value={a.asset} />
            ))}
          </datalist>
        </Field>
        <Field label="Tipo" htmlFor={`${id}-type`}>
          <Select id={`${id}-type`} value={known?.assetType ?? assetType} onChange={(e) => setAssetType(e.target.value)} disabled={!!known}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {assetTypeLabel(t)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className={ui.grid2}>
        <Field label="Monto total" htmlFor={`${id}-total`} error={error}>
          <Input id={`${id}-total`} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" autoComplete="off" aria-invalid={!!error || undefined} />
        </Field>
        <Field
          label="Precio por unidad"
          htmlFor={`${id}-price`}
          hint={units !== null ? `= ${formatNumber(units, units < 1 ? 8 : 4)} unidades` : (known?.assetType ?? assetType) === "bond" ? "Bonos: precio por 1 de nominal (cotización ÷ 100)" : undefined}
        >
          <Input id={`${id}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" autoComplete="off" />
        </Field>
      </div>

      <div className={ui.grid2}>
        <Field label="Moneda" htmlFor={`${id}-cur`}>
          <Select id={`${id}-cur`} name="currency" defaultValue={initial?.currency ?? "USD"}>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </Select>
        </Field>
        <Field label="Fecha" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} name="date" type="date" defaultValue={initial?.date ?? todayKey()} required />
        </Field>
      </div>

      {platforms.length > 0 && (
        <Field label="Plataforma (opcional)" htmlFor={`${id}-platform`}>
          <Select id={`${id}-platform`} name="platform_id" defaultValue={initial?.platform_id ?? ""}>
            <option value="">Sin plataforma</option>
            {platforms.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Notas (opcional)" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </Field>

      <Button type="submit" variant={initial ? "primary" : "accent"} size="lg" block loading={saving}>
        {initial ? "Guardar cambios" : "Guardar operación"}
      </Button>
    </form>
  );
}
