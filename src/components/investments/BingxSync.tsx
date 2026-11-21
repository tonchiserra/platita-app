"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import s from "./investments.module.css";

/**
 * The browser half of the BingX sync. The work happens in /api/bingx/sync,
 * with the user's session. This file only decides when to ask.
 */

interface SyncResult {
  inserted?: number;
  /** Left out because they were already typed by hand. */
  duplicates?: number;
  skipped?: boolean;
  connected?: boolean;
  error?: string;
}

/** An automatic sync waits this long after the last attempt. */
const STALE_MS = 10 * 60_000;

// Module state, not component state: one request at a time per tab, whoever
// asks (the layout's auto sync, the Trading button, the Ajustes button), and
// StrictMode's double effect can't fire two.
let inFlight: Promise<SyncResult> | null = null;
let lastAttempt = 0;

/** Exported for Ajustes: a new or replaced key syncs at once, which is when "todas las operaciones" should show up. */
export function requestSync(force: boolean): Promise<SyncResult> {
  inFlight ??= fetch("/api/bingx/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  })
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as SyncResult;
      return res.ok ? body : { error: body.error ?? "No se pudo sincronizar. Probá de nuevo en un rato." };
    })
    .catch(() => ({ error: "No hay conexión. Probá de nuevo." }))
    .finally(() => {
      inFlight = null;
      lastAttempt = Date.now();
    });
  return inFlight;
}

function autoSync(lastSyncAt: number, onNew: () => void) {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - Math.max(lastAttempt, lastSyncAt) < STALE_MS) return;
  requestSync(false).then((r) => {
    if (r.inserted) onNew();
  });
}

/**
 * Mounted by the dashboard layout when there is a connection. Syncs on open
 * and whenever the tab comes back to the foreground: on the phone the app
 * stays open in the background and never mounts again. Silent on failure. The
 * error is stored and shown in Trading and Ajustes.
 */
export function BingxAutoSync({ lastSyncAt }: { lastSyncAt: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const last = lastSyncAt ? Date.parse(lastSyncAt) : 0;
    const run = () => autoSync(last, () => startTransition(() => router.refresh()));
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [lastSyncAt, router]);

  return null;
}

/** «BingX · sincronizado hace 3 min» and the button that syncs now. */
export function BingxSyncBar({ status, error }: { status: string; error: string | null }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; failed: boolean } | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    const r = await requestSync(true);
    setBusy(false);
    if (r.error) return setResult({ text: r.error, failed: true });
    if (r.connected === false) return setResult({ text: "No hay una key de BingX conectada.", failed: true });
    const n = r.inserted ?? 0;
    const d = r.duplicates ?? 0;
    const text = n === 0 ? "No hay operaciones nuevas." : n === 1 ? "Entró 1 operación nueva." : `Entraron ${n} operaciones nuevas.`;
    const skipped = d === 0 ? "" : d === 1 ? " 1 ya estaba cargada a mano." : ` ${d} ya estaban cargadas a mano.`;
    setResult({ text: text + skipped, failed: false });
    startTransition(() => router.refresh());
  }

  const failed = result ? result.failed : !!error;
  const text = result?.text ?? error ?? status;

  return (
    <div className={s.syncBar}>
      <p className={s.syncStatus} data-failed={failed || undefined} role="status" key={text}>
        {text}
      </p>
      <Button variant="ghost" size="sm" onClick={sync} loading={busy || refreshing}>
        {!(busy || refreshing) && <Icon name="sync" size={16} />} Sincronizar
      </Button>
    </div>
  );
}
