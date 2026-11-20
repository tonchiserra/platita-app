import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = { title: "Entrar · Platita" };

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
