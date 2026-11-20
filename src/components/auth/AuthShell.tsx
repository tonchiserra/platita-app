import { Suspense } from "react";
import { LineLabel } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";
import { AuthForm } from "./AuthForm";
import s from "./auth.module.css";

export function AuthShell({ mode }: { mode: "login" | "register" }) {
  return (
    <main className={s.page}>
      <section className={s.intro}>
        <Logo height={32} />
        <div className={s.copy}>
          <LineLabel>{mode === "login" ? "Hola de nuevo" : "Empezá hoy"}</LineLabel>
          <h1 className={s.title}>Tu plata, en un solo lugar.</h1>
          <p className={s.lead}>Gastos, ingresos, inversiones y patrimonio. En pesos y en dólares, a la cotización de cada día.</p>
        </div>
      </section>
      <section className={s.formSide}>
        <div className={s.card}>
          <h2 className="h2">{mode === "login" ? "Entrar" : "Crear cuenta"}</h2>
          <Suspense>
            <AuthForm mode={mode} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
