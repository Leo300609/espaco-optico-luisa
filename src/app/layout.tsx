import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Great_Vibes, Inter } from "next/font/google";
import "./globals.css";
import { STORE } from "@/lib/site";

// Fontes servidas pelo próprio site (next/font), sem enviar dados do visitante a terceiros.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script-luisa", display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${STORE.name} — Ótica em Suzano | Óculos de grau, de sol e lentes`,
    template: `%s | ${STORE.name} — Ótica em Suzano`,
  },
  description:
    "Ótica em Suzano/SP: armações, óculos de sol, lentes de contato e lentes de grau. Compre online com Pix ou cartão, retire grátis na loja ou receba em Suzano e região.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: STORE.name,
    images: [{ url: "/logo.png", width: 447, height: 447, alt: STORE.name }],
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#343A55",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
