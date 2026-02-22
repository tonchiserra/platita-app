export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Gastos", href: "/dashboard/expenses", icon: "💸" },
  { label: "Ingresos", href: "/dashboard/income", icon: "💵" },
  { label: "Patrimonio", href: "/dashboard/patrimony", icon: "🏦" },
  { label: "Inversiones", href: "/dashboard/investments", icon: "📈" },
  { label: "Ajustes", href: "/dashboard/settings", icon: "⚙️" },
];
