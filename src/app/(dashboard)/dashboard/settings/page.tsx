import { Section } from "@/components/ui";
import { AccountSettings, CategoryManager, PlatformManager } from "@/components/settings/SettingsClient";
import { DataTransfer } from "@/components/settings/DataTransfer";
import { BingxConnection } from "@/components/settings/BingxConnection";
import { getBingxConnection, getCategoryRows, getPlatforms, getSession } from "@/lib/data";
import { formatAgo, formatDayMonth, todayKey } from "@/lib/utils/format";
import s from "@/components/settings/settings.module.css";

export const metadata = { title: "Ajustes · Platita" };

export default async function SettingsPage() {
  const [{ user }, platforms, categories, bingx] = await Promise.all([getSession(), getPlatforms(), getCategoryRows(), getBingxConnection()]);
  const platformOptions = platforms.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <h1 className="h1">Ajustes</h1>
      <div className={s.groups}>
        <Section label="Vos" title="Cuenta">
          <AccountSettings email={user.email} />
        </Section>
        <Section label="Cuentas" title="Plataformas">
          <PlatformManager platforms={platforms} />
        </Section>
        <Section label="Gastos" title="Categorías">
          <CategoryManager categories={categories} />
        </Section>
        <Section id="bingx" label="Trading" title="BingX">
          <BingxConnection
            platforms={platformOptions}
            connection={
              bingx && {
                id: bingx.id,
                keyHint: bingx.keyHint,
                platformId: bingx.platform_id,
                importLabel: bingx.importsAll
                  ? "Importa todo el historial que guarda BingX."
                  : `Importa lo que cierres desde el ${formatDayMonth(todayKey(new Date(bingx.import_from)))}.`,
                status: bingx.last_sync_at ? `Sincronizado ${formatAgo(bingx.last_sync_at)}` : "Todavía no se sincronizó",
                lastError: bingx.last_error,
                hasSecret: bingx.hasSecret,
              }
            }
          />
        </Section>
        <Section label="Respaldo" title="Tus datos">
          <DataTransfer />
        </Section>
      </div>
    </>
  );
}
