"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient, getSessionUser } from "./client";

type BrowserClient = Awaited<ReturnType<typeof createClient>>;

/** Postgres/PostgREST errors, in words a person can act on. */
export function explainError(error: { code?: string; message: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") return "Falta aplicar una migración de la base de datos (ver supabase/migrations).";
  if (error.code === "42703" || error.code === "PGRST204") return "La base todavía no tiene esta columna: aplicá la migración 004.";
  if (error.code === "23505") return "Ya existe un registro con ese nombre.";
  if (error.code === "23514") return "Algún valor no es válido (revisá montos y fechas).";
  if (error.code === "42501") return "No tenés permiso para hacer eso. Volvé a iniciar sesión.";
  if (/fetch|network/i.test(error.message)) return "No hay conexión. Probá de nuevo.";
  return error.message;
}

/**
 * Every write in the app: browser → Supabase in one hop, then a refresh of
 * the Server Components inside a transition, so the screen stays usable while
 * the fresh data streams in. RLS authorizes the write; `userId` only stamps it.
 */
export function useWrite() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(
    fn: (supabase: BrowserClient, userId: string) => PromiseLike<{ error: { code?: string; message: string } | null }>
  ): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
      if (!user) {
        setError("Tu sesión expiró. Volvé a iniciar sesión.");
        return false;
      }
      const { error } = await fn(supabase, user.id);
      if (error) {
        setError(explainError(error));
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch (e) {
      setError(explainError({ message: e instanceof Error ? e.message : String(e) }));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { run, saving, refreshing, busy: saving || refreshing, error, setError };
}
