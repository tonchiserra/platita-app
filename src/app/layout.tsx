import type { Metadata } from "next";
import { Archivo, Chivo, Chivo_Mono } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

// Display: Archivo carries a width axis — headline figures are set expanded so
// they read like a board rather than a paragraph.
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const ui = Chivo({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const mono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
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
    <html
      lang="es"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
