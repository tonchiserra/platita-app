"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input, ui } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "El email o la contraseña no coinciden.",
  "Email not confirmed": "Confirmá tu email antes de entrar: te mandamos un link.",
  "User already registered": "Ya hay una cuenta con ese email.",
  "Password should be at least 6 characters": "La contraseña tiene que tener al menos 6 caracteres.",
};

/** Only paths inside the app, so the parameter can't send anyone off-site. */
function safeRedirect(value: string | null) {
  return value && value.startsWith("/dashboard") && !value.startsWith("//") ? value : "/dashboard";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("error") === "auth" ? "No pudimos validar el link. Probá de nuevo." : "");
  const [info, setInfo] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setLoading(true);
    setError("");
    setInfo("");
    const supabase = await createClient();
    const { data: result, error } =
      mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (error) {
      setError(MESSAGES[error.message] ?? error.message);
      setLoading(false);
      return;
    }
    if (mode === "register" && !result.session) {
      // Email confirmation is on: there is no session until the link is clicked.
      setInfo("Te mandamos un email para confirmar la cuenta.");
      setLoading(false);
      return;
    }
    router.push(safeRedirect(params.get("redirectTo")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={ui.stack}>
      <Field label="Email" htmlFor={`${id}-email`}>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" required placeholder="vos@mail.com" />
      </Field>
      <Field label="Contraseña" htmlFor={`${id}-password`} error={error || null}>
        <Input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          required
          aria-invalid={!!error || undefined}
        />
      </Field>
      {info && (
        <p role="status" className="muted">
          {info}
        </p>
      )}
      <Button type="submit" size="lg" block loading={loading}>
        {mode === "login" ? "Entrar" : "Crear cuenta"}
      </Button>
      <p className="muted" style={{ fontSize: 14 }}>
        {mode === "login" ? (
          <>
            ¿No tenés cuenta?{" "}
            <Link href="/register" style={{ textDecoration: "underline", color: "var(--text)" }}>
              Registrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" style={{ textDecoration: "underline", color: "var(--text)" }}>
              Entrá
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
