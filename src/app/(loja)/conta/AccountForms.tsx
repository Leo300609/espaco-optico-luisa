"use client";

import { useActionState } from "react";
import { changePassword, requestDeletion, updateProfile, type FormState } from "./actions";
import { Field } from "@/components/Field";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return <p role={s.error ? "alert" : "status"} className={s.error ? "erro" : "text-sucesso"}>{s.error ?? s.message}</p>;
}

export function AccountForms({ name, phone, marketing }: { name: string; phone: string; marketing: boolean }) {
  const [p, pAction, pPending] = useActionState<FormState, FormData>(updateProfile, null);
  const [s, sAction, sPending] = useActionState<FormState, FormData>(changePassword, null);
  const [d, dAction, dPending] = useActionState<FormState, FormData>(requestDeletion, null);

  return (
    <div className="mt-10 grid lg:grid-cols-2 gap-6">
      <section className="cartao p-6" aria-labelledby="t-dados">
        <h2 id="t-dados" className="text-2xl">Meus dados</h2>
        <form action={pAction} className="mt-4 space-y-4">
          <Field id="perfil-nome" name="name" label="Nome completo" defaultValue={name} required />
          <Field id="perfil-tel" name="phone" label="Celular" type="tel" defaultValue={phone} />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" defaultChecked={marketing} className="w-5 h-5 mt-1 accent-marca" />
            <span>Receber novidades e promoções por e-mail</span>
          </label>
          <Msg s={p} />
          <button className="btn btn-primario" disabled={pPending}>Salvar</button>
        </form>
      </section>

      <section className="cartao p-6" aria-labelledby="t-senha">
        <h2 id="t-senha" className="text-2xl">Alterar senha</h2>
        <form action={sAction} className="mt-4 space-y-4">
          <Field id="senha-atual" name="current" label="Senha atual" type="password" autoComplete="current-password" required />
          <Field id="senha-nova" name="password" label="Nova senha" type="password" autoComplete="new-password" required help="Mínimo de 8 caracteres." />
          <Msg s={s} />
          <button className="btn btn-secundario" disabled={sPending}>Alterar senha</button>
        </form>
      </section>

      <section className="cartao p-6 lg:col-span-2" aria-labelledby="t-privacidade">
        <h2 id="t-privacidade" className="text-2xl">Privacidade e seus dados (LGPD)</h2>
        <p className="mt-2 text-suave max-w-prose">
          Você pode baixar uma cópia dos seus dados a qualquer momento e pedir a exclusão da conta. Dados de pedidos são
          mantidos pelo prazo exigido em lei e depois anonimizados.
        </p>
        <a href="/api/conta/exportar" className="btn btn-secundario mt-4">Baixar meus dados (JSON)</a>
        <form action={dAction} className="mt-6 space-y-3 border-t border-contorno pt-5">
          <h3 className="font-sans font-semibold text-lg">Solicitar exclusão da conta</h3>
          <label htmlFor="exclusao-detalhes" className="rotulo">Algo que devemos saber? (opcional)</label>
          <textarea id="exclusao-detalhes" name="details" maxLength={500} className="campo" />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirm" className="w-5 h-5 mt-1 accent-marca" />
            <span>Entendo que, após o atendimento, perderei o acesso à conta, ao histórico e às receitas guardadas.</span>
          </label>
          <Msg s={d} />
          <button className="btn btn-perigo" disabled={dPending}>Solicitar exclusão</button>
        </form>
      </section>
    </div>
  );
}
