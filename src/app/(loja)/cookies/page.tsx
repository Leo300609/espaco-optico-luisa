import type { Metadata } from "next";
import { CookiePreferences } from "./CookiePreferences";

export const metadata: Metadata = { title: "Preferências de cookies", robots: { index: false } };

export default function CookiesPage() {
  return (
    <div className="conteudo py-10 max-w-3xl">
      <h1 className="text-4xl">Preferências de cookies</h1>
      <p className="mt-2 text-suave">Escolha quais cookies opcionais podemos usar. Você pode mudar a qualquer momento.</p>
      <CookiePreferences />
    </div>
  );
}
