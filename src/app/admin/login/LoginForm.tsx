"use client";

import { useActionState } from "react";
import { adminSignIn, type AdminAuthState } from "../auth-actions";
import { Field } from "@/components/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState<AdminAuthState, FormData>(adminSignIn, null);
  return (
    <form action={action} className="mt-5 space-y-4">
      <Field id="email" label="E-mail" type="email" required autoComplete="username" />
      <Field id="password" label="Senha" type="password" required autoComplete="current-password" />
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      <button className="btn btn-primario w-full" disabled={pending}>{pending ? "Verificando…" : "Continuar"}</button>
    </form>
  );
}
