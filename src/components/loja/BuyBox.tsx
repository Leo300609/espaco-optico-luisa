"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCart, simulateShipping, subscribeStockAlert, type ActionState, type ShippingState } from "@/app/(loja)/carrinho/actions";
import { IconCheck, IconTruck } from "../icons";

type V = { id: string; label: string; available: number };

export function BuyBox({ variants, acceptsLenses, priceCents, requiresRx }: {
  variants: V[];
  acceptsLenses: boolean;
  priceCents: number;
  requiresRx: "NAO" | "SIM" | "OPCIONAL";
}) {
  const [variantId, setVariantId] = useState(variants.find((v) => v.available > 0)?.id ?? variants[0]?.id ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(addToCart, null);
  const [ship, shipAction, shipPending] = useActionState<ShippingState, FormData>(simulateShipping, null);
  const [alert, alertAction, alertPending] = useActionState<ActionState, FormData>(subscribeStockAlert, null);
  const selected = variants.find((v) => v.id === variantId);
  const soldOut = !selected || selected.available <= 0;

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        {variants.length > 1 ? (
          <fieldset>
            <legend className="rotulo">Escolha a opção</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <label key={v.id} className={`cursor-pointer rounded-lg border-2 px-4 min-h-11 flex items-center ${v.id === variantId ? "border-marca bg-gelo" : "border-contorno"} ${v.available <= 0 ? "opacity-60" : ""}`}>
                  <input type="radio" name="variantId" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="sr-only" />
                  {v.label}
                  {v.available <= 0 && <span className="ml-1 text-sm">(esgotado)</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <input type="hidden" name="variantId" value={variantId} />
        )}

        {selected && selected.available > 0 && selected.available <= 2 && (
          <p className="text-alerta font-semibold">Últimas {selected.available} unidades.</p>
        )}
        {requiresRx === "SIM" && <p className="ajuda">Este produto exige receita. Você poderá enviá-la na finalização da compra ou depois.</p>}

        {soldOut ? null : (
          <div className="flex flex-col sm:flex-row gap-3">
            {acceptsLenses && (
              <button type="submit" name="comLentes" value="1" className="btn btn-primario flex-1">
                Montar com lentes de grau
              </button>
            )}
            <button type="submit" disabled={pending} className={`btn flex-1 ${acceptsLenses ? "btn-secundario" : "btn-primario"}`}>
              {pending ? "Adicionando…" : acceptsLenses ? "Comprar só a armação" : "Adicionar ao carrinho"}
            </button>
          </div>
        )}
        <div aria-live="polite" className="min-h-6">
          {state?.ok && (
            <p className="flex items-center gap-2 text-sucesso font-semibold">
              <IconCheck className="w-5 h-5" /> {state.message} <Link href="/carrinho" className="underline">Ver carrinho</Link>
            </p>
          )}
          {state?.error && <p className="erro" role="alert">{state.error}</p>}
        </div>
      </form>

      {soldOut && selected && (
        <form action={alertAction} className="cartao p-4 space-y-2">
          <p className="font-semibold">Produto esgotado. Quer ser avisado quando chegar?</p>
          <input type="hidden" name="variantId" value={selected.id} />
          <label htmlFor="aviso-email" className="sr-only">Seu e-mail</label>
          <div className="flex gap-2">
            <input id="aviso-email" name="email" type="email" required autoComplete="email" placeholder="seu@email.com" className="campo" />
            <button className="btn btn-secundario shrink-0" disabled={alertPending}>Avise-me</button>
          </div>
          <p aria-live="polite" className={alert?.error ? "erro" : "text-sucesso"}>{alert?.error ?? alert?.message}</p>
        </form>
      )}

      <form action={shipAction} className="cartao p-4">
        <label htmlFor="cep-produto" className="rotulo flex items-center gap-2"><IconTruck className="w-5 h-5" /> Calcular entrega</label>
        <input type="hidden" name="subtotal" value={priceCents} />
        <div className="flex gap-2">
          <input id="cep-produto" name="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} className="campo" aria-describedby="cep-ajuda" />
          <button className="btn btn-secundario shrink-0" disabled={shipPending}>Calcular</button>
        </div>
        <p id="cep-ajuda" className="ajuda">Entregamos em Suzano e região. Retirada na loja é sempre grátis.</p>
        <div aria-live="polite">
          {ship?.error && <p className="erro">{ship.error}</p>}
          {ship?.result && (
            <p className="mt-2">
              <strong>{ship.result.zone}:</strong> {ship.result.price} · até {ship.result.days} {ship.result.days === 1 ? "dia útil" : "dias úteis"}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
