import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { BottomNav, SettingsLink, SideNav } from "@/components/shell/Nav";
import { QuickAdd } from "@/components/movements/QuickAdd";
import { BingxAutoSync } from "@/components/investments/BingxSync";
import { MoneyToggle } from "@/components/ui/client";
import { Money } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";
import { getBingxConnection, getCategories, getPlatforms, getRates, getSession } from "@/lib/data";
import s from "@/components/shell/shell.module.css";

function Wordmark() {
  return (
    <Link href="/dashboard" className={s.wordmark} aria-label="Platita, inicio">
      <Logo height={26} />
    </Link>
  );
}

async function QuickAddLoader({ variant }: { variant: "fab" | "sidebar" }) {
  const [categories, platforms] = await Promise.all([getCategories(), getPlatforms()]);
  return (
    <QuickAdd
      variant={variant}
      categories={categories}
      platforms={platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}

/** Only mounted with a connection, so users without one never call the sync route. */
async function BingxAutoSyncLoader() {
  const bingx = await getBingxConnection();
  return bingx ? <BingxAutoSync lastSyncAt={bingx.last_sync_at} /> : null;
}

async function SideRates() {
  const { blue, crypto } = await getRates();
  const rows = [
    blue && { label: "Dólar blue", value: <Money value={blue.venta} currency="ARS" decimals={0} /> },
    crypto?.bitcoin && { label: "Bitcoin", value: <Money value={crypto.bitcoin.usd} currency="USD" decimals={0} /> },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];
  if (rows.length === 0) return null;
  return (
    <div className={s.sideRates}>
      {rows.map((r) => (
        <div key={r.label} className={s.sideRate}>
          <span className="muted">{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();

  return (
    <div className={s.app}>
      <header className={s.header}>
        <Wordmark />
        <div className={s.headerActions}>
          <MoneyToggle />
          <SettingsLink />
        </div>
      </header>

      <aside className={s.sidebar} aria-label="Navegación">
        <Wordmark />
        <Suspense fallback={null}>
          <QuickAddLoader variant="sidebar" />
        </Suspense>
        <SideNav />
        <div className={s.sideFoot}>
          <Suspense fallback={null}>
            <SideRates />
          </Suspense>
          <div className={s.sideUser}>
            <span title={user.email}>{user.email}</span>
            <MoneyToggle />
          </div>
        </div>
      </aside>

      <main className={s.main}>
        {/* Each navigation swaps this through the View Transitions API (class "page" in motion.css). */}
        <ViewTransition default="page">
          <div className={s.content}>{children}</div>
        </ViewTransition>
        <footer className={s.footer}>
          © {new Date().getFullYear()} Platita · Hecho con 🤍 por{" "}
          <a href="https://gserra.netlify.app" target="_blank" rel="noreferrer">
            Gonzalo Serra
          </a>
        </footer>
      </main>

      <BottomNav />
      <Suspense fallback={null}>
        <QuickAddLoader variant="fab" />
      </Suspense>
      <Suspense fallback={null}>
        <BingxAutoSyncLoader />
      </Suspense>
    </div>
  );
}
