"use client";

import Link from "next/link";

/** Mensagem genérica ao cliente: detalhes técnicos nunca aparecem na tela (OWASP: configuração incorreta). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="conteudo" className="conteudo py-20 text-center">
      <h1 className="text-4xl">Algo deu errado</h1>
      <p className="mt-3 text-suave">Tente novamente em instantes. Se continuar, fale com a gente pelo WhatsApp (11) 95050-5009.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primario">Tentar de novo</button>
        <Link href="/" className="btn btn-secundario">Ir para o início</Link>
      </div>
    </main>
  );
}
