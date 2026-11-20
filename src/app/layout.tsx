import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Mona_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Free stand-ins for the COSRX AR UI Kit's licensed faces, picked side by side
// against the originals: Hanken Grotesk for Maison Neue, Mona Sans for Maison
// Neue Extended (expanded for titles, bold at normal width for key figures).
const texto = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const display = Mona_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mona",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Platita",
  description: "Tu plata, en un solo lugar",
  icons: { icon: "/platita-favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141213" },
  ],
};

// Runs before first paint, so a hidden amount never flashes. The preference
// lives in localStorage; the read is guarded because storage can throw in
// private windows.
const prefsScript = `(function(){try{var d=document.documentElement;if(localStorage.getItem("platita-show-money")==="false")d.dataset.money="hidden";localStorage.removeItem("platita-chart-currency");}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-AR"
      className={`${texto.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
