import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { expireStaleOrders } from "@/lib/orders";
import { ORDER_STATUS_LABEL, RX_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { STORE, fullAddress, whatsappLink } from "@/lib/site";
import { PixBox } from "./PixBox";
import { RxUploadForm } from "./RxUploadForm";
import { retryWithPix, simulatePayment } from "./actions";
import { IconCheck } from "@/components/icons";

export const metadata: Metadata = { title: "Acompanhar pedido", robots: { index: false, follow: false } };

export default async function PedidoPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ falha?: string; simular?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  await expireStaleOrders();
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } }, history: { orderBy: { createdAt: "asc" } }, prescription: true },
  });
  if (!order) notFound();

  const pending = order.payments.find((p) => p.status === "PENDENTE");
  const approved = order.payments.find((p) => p.status === "APROVADO" || p.status.startsWith("ESTORNADO"));
  const isMock = env().PAYMENT_PROVIDER === "mock";
  const waitingPayment = order.status === "AGUARDANDO_PAGAMENTO";
  const needsRxUpload = order.prescription && (order.status === "AGUARDANDO_RECEITA" || order.status === "RECEITA_PENDENTE");

  return (
    <div className="conteudo py-8 max-w-4xl">
      <p className="text-suave">Pedido #{order.number} · {fmtDateTime(order.createdAt)}</p>
      <h1 className="text-4xl mt-1">
        {waitingPayment ? "Falta pouco!" : order.status === "CANCELADO" ? "Pedido cancelado" : "Obrigado pela compra!"}
      </h1>
      <p className="mt-2 text-lg" role="status">
        Status: <strong>{ORDER_STATUS_LABEL[order.status]}</strong>
      </p>

      <div className="mt-6 space-y-6">
        {sp.falha && waitingPayment && (
          <div role="alert" className="cartao p-4 border-2 border-promo">
            <p className="font-semibold">O pagamento com cartão não foi concluído.</p>
            <p className="text-suave">Você pode tentar de novo pelo mesmo link ou pagar com Pix.</p>
          </div>
        )}

        {waitingPayment && pending?.method === "PIX" && pending.pixCode && pending.pixQrBase64 && pending.expiresAt && (
          <PixBox token={token} code={pending.pixCode} qrBase64={pending.pixQrBase64} expiresAt={pending.expiresAt.toISOString()} />
        )}

        {waitingPayment && pending?.method === "CARTAO" && pending.checkoutUrl && (
          <div className="cartao p-5">
            <h2 className="text-2xl">Pagamento com cartão</h2>
            <p className="mt-1 text-suave">Se você ainda não concluiu o pagamento, continue no ambiente seguro do Mercado Pago.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {!isMock && <a href={pending.checkoutUrl} className="btn btn-primario">Continuar pagamento</a>}
              <form action={retryWithPix}>
                <input type="hidden" name="token" value={token} />
                <button className="btn btn-secundario">Pagar com Pix</button>
              </form>
            </div>
          </div>
        )}

        {isMock && waitingPayment && pending && (
          <form action={simulatePayment} className="cartao p-4 border-2 border-dashed border-alerta bg-[#fff8e6]">
            <input type="hidden" name="token" value={token} />
            <p className="font-semibold">Modo de teste (pagamentos simulados)</p>
            <p className="text-sm text-suave">Este botão só existe com PAYMENT_PROVIDER=mock e nunca aparece em produção.</p>
            <button className="btn btn-secundario btn-pequeno mt-2">Simular pagamento aprovado</button>
          </form>
        )}

        {needsRxUpload && (
          <section className="cartao p-5 border-2 border-marca" aria-labelledby="titulo-receita">
            <h2 id="titulo-receita" className="text-2xl">
              {order.status === "RECEITA_PENDENTE" ? "Precisamos de uma correção na receita" : "Envie sua receita"}
            </h2>
            {order.prescription?.reason && <p className="mt-2"><strong>Motivo:</strong> {order.prescription.reason}</p>}
            <p className="text-suave mt-1 mb-4">Seu pedido só entra em produção depois que a receita for conferida.</p>
            <RxUploadForm token={token} />
          </section>
        )}

        {order.prescription && !needsRxUpload && (
          <p className="cartao p-4 bg-gelo">
            Receita: <strong>{order.prescription.sendLater && order.prescription.fileKeys.length === 0 ? "a enviar" : RX_STATUS_LABEL[order.prescription.status]}</strong>
          </p>
        )}

        {order.status === "PRONTO_RETIRADA" && order.pickupCode && (
          <div className="cartao p-5 border-2 border-sucesso">
            <h2 className="text-2xl">Pronto para retirada!</h2>
            <p className="mt-1">Código de retirada: <strong className="text-2xl tracking-widest">{order.pickupCode}</strong></p>
            <p className="text-suave">{fullAddress()} · Leve um documento com foto. Guardamos por {STORE.pickupDays} dias.</p>
          </div>
        )}

        <section className="cartao p-5" aria-labelledby="titulo-itens-pedido">
          <h2 id="titulo-itens-pedido" className="text-2xl">Itens</h2>
          <ul className="mt-3 space-y-2">
            {order.items.map((i) => {
              const lc = i.lensConfig as null | { lens: { name: string; index: string }; treatments: { name: string }[] };
              return (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.quantity}× {i.name}{i.variantName ? ` (${i.variantName})` : ""}
                    {lc && <span className="block text-sm text-suave">Lentes {lc.lens.name} {lc.lens.index}{lc.treatments.length ? ` + ${lc.treatments.map((t) => t.name).join(", ")}` : ""}</span>}
                  </span>
                  <span className="whitespace-nowrap">{formatBRL(i.unitCents * i.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 pt-3 border-t border-contorno space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(order.subtotalCents)}</dd></div>
            {order.discountCents > 0 && <div className="flex justify-between text-sucesso"><dt>Desconto</dt><dd>- {formatBRL(order.discountCents)}</dd></div>}
            <div className="flex justify-between"><dt>{order.fulfillment === "RETIRADA" ? "Retirada na loja" : "Entrega"}</dt><dd>{order.shippingCents === 0 ? "Grátis" : formatBRL(order.shippingCents)}</dd></div>
            <div className="flex justify-between text-xl font-bold"><dt>Total</dt><dd>{formatBRL(order.totalCents)}</dd></div>
          </dl>
          {approved && (
            <p className="mt-2 text-suave text-sm">
              Pago com {approved.method === "PIX" ? "Pix" : `cartão${approved.cardLast4 ? ` final ${approved.cardLast4}` : ""}${approved.installments > 1 ? ` em ${approved.installments}x` : ""}`}.
            </p>
          )}
        </section>

        <section className="cartao p-5" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico" className="text-2xl">Andamento</h2>
          <ol className="mt-3 space-y-3">
            {order.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <IconCheck className="w-5 h-5 text-sucesso mt-1 shrink-0" />
                <span><strong>{ORDER_STATUS_LABEL[h.status]}</strong> <span className="text-suave text-sm">· {fmtDateTime(h.createdAt)}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <p>
          Dúvidas?{" "}
          <a className="underline" href={whatsappLink(`Olá! Sobre o pedido #${order.number}.`)} target="_blank" rel="noopener noreferrer">
            Fale com a gente no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>{" "}
          ou ligue {STORE.phone}. <Link href="/" className="underline">Voltar à loja</Link>
        </p>
      </div>
    </div>
  );
}
