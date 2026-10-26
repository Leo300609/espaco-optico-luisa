"use client";

import { useActionState } from "react";
import { verifySecondFactor, type AdminAuthState } from "../auth-actions";
import { Field } from "@/components/Field";

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<AdminAuthState, FormData>(verifySecondFactor, null);
  return (
    <form action={action} className="mt-5 space-y-4">
      <Field id="code" label="Código" required inputMode="numeric" autoComplete="one-time-code" autoFocus
        help="Perdeu o celular? Use um dos códigos de recuperação (formato XXXXX-XXXXX)." />
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      <button className="btn btn-primario w-full" disabled={pending}>{pending ? "Verificando…" : "Entrar"}</button>
    </form>
  );
}
