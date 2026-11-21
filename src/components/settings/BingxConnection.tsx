"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Box, Button, Field, Input, Select, ui } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/client";
import { BingxSyncBar, requestSync } from "@/components/investments/BingxSync";
import { useWrite } from "@/lib/supabase/use-write";
import type { PlatformOption } from "@/components/movements/MovementForm";
import s from "./settings.module.css";

export interface BingxConnectionProps {
  id: string;
  keyHint: string;
  platformId: string | null;
  /** `Importa lo que cierres desde el 21 nov` or `Importa todo el historial…`. */
  importLabel: string;
  /** `Sincronizado hace 3 min`. */
  status: string;
  lastError: string | null;
  /** False when the stored secret is gone (migration 006): the key has to be pasted again. */
  hasSecret: boolean;
}

/** The step-by-step to create the key, and what Platita does and doesn't answer for. */
function KeyGuide() {
  return (
    <>
      <Box tone="grey" className={s.keyWarning}>
        <strong>Usá una API Key de SOLO LECTURA y nada más.</strong>
        <span>
          Platita solo lee tus operaciones cerradas: nunca opera, transfiere ni retira. Si la key tiene más permisos, Platita no la acepta.
        </span>
        <span>
          Platita no se hace responsable si cargás una API Key con más permisos (o se los agregás después en BingX) y por alguna razón se
          filtra y pasa algo con tu cuenta.
        </span>
      </Box>
      <ol className={s.steps}>
        <li>
          Entrá a BingX desde la web y abrí <strong>Perfil › Gestión de API</strong> (
          <a href="https://bingx.com/en/account/api" target="_blank" rel="noreferrer">
            abrir en BingX
          </a>
          ).
        </li>
        <li>
          Tocá <strong>Crear API</strong>, ponele un nombre (por ejemplo, «Platita») y completá la verificación de seguridad.
        </li>
        <li>
          En los permisos dejá marcado <strong>solo Lectura</strong>. No actives operar (spot ni futuros), transferencias ni retiros.
        </li>
        <li>No agregues restricción de IP: Platita no tiene una IP fija.</li>
        <li>
          Copiá la <strong>API Key</strong> y la <strong>Secret Key</strong> y pegalas acá abajo. BingX muestra la Secret una sola vez.
        </li>
      </ol>
    </>
  );
}

/**
 * The key goes to /api/bingx/connection, not through `useWrite`: the server
 * tries it against BingX, refuses it unless it is read-only, and stores the
 * secret in Supabase Vault. The secret is never read back.
 */
