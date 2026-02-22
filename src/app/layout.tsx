import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Platita",
  description: "Tu balance personal, unificado",
  icons: {
    icon: "/platita-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={geist.className} suppressHydrationWarning>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
