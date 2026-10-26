"use client";

import Link from "next/link";
import { useActionState, startTransition } from "react";
import { sendContact, type ContactState } from "./actions";
import { Field } from "@/components/Field";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) {
    return <p role="status" className="cartao p-5 mt-6 bg-gelo text-lg">Mensagem enviada! Obrigado pelo contato, responderemos em breve.</p>;
  }
  return (
    <form
      className="mt-6 grid sm:grid-cols-2 gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {state?.error && <p role="alert" className="erro sm:col-span-2 font-semibold">{state.error}</p>}
      <Field id="name" label="Nome" required autoComplete="name" error={fe.name} />
      <Field id="email" label="E-mail" type="email" required autoComplete="email" error={fe.email} />
      <Field id="phone" label="Telefone (opcional)" type="tel" autoComplete="tel" />
      <Field id="subject" label="Assunto" required error={fe.subject} />
      <div className="sm:col-span-2">
        <label htmlFor="message" className="rotulo">Mensagem <span aria-hidden className="text-promo">*</span></label>
        <textarea id="message" name="message" required maxLength={3000} className="campo" aria-invalid={fe.message ? true : undefined} aria-describedby={fe.message ? "message-erro" : undefined} />
        {fe.message && <p id="message-erro" className="erro">{fe.message}</p>}
      </div>
      {/* Campo-armadilha invisível para robôs */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="website">Não preencha</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="sm:col-span-2 flex items-start gap-3">
        <input type="checkbox" name="consent" className="w-5 h-5 mt-1 accent-marca" />
        <span>
          Autorizo o uso destes dados somente para responder minha mensagem, conforme a{" "}
          <Link href="/paginas/politica-de-privacidade" className="underline">política de privacidade</Link>.
          {fe.consent && <span className="erro block">{fe.consent}</span>}
        </span>
      </label>
      <div className="sm:col-span-2">
        <button className="btn btn-primario" disabled={pending}>{pending ? "Enviando…" : "Enviar mensagem"}</button>
      </div>
    </form>
  );
}
