"use client";

import { useActionState } from "react";
import { applyCoupon, type ActionState } from "./actions";

export function CouponForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(applyCoupon, null);
  return (
    <form action={action} className="mt-4">
      <label htmlFor="cupom" className="rotulo">Cupom de desconto</label>
      <div className="flex gap-2">
        <input id="cupom" name="code" defaultValue={current ?? ""} autoComplete="off" className="campo uppercase" aria-describedby="cupom-msg" />
        <button className="btn btn-secundario shrink-0" disabled={pending}>Aplicar</button>
      </div>
      <p id="cupom-msg" aria-live="polite" className={state?.error ? "erro" : "text-sucesso text-sm mt-1"}>
        {state?.error ?? state?.message}
      </p>
    </form>
  );
}