function ConnectForm({
  platforms,
  defaultPlatform,
  replacing,
  focus,
  onDone,
}: {
  platforms: PlatformOption[];
  defaultPlatform: string;
  replacing?: boolean;
  /** Focus the key field: only when the user asked for the form, never on page load. */
  focus?: boolean;
  onDone?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = {
      apiKey: String(data.get("apiKey") ?? "").trim(),
      apiSecret: String(data.get("apiSecret") ?? "").trim(),
      platformId: String(data.get("platformId") ?? "") || null,
      importFrom: data.get("importFrom"),
      accepted: data.get("accepted") === "on",
    };
    if (!body.apiKey || !body.apiSecret) return setError("Completá la API Key y la Secret Key.");
    if (!replacing && !body.importFrom) return setError("Elegí qué operaciones sincronizar.");
    if (!body.accepted) return setError("Confirmá que la key es de solo lectura.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bingx/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setError(json.error ?? "No se pudo conectar. Probá de nuevo.");
      startTransition(() => router.refresh());
      onDone?.();
      // Sync now rather than waiting for the next automatic one: with "todas las
      // operaciones" this is when the history should appear. Refresh again when done.
      requestSync(true).then(() => startTransition(() => router.refresh()));
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={s.inlineForm} onSubmit={onSubmit} noValidate>
      <KeyGuide />
      <Field label="API Key" htmlFor={`${id}-key`} hint="Tiene que ser de solo lectura.">
        <Input id={`${id}-key`} name="apiKey" autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus={focus} />
      </Field>
      {/* new-password keeps the browser from offering the Platita login here. */}
      <Field label="Secret Key" htmlFor={`${id}-secret`}>
        <Input id={`${id}-secret`} name="apiSecret" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
      </Field>
      {!replacing && (
        <>
          <Field label="Plataforma" htmlFor={`${id}-pl`} hint="Se asigna a las operaciones importadas.">
            <Select id={`${id}-pl`} name="platformId" defaultValue={defaultPlatform}>
              <option value="">Sin plataforma</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className={s.choices}>
            <legend className={ui.label}>¿Qué operaciones sincronizamos?</legend>
            <label className={s.choice}>
              <input type="radio" name="importFrom" value="now" />
              <span className={s.choiceTitle}>A partir de ahora</span>
              <span className={s.choiceText}>Solo las que cierres desde hoy.</span>
            </label>
            <label className={s.choice}>
              <input type="radio" name="importFrom" value="all" />
              <span className={s.choiceTitle}>Todas las operaciones</span>
              <span className={s.choiceText}>También tu historial: todo lo que BingX tenga guardado.</span>
            </label>
            <p className={s.hint}>Las que ya cargaste a mano no se duplican.</p>
          </fieldset>
        </>
      )}
      <label className={s.check}>
        <input type="checkbox" name="accepted" />
        <span>Entiendo que la key tiene que ser de solo lectura y que Platita no se hace responsable si tiene más permisos y se filtra.</span>
      </label>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={ui.actions}>
        {onDone && replacing && (
          <Button variant="secondary" size="sm" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant={replacing ? "primary" : "accent"} size="sm" loading={saving || refreshing}>
          {replacing ? "Guardar key" : "Conectar"}
        </Button>
      </div>
    </form>
  );
}

export function BingxConnection({ connection, platforms }: { connection: BingxConnectionProps | null; platforms: PlatformOption[] }) {
  const id = useId();
  const [replacing, setReplacing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { run, saving, error } = useWrite();

  if (!connection) {
    const guess = platforms.find((p) => /bing\s*x/i.test(p.name))?.id ?? "";
    return (
      <div className={ui.stack} style={{ gap: 14 }}>
        <p className="muted">
          Las operaciones de futuros perpetuos que cierres en BingX entran solas al libro de Trading, con el resultado neto de comisiones y
          funding. Cada persona conecta su propia key.
        </p>
        <ConnectForm platforms={platforms} defaultPlatform={guess} />
      </div>
    );
  }

  const showForm = replacing || !connection.hasSecret;

  return (
    <div className={ui.stack} style={{ gap: 14 }}>
      <ul className={s.rows}>
        <li className={s.row}>
          <span className={s.rowLabel}>
            API Key
            <span className={s.rowHint}>{connection.importLabel}</span>
          </span>
          <span className={ui.row} style={{ gap: 8 }}>
            <Badge tone="up">Solo lectura</Badge>
            <span className={s.rowValue}>••••{connection.keyHint}</span>
          </span>
        </li>
        <li className={s.row}>
          <label className={s.rowLabel} htmlFor={`${id}-pl`}>
            Plataforma
            <span className={s.rowHint}>Para las operaciones que entren de ahora en más.</span>
          </label>
          <Select
            id={`${id}-pl`}
            key={connection.platformId ?? ""}
            className={s.rowSelect}
            defaultValue={connection.platformId ?? ""}
            disabled={saving}
            onChange={(e) => {
              const platform_id = e.currentTarget.value || null;
              run((supabase) => supabase.from("exchange_connections").update({ platform_id }).eq("id", connection.id));
            }}
          >
            <option value="">Sin plataforma</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </li>
      </ul>
      {connection.hasSecret ? (
        <BingxSyncBar status={connection.status} error={connection.lastError} />
      ) : (
        <p className={s.syncNotice} role="status">
          Cambiamos cómo se guardan las keys: volvé a pegar tu API Key y tu Secret Key. Lo ya importado y la fecha desde la que importa no cambian.
        </p>
      )}
      {error && <p className={ui.error}>{error}</p>}
      {showForm ? (
        <ConnectForm
          platforms={platforms}
          defaultPlatform={connection.platformId ?? ""}
          replacing
          focus={replacing}
          onDone={connection.hasSecret ? () => setReplacing(false) : undefined}
        />
      ) : (
        <div className={ui.row} style={{ gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
            Cambiar key
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDisconnecting(true)}>
            Desconectar
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={disconnecting}
        title="¿Desconectar BingX?"
        message="Se borra la key guardada y no entran más operaciones. Las que ya se importaron quedan en el libro."
        confirmLabel="Desconectar"
        loading={saving}
        onConfirm={async () => {
          const ok = await run((supabase) => supabase.from("exchange_connections").delete().eq("id", connection.id));
          if (ok) setDisconnecting(false);
        }}
        onClose={() => setDisconnecting(false)}
      />
    </div>
  );
}
