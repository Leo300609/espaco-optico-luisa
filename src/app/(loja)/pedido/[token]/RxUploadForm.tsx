"use client";

import Link from "next/link";
import { useActionState } from "react";
import { uploadPrescription, type UploadState } from "./actions";

export function RxUploadForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadPrescription, null);
  if (state?.ok) {
    return <p role="status" className="cartao p-4 bg-gelo text-sucesso font-semibold">Receita recebida! Nossa equipe vai conferir e avisar você por e-mail.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="rx-files" className="rotulo">Foto ou PDF da receita</label>
        <input id="rx-files" name="rxFiles" type="file" multiple required accept="image/jpeg,image/png,image/webp,application/pdf" className="campo py-2.5" aria-describedby="rx-files-ajuda" />
        <p id="rx-files-ajuda" className="ajuda">Até 2 arquivos de 10 MB, com boa luz e a receita inteira enquadrada.</p>
      </div>
      <div>
        <label htmlFor="rx-notes" className="rotulo">Observações (opcional)</label>
        <textarea id="rx-notes" name="rxNotes" maxLength={500} className="campo" />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="consentHealth" required className="w-5 h-5 mt-1 accent-marca" />
        <span>
          Autorizo o tratamento da minha receita (dado de saúde) somente para este pedido, conforme a{" "}
          <Link href="/paginas/politica-de-privacidade" className="underline">política de privacidade</Link>.
        </span>
      </label>
      {state?.error && <p className="erro" role="alert">{state.error}</p>}
      <button className="btn btn-primario" disabled={pending}>{pending ? "Enviando…" : "Enviar receita"}</button>
    </form>
  );
}
