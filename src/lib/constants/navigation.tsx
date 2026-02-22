import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

function Icon({ children, ...props }: { children: ReactNode } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

const Home = () => (
  <Icon>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Icon>
);

const CircleMinus = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </Icon>
);

const CirclePlus = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </Icon>
);

const Landmark = () => (
  <Icon>
    <line x1="3" x2="21" y1="22" y2="22" />
    <line x1="6" x2="6" y1="18" y2="11" />
    <line x1="10" x2="10" y1="18" y2="11" />
    <line x1="14" x2="14" y1="18" y2="11" />
    <line x1="18" x2="18" y1="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </Icon>
);

const BarChart = () => (
  <Icon>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </Icon>
);

const Sliders = () => (
  <Icon>
    <line x1="21" x2="14" y1="4" y2="4" />
    <line x1="10" x2="3" y1="4" y2="4" />
    <line x1="21" x2="12" y1="12" y2="12" />
    <line x1="8" x2="3" y1="12" y2="12" />
    <line x1="21" x2="16" y1="20" y2="20" />
    <line x1="12" x2="3" y1="20" y2="20" />
    <line x1="14" x2="14" y1="2" y2="6" />
    <line x1="8" x2="8" y1="10" y2="14" />
    <line x1="16" x2="16" y1="18" y2="22" />
  </Icon>
);

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <Home /> },
  { label: "Gastos", href: "/dashboard/expenses", icon: <CircleMinus /> },
  { label: "Ingresos", href: "/dashboard/income", icon: <CirclePlus /> },
  { label: "Patrimonio", href: "/dashboard/patrimony", icon: <Landmark /> },
  { label: "Inversiones", href: "/dashboard/investments", icon: <BarChart /> },
  { label: "Ajustes", href: "/dashboard/settings", icon: <Sliders /> },
];
