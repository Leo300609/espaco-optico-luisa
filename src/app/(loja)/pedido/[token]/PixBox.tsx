"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** QR Code + copia e cola, contador regressivo e atualização automática quando o pagamento é confirmado. */
export function PixBox({ token, code, qrBase64, expiresAt }: { token: string; code: string; qrBase64: string; expiresAt: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/pedido/${token}/status`, { cache: "no-store" });
        const data = (await res.json()) as { status?: string; paid?: boolean };
        if (!stop && (data.paid || data.status !== "AGUARDANDO_PAGAMENTO")) router.refresh();
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    const t = setInterval(poll, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [token, router]);

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");
  const minutesLeft = Math.ceil(left / 60000);

  return (
    <div className="cartao p-5 md:p-6 border-2 border-marca">
      <h2 className="text-2xl">Pague com Pix</h2>
      {left > 0 ? (
        <>
          <p className="mt-1">
            Tempo restante: <strong className="text-xl tabular-nums" aria-hidden>{mm}:{ss}</strong>
            <span className="sr-only">{minutesLeft} {minutesLeft === 1 ? "minuto" : "minutos"}</span>
          </p>
          <div className="mt-4 grid sm:grid-cols-[220px_1fr] gap-5 items-start">
            <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code do Pix. Se não conseguir ler, use o código copia e cola ao lado." className="w-[220px] h-[220px] bg-white border border-contorno rounded-lg p-2" />
            <div>
              <ol className="list-decimal pl-5 space-y-1 text-[0.97rem]">
                <li>Abra o app do seu banco e escolha Pix.</li>
                <li>Leia o QR Code ou cole o código abaixo.</li>
                <li>Confirme o pagamento. Esta página atualiza sozinha.</li>
              </ol>
              <label htmlFor="pix-code" className="rotulo mt-4">Código Pix copia e cola</label>
              <textarea id="pix-code" readOnly value={code} className="campo text-sm font-mono min-h-24" onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn-primario w-full mt-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  } catch {
                    (document.getElementById("pix-code") as HTMLTextAreaElement | null)?.select();
                  }
                }}
              >
                {copied ? "Copiado ✓" : "Copiar código Pix"}
              </button>
              <p aria-live="polite" className="sr-only">{copied ? "Código Pix copiado" : ""}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2">O prazo deste Pix terminou. Atualize a página para ver as opções.</p>
      )}
    </div>
  );
}
