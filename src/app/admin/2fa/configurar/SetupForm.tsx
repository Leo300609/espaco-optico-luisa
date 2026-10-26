"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmTotpSetup, type ConfirmState } from "../../auth-actions";
import { Field } from "@/components/Field";

export function SetupForm({ qr, secretMasked, secretEnc }: { qr: string; secretMasked: string; secretEnc: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmTotpSetup, null);

  if (state?.codes) {
    return (
      <div className="mt-5 space-y-4">
        <p role="status" className="text-sucesso font-semibold">Verificação em duas etapas ativada!</p>
        <p>
          Guarde estes <strong>códigos de recuperação</strong> em local seguro (papel ou gerenciador de senhas). Cada um
          funciona uma única vez, caso você perca o celular. Eles não serão mostrados de novo.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-lg bg-gelo p-4 rounded-lg" aria-label="Códigos de recuperação">
          {state.codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Link href="/admin" className="btn btn-primario w-full">Guardei os códigos, ir para o painel</Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <img src={qr} alt="QR Code para o aplicativo autenticador" width={240} height={240} className="mx-auto border border-contorno rounded-lg" />
      <p className="text-sm text-suave text-center">
        Não consegue ler? Digite no aplicativo a chave: <code className="font-mono text-texto">{secretMasked}</code>
      </p>
      <input type="hidden" name="secretEnc" value={secretEnc} />
      <Field id="code" label="Código de 6 números exibido no aplicativo" required inputMode="numeric" autoComplete="one-time-code" />
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      <button className="btn btn-primario w-full" disabled={pending}>{pending ? "Confirmando…" : "Ativar"}</button>
    </form>
  );
}
