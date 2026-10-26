"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Faixa de consentimento (LGPD, capítulo 7.4). Três grupos: essenciais (sempre ativos),
 * estatísticas e marketing (desligados até o aceite). Aceitar e rejeitar têm o mesmo destaque.
 */
export const CONSENT_COOKIE = "eol_cookies";
export type CookieChoice = { v: string; estatisticas: boolean; marketing: boolean };
const VERSION = "2026-10-25";

export function readChoice(): CookieChoice | null {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw.split("=")[1] ?? "")) as CookieChoice;
    return parsed.v === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveChoice(estatisticas: boolean, marketing: boolean) {
  const value: CookieChoice = { v: VERSION, estatisticas, marketing };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${180 * 86400}; SameSite=Lax${secure}`;
  void fetch("/api/consentimento-cookies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estatisticas, marketing, versao: VERSION }),
  }).catch(() => {});
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(readChoice() === null), []);
  if (!show) return null;

  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 bg-white border-t-2 border-marca shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="conteudo py-4 md:flex md:items-center md:gap-6">
        <p className="text-[0.98rem] md:flex-1">
          Usamos cookies essenciais para o site funcionar (carrinho, login e segurança). Com a sua permissão, também
          usaríamos cookies de estatística e marketing. Você pode mudar a escolha quando quiser.{" "}
          <Link href="/paginas/politica-de-cookies" className="underline">
            Saiba mais
          </Link>
          .
        </p>
        <div className="mt-3 md:mt-0 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={() => {
              saveChoice(false, false);
              setShow(false);
            }}
          >
            Rejeitar opcionais
          </button>
          <Link href="/cookies" className="btn btn-secundario btn-pequeno">
            Personalizar
          </Link>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={() => {
              saveChoice(true, true);
              setShow(false);
            }}
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </section>
  );
}
