import { Section } from "@/components/ui";
import { AccountSettings, CategoryManager, PlatformManager } from "@/components/settings/SettingsClient";
import { DataTransfer } from "@/components/settings/DataTransfer";
import { getCategoryRows, getPlatforms, getSession } from "@/lib/data";
import s from "@/components/settings/settings.module.css";

export const metadata = { title: "Ajustes · Platita" };

export default async function SettingsPage() {
  const [{ user }, platforms, categories] = await Promise.all([getSession(), getPlatforms(), getCategoryRows()]);

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
        <Section label="Respaldo" title="Tus datos">
          <DataTransfer />
        </Section>
      </div>
    </>
  );
}
