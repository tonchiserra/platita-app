import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = { title: "Crear cuenta · Platita" };

export default function RegisterPage() {
  return <AuthShell mode="register" />;
}
