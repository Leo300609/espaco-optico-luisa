"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { placeOrder, type CheckoutState } from "./actions";
import { Field } from "@/components/Field";
import { formatBRL } from "@/lib/money";
import { IconCard, IconPix, IconStore, IconTruck } from "@/components/icons";

type Zone = { cepStart: string; cepEnd: string; name: string; priceCents: number; freeAboveCents: number | null; days: number };

const EYE_FIELDS: { key: string; label: string; help: string; placeholder: string }[] = [
  { key: "sphere", label: "Esférico", help: "Grau de miopia (-) ou hipermetropia (+)", placeholder: "-2,25" },
  { key: "cylinder", label: "Cilíndrico", help: "Astigmatismo, se houver", placeholder: "-0,75" },
  { key: "axis", label: "Eixo", help: "De 0 a 180", placeholder: "180" },
  { key: "addition", label: "Adição", help: "Para perto (multifocal)", placeholder: "+2,00" },
  { key: "dnp", label: "DNP (mm)", help: "Distância do centro do nariz à pupila", placeholder: "31" },
];

export function CheckoutForm(props: {
  customer: { name: string; email: string; phone: string } | null;
  address: { cep: string; street: string; number: string; complement: string; district: string; city: string; state: string } | null;
  needsRx: boolean;
  needsAddition: boolean;
  subtotalAfterDiscount: number;
  zones: Zone[];
  freeShippingCoupon: boolean;
  pixMinutes: number;
  maxInstallments: number;
  storeAddress: string;
  pickupDays: number;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, null);
  const [fulfillment, setFulfillment] = useState<"ENTREGA" | "RETIRADA">("RETIRADA");
  const [payment, setPayment] = useState<"PIX" | "CARTAO">("PIX");
  const [rxMode, setRxMode] = useState<"digitar" | "foto" | "depois" | "">("");
  const [cep, setCep] = useState(props.address?.cep ?? "");
  const errorRef = useRef<HTMLDivElement>(null);
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.error) errorRef.current?.focus();
  }, [state]);

  const zone = useMemo(() => {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return null;
    return props.zones.find((z) => d >= z.cepStart && d <= z.cepEnd) ?? null;
  }, [cep, props.zones]);

  const shipping =
    fulfillment === "RETIRADA" || props.freeShippingCoupon || !zone
      ? 0
      : zone.freeAboveCents != null && props.subtotalAfterDiscount >= zone.freeAboveCents
        ? 0
        : zone.priceCents;
  const total = props.subtotalAfterDiscount + shipping;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data)); // evita apagar o formulário em caso de erro
      }}
    >
      <div ref={errorRef} tabIndex={-1} aria-live="assertive" className="outline-none">
        {state?.error && (
          <div role="alert" className="cartao border-promo border-2 p-4">
            <p className="font-semibold text-promo">{state.error}</p>
            {Object.keys(fe).length > 0 && (
              <ul className="list-disc pl-5 mt-2 text-[0.97rem]">
                {Object.entries(fe).map(([k, v]) => <li key={k}>{v}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 1. Identificação */}
      <fieldset className="cartao p-5 md:p-6">
        <legend className="font-serif text-2xl text-marca-escuro px-1">1. Seus dados</legend>
        {!props.customer && (
          <p className="text-suave mb-3">
            Já tem conta? <Link href="/conta/entrar?voltar=/checkout" className="underline">Entrar</Link>. Ou siga como visitante.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="name" label="Nome completo" required autoComplete="name" defaultValue={props.customer?.name} error={fe.name} className="sm:col-span-2" />
          <Field id="email" label="E-mail" type="email" required autoComplete="email" defaultValue={props.customer?.email} error={fe.email} help="Enviaremos a confirmação e os avisos do pedido." />
          <Field id="phone" label="Celular com DDD" type="tel" required autoComplete="tel" inputMode="tel" defaultValue={props.customer?.phone} error={fe.phone} />
          <Field id="cpf" label="CPF" required inputMode="numeric" autoComplete="off" error={fe.cpf} help="Exigido pelo emissor do Pix e do cartão. Fica guardado criptografado." />
        </div>
      </fieldset>

      {/* 2. Recebimento */}
      <fieldset className="cartao p-5 md:p-6">
        <legend className="font-serif text-2xl text-marca-escuro px-1">2. Como quer receber</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["RETIRADA", "Retirar na loja", "Grátis · Suzano", IconStore],
            ["ENTREGA", "Receber em casa", "Suzano e região", IconTruck],
          ] as const).map(([v, t, s, Icon]) => (
            <label key={v} className={`cartao p-4 cursor-pointer border-2 flex gap-3 ${fulfillment === v ? "border-marca bg-gelo" : ""}`}>
              <input type="radio" name="fulfillment" value={v} checked={fulfillment === v} onChange={() => setFulfillment(v)} className="w-5 h-5 mt-1 accent-marca" />
              <Icon className="w-7 h-7 text-marca shrink-0" />
              <span><span className="block font-semibold">{t}</span><span className="text-suave">{s}</span></span>
            </label>
          ))}
        </div>
        {fulfillment === "RETIRADA" ? (
          <div className="mt-4 text-[0.97rem] space-y-1">
            <p><strong>Endereço:</strong> {props.storeAddress}</p>
            <p>Avisaremos por e-mail quando estiver pronto. Leve um documento com foto e o código de retirada. Guardamos o pedido por {props.pickupDays} dias.</p>
          </div>
        ) : (
          <div className="mt-4 grid sm:grid-cols-6 gap-4">
            <Field id="cep" label="CEP" required inputMode="numeric" autoComplete="postal-code" value={cep} onChange={(e) => setCep(e.target.value)} error={fe.cep}
              help={zone ? `${zone.name}: ${shipping === 0 ? "grátis" : formatBRL(shipping)}, até ${zone.days} dias úteis` : cep.replace(/\D/g, "").length === 8 ? "CEP fora da área de entrega" : undefined}
              className="sm:col-span-2" />
            <Field id="street" label="Rua" required autoComplete="address-line1" defaultValue={props.address?.street} error={fe.street} className="sm:col-span-4" />
            <Field id="number" label="Número" required defaultValue={props.address?.number} error={fe.number} className="sm:col-span-2" />
            <Field id="complement" label="Complemento" autoComplete="address-line2" defaultValue={props.address?.complement} className="sm:col-span-4" />
            <Field id="district" label="Bairro" required defaultValue={props.address?.district} error={fe.district} className="sm:col-span-3" />
            <Field id="city" label="Cidade" required autoComplete="address-level2" defaultValue={props.address?.city ?? "Suzano"} error={fe.city} className="sm:col-span-2" />
            <Field id="state" label="UF" required maxLength={2} autoComplete="address-level1" defaultValue={props.address?.state ?? "SP"} error={fe.state} />
            <Field id="reference" label="Ponto de referência" className="sm:col-span-6" />
            {props.customer && (
              <label className="sm:col-span-6 flex items-center gap-2"><input type="checkbox" name="saveAddress" className="w-5 h-5 accent-marca" /> Salvar este endereço na minha conta</label>
            )}
          </div>
        )}
      </fieldset>

      {/* 3. Receita */}
      {props.needsRx && (
        <fieldset className="cartao p-5 md:p-6">
          <legend className="font-serif text-2xl text-marca-escuro px-1">3. Receita</legend>
          <p className="text-suave mb-3">
            Alguns itens exigem receita. O site não indica grau: registramos o que está na sua receita e nossa equipe confere antes da produção.
          </p>
          <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-describedby={fe.rxMode ? "rxmode-erro" : undefined}>
            {([
              ["digitar", "Digitar valores", "e anexar a foto (recomendado)"],
              ["foto", "Só anexar a foto", "ou o PDF da receita"],
              ["depois", "Enviar depois", "pelo site, WhatsApp ou na loja"],
            ] as const).map(([v, t, s]) => (
              <label key={v} className={`cartao p-4 cursor-pointer border-2 ${rxMode === v ? "border-marca bg-gelo" : ""}`}>
                <input type="radio" name="rxMode" value={v} checked={rxMode === v} onChange={() => setRxMode(v)} className="w-5 h-5 accent-marca mr-2 align-middle" />
                <span className="font-semibold">{t}</span>
                <span className="block text-suave text-sm mt-1">{s}</span>
              </label>
            ))}
          </div>
          {fe.rxMode && <p id="rxmode-erro" className="erro">{fe.rxMode}</p>}

          {rxMode === "digitar" && (
            <div className="mt-5 overflow-x-auto">
              <table className="tabela min-w-[640px]">
                <caption className="text-left pb-2 text-suave">Use vírgula ou ponto. Deixe em branco o que não constar na receita.</caption>
                <thead>
                  <tr><th scope="col">Olho</th>{EYE_FIELDS.map((f) => <th key={f.key} scope="col">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {(["od", "oe"] as const).map((eye) => (
                    <tr key={eye}>
                      <th scope="row">{eye === "od" ? "Direito (OD)" : "Esquerdo (OE)"}</th>
                      {EYE_FIELDS.map((f) => {
                        const id = `${eye}_${f.key}`;
                        const err = fe[`rx_${eye}_${f.key}`];
                        return (
                          <td key={f.key}>
                            <label htmlFor={id} className="sr-only">{f.label} do olho {eye === "od" ? "direito" : "esquerdo"} — {f.help}</label>
                            <input id={id} name={id} inputMode="decimal" placeholder={f.placeholder} className="campo min-h-11"
                              aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-erro` : undefined} />
                            {err && <p id={`${id}-erro`} className="erro text-sm">{err}</p>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {props.needsAddition && <p className="ajuda">Suas lentes exigem a <strong>adição</strong> nos dois olhos.</p>}
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <Field id="totalDp" label="DP total (se só tiver esse valor)" inputMode="decimal" placeholder="62" />
                <Field id="doctorName" label="Profissional que prescreveu" />
                <Field id="issuedAt" label="Data da receita" type="date" />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer underline">O que é DNP e como encontrar?</summary>
                <p className="mt-2 text-suave max-w-prose">
                  DNP é a distância, em milímetros, do centro do nariz até o centro de cada pupila. Costuma aparecer na receita como
                  &quot;DNP&quot; ou &quot;DP&quot;. Se não constar, não tem problema: medimos na loja ou combinamos pelo WhatsApp.
                </p>
              </details>
              {props.needsAddition && (
                <label className="flex items-center gap-2 mt-3"><input type="checkbox" name="heightAtStore" className="w-5 h-5 accent-marca" /> Prefiro medir a altura de montagem na loja</label>
              )}
            </div>
          )}

          {(rxMode === "digitar" || rxMode === "foto") && (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="rxFiles" className="rotulo">Foto ou PDF da receita {rxMode === "foto" && <span className="text-promo" aria-hidden>*</span>}</label>
                <input id="rxFiles" name="rxFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="campo py-2.5" aria-describedby="rxFiles-ajuda" aria-invalid={fe.rxFiles ? true : undefined} />
                <p id="rxFiles-ajuda" className="ajuda">Até 2 arquivos de 10 MB. Fotografe com boa luz, a receita inteira enquadrada e sem reflexo.</p>
                {fe.rxFiles && <p className="erro">{fe.rxFiles}</p>}
              </div>
              <div>
                <label htmlFor="rxNotes" className="rotulo">Observações sobre a receita</label>
                <textarea id="rxNotes" name="rxNotes" maxLength={500} className="campo" />
              </div>
              <label className={`flex items-start gap-3 cartao p-4 ${fe.consentHealth ? "border-promo border-2" : "bg-gelo"}`}>
                <input type="checkbox" name="consentHealth" className="w-5 h-5 mt-1 accent-marca" aria-describedby={fe.consentHealth ? "consent-erro" : undefined} />
                <span>
                  <strong>Autorizo o tratamento da minha receita</strong> (dado de saúde) exclusivamente para conferência, produção e
                  entrega das lentes deste pedido. Ela fica criptografada, acessível só à equipe autorizada e é eliminada conforme a{" "}
                  <Link href="/paginas/politica-de-privacidade" className="underline" target="_blank">política de privacidade</Link>.
                  {fe.consentHealth && <span id="consent-erro" className="erro block">{fe.consentHealth}</span>}
                </span>
              </label>
            </div>
          )}
          {rxMode === "depois" && (
            <p className="mt-4 cartao bg-gelo p-4">
              Sem problemas! Depois do pagamento você recebe um link para enviar a receita. O pedido fica como
              &quot;aguardando receita&quot; e só entra em produção depois que ela for aprovada.
            </p>
          )}
        </fieldset>
      )}

      {/* 4. Pagamento */}
      <fieldset className="cartao p-5 md:p-6">
        <legend className="font-serif text-2xl text-marca-escuro px-1">{props.needsRx ? "4" : "3"}. Pagamento</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["PIX", "Pix", `QR Code ou copia e cola · válido por ${props.pixMinutes} min`, IconPix],
            ["CARTAO", "Cartão de crédito", `Em até ${props.maxInstallments}x no ambiente seguro do Mercado Pago`, IconCard],
          ] as const).map(([v, t, s, Icon]) => (
            <label key={v} className={`cartao p-4 cursor-pointer border-2 flex gap-3 ${payment === v ? "border-marca bg-gelo" : ""}`}>
              <input type="radio" name="payment" value={v} checked={payment === v} onChange={() => setPayment(v)} className="w-5 h-5 mt-1 accent-marca" />
              <Icon className="w-7 h-7 text-marca shrink-0" />
              <span><span className="block font-semibold">{t}</span><span className="text-suave text-sm">{s}</span></span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className="rotulo">Observações do pedido (opcional)</label>
          <textarea id="notes" name="notes" maxLength={500} className="campo" />
        </div>
      </fieldset>

      {/* 5. Revisão */}
      <section className="cartao p-5 md:p-6" aria-labelledby="titulo-revisao">
        <h2 id="titulo-revisao" className="text-2xl">Revisão</h2>
        <dl className="mt-3 space-y-1">
          <div className="flex justify-between"><dt>Produtos (com descontos)</dt><dd>{formatBRL(props.subtotalAfterDiscount)}</dd></div>
          <div className="flex justify-between"><dt>Entrega</dt><dd>{fulfillment === "RETIRADA" ? "Retirada grátis" : zone ? (shipping === 0 ? "Grátis" : formatBRL(shipping)) : "informe o CEP"}</dd></div>
        </dl>
        <p className="mt-3 pt-3 border-t border-contorno flex justify-between text-2xl font-bold" aria-live="polite">
          <span>Total</span><span>{formatBRL(total)}</span>
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="acceptTerms" className="w-5 h-5 mt-1 accent-marca" aria-invalid={fe.acceptTerms ? true : undefined} />
            <span>
              Li e aceito os <Link href="/paginas/termos-de-uso" className="underline" target="_blank">termos de uso</Link> e a{" "}
              <Link href="/paginas/politica-de-privacidade" className="underline" target="_blank">política de privacidade</Link>.
              {fe.acceptTerms && <span className="erro block">{fe.acceptTerms}</span>}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="w-5 h-5 mt-1 accent-marca" />
            <span>Quero receber novidades e promoções por e-mail (opcional; você pode cancelar quando quiser).</span>
          </label>
        </div>
        <button type="submit" className="btn btn-primario w-full mt-5 text-lg" disabled={pending}>
          {pending ? "Processando…" : payment === "PIX" ? `Gerar Pix de ${formatBRL(total)}` : `Pagar ${formatBRL(total)} com cartão`}
        </button>
      </section>
    </form>
  );
}
