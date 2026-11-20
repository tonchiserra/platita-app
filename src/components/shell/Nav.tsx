"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import s from "./shell.module.css";

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Inicio", icon: "home" },
  { href: "/dashboard/expenses", label: "Gastos", icon: "expense" },
  { href: "/dashboard/income", label: "Ingresos", icon: "income" },
  { href: "/dashboard/patrimony", label: "Patrimonio", icon: "patrimony" },
  { href: "/dashboard/investments", label: "Inversiones", icon: "investments" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className={s.sideNav}>
      {[...NAV, { href: "/dashboard/settings", label: "Ajustes", icon: "settings" as IconName }].map((item) => (
        <Link key={item.href} href={item.href} className={s.sideLink} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
          {/* Only the active link carries the pill, so it morphs from tab to tab. */}
          {isActive(pathname, item.href) && <span className={s.sideIndicator} aria-hidden="true" />}
          <Icon name={item.icon} size={20} />
          <span className={s.linkLabel}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className={s.bottomNav}>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={s.bottomLink} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
          {isActive(pathname, item.href) && <span className={s.bottomIndicator} aria-hidden="true" />}
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SettingsLink() {
  const pathname = usePathname();
  return (
    <Link
      href="/dashboard/settings"
      className={s.iconLink}
      aria-label="Ajustes"
      title="Ajustes"
      aria-current={pathname.startsWith("/dashboard/settings") ? "page" : undefined}
    >
      <Icon name="settings" size={22} />
    </Link>
  );
}
