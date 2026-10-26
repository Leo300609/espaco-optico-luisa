"use client";

import Link from "next/link";
import { useActionState, useState, startTransition } from "react";
import { signIn, signUp, type FormState } from "../actions";
import { Field } from "@/components/Field";

export function AuthForms({ voltar, startWithSignUp }: { voltar: string; startWithSignUp: boolean }) {
  const [mode, setMode] = useState<"in" | "up">(startWithSignUp ? "up" : "in");
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(signIn, null);
  const [upState, upAction, upPending] = useActionState<FormState, FormData>(signUp, null);
  const fe = upState?.fieldErrors ?? {};

  return (
    <div className="mt-6 grid md:grid-cols-2 gap-6">
      <section className={`cartao p-6 ${mode === "in" ? "border-2 border-marca" : ""}`} aria-labelledby="t-entrar">
        <h2 id="t-entrar" className="text-2xl">Já sou cliente</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            startTransition(() => inAction(d));
          }}
          onFocus={() => setMode("in")}
        >
          <input type="hidden" name="voltar" value={voltar} />
          <Field id="login-email" name="email" label="E-mail" type="email" required autoComplete="email" />
          <Field id="login-senha" name="password" label="Senha" type="password" required autoComplete="current-password" />
          {inState?.error && <p role="alert" className="erro">{inState.error}</p>}
          <button className="btn btn-primario w-full" disabled={inPending}>{inPending ? "Entrando…" : "Entrar"}</button>
          <p className="ajuda">Esqueceu a senha? Fale com a loja pelo WhatsApp para redefinir com segurança.</p>
        </form>
      </section>

      <section className={`cartao p-6 ${mode === "up" ? "border-2 border-marca" : ""}`} aria-labelledby="t-cadastro">
        <h2 id="t-cadastro" className="text-2xl">Quero criar uma conta</h2>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            startTransition(() => upAction(d));
          }}
          onFocus={() => setMode("up")}
        >
          <input type="hidden" name="voltar" value={voltar} />
          <Field id="cad-nome" name="name" label="Nome completo" required autoComplete="name" error={fe.name} />
          <Field id="cad-email" name="email" label="E-mail" type="email" required autoComplete="email" error={fe.email} />
          <Field id="cad-tel" name="phone" label="Celular (opcional)" type="tel" autoComplete="tel" error={fe.phone} />
          <Field id="cad-senha" name="password" label="Senha" type="password" required autoComplete="new-password" help="Mínimo de 8 caracteres." error={fe.password} />
          <Field id="cad-senha2" name="password2" label="Repita a senha" type="password" required autoComplete="new-password" error={fe.password2} />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="acceptTerms" className="w-5 h-5 mt-1 accent-marca" />
            <span>
              Aceito os <Link href="/paginas/termos-de-uso" className="underline">termos</Link> e a{" "}
              <Link href="/paginas/politica-de-privacidade" className="underline">política de privacidade</Link>.
              {fe.acceptTerms && <span className="erro block">{fe.acceptTerms}</span>}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="w-5 h-5 mt-1 accent-marca" />
            <span>Quero receber novidades e promoções (opcional).</span>
          </label>
          {upState?.error && <p role="alert" className="erro">{upState.error}</p>}
          <button className="btn btn-secundario w-full" disabled={upPending}>{upPending ? "Criando…" : "Criar conta"}</button>
        </form>
      </section>
    </div>
  );
}
