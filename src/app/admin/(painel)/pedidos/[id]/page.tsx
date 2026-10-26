import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { allowedManualTransitions } from "@/lib/orders";
import { ORDER_STATUS_LABEL, RX_STATUS_LABEL, fmtDateTime, formatCep } from "@/lib/format";
import { formatBRL, centsToInput } from "@/lib/money";
import { decryptString, maskCpf } from "@/lib/crypto";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PrintButton } from "@/components/admin/PrintButton";
import { refundOrder, saveInternalNotes, updateStatus } from "../actions";

export const metadata = { title: "Pedido" };

type Addr = { cep: string; street: string; number: string; complement?: string; district: string; city: string; state: string; reference?: string };

export default async function PedidoAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireStaff("pedidos.ver");
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "asc" } },
      prescription: true,
      coupon: true,
    },
  });
  if (!order) notFound();
  const rxApproved = order.prescription?.status === "APROVADA";
  const transitions = allowedManualTransitions(order, rxApproved);
  const addr = order.address as Addr | null;
  const paid = order.payments.find((p) => p.status === "APROVADO" || p.status === "ESTORNADO_PARCIAL");
  const canUpdate = can(user.role, "pedidos.atualizar");
  const phone = order.customerPhone;

  return (
    <>
      <PageHeader
        title={`Pedido #${order.number}`}
        description={`Criado em ${fmtDateTime(order.createdAt)}`}
        action={<PrintButton />}
      />
      <Flash sp={await searchParams} />

      <div className="grid xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <section className="cartao p-5" aria-labelledby="t-situacao">
            <h2 id="t-situacao" className="text-2xl">Situação</h2>
            <p className="mt-2 text-lg"><Badge tone={order.status === "CANCELADO" ? "erro" : "marca"}>{ORDER_STATUS_LABEL[order.status]}</Badge></p>
            {order.cancelReason && <p className="mt-2">Motivo: {order.cancelReason}</p>}
            {canUpdate && transitions.length > 0 && (
              <form action={updateStatus} className="mt-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end print:hidden">
                <input type="hidden" name="orderId" value={order.id} />
                <div>
                  <label htmlFor="status" className="rotulo">Mudar para</label>
                  <select id="status" name="status" className="campo" required>
                    {transitions.map((t) => <option key={t} value={t}>{ORDER_STATUS_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="note" className="rotulo">Observação (vai ao histórico)</label>
                  <input id="note" name="note" className="campo" maxLength={300} placeholder="Ex.: motivo do cancelamento" />
                </div>
                <ConfirmButton className="btn btn-primario" message="Confirmar a mudança de status? O cliente será avisado por e-mail.">Atualizar</ConfirmButton>
              </form>
            )}
            {order.prescription && !rxApproved && ["RECEITA_EM_ANALISE", "PAGAMENTO_CONFIRMADO"].includes(order.status) && (
              <p className="mt-3 ajuda">A produção só é liberada depois que a receita for aprovada na fila de receitas.</p>
            )}
          </section>

          <section className="cartao p-5" aria-labelledby="t-itens">
            <h2 id="t-itens" className="text-2xl">Itens</h2>
            <table className="tabela mt-3">
              <thead><tr><th scope="col">Produto</th><th scope="col">Qtd.</th><th scope="col">Unitário</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {order.items.map((i) => {
                  const lc = i.lensConfig as null | { lens: { name: string; kind: string; index: string; cents: number }; treatments: { name: string; cents: number }[]; frameCents: number; productionDays: number };
                  return (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.name}</strong>{i.variantName ? ` — ${i.variantName}` : ""}
                        {lc && (
                          <ul className="text-sm text-suave mt-1">
                            <li>Armação: {formatBRL(lc.frameCents)}</li>
                            <li>Lente: {lc.lens.name} ({lc.lens.kind.replace("_", " ").toLowerCase()}, índice {lc.lens.index}) — {formatBRL(lc.lens.cents)}</li>
                            {lc.treatments.map((t) => <li key={t.name}>{t.name} — {formatBRL(t.cents)}</li>)}
                            <li>Produção: até {lc.productionDays} dias úteis</li>
                          </ul>
                        )}
                        {i.needsRx && <Badge tone="alerta">Exige receita</Badge>}
                      </td>
                      <td>{i.quantity}</td>
                      <td>{formatBRL(i.unitCents)}</td>
                      <td>{formatBRL(i.unitCents * i.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 max-w-sm ml-auto">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between"><dt>Desconto {order.coupon ? `(${order.coupon.code})` : ""}</dt><dd>- {formatBRL(order.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt>Frete</dt><dd>{formatBRL(order.shippingCents)}</dd></div>
              <div className="flex justify-between font-bold text-lg"><dt>Total</dt><dd>{formatBRL(order.totalCents)}</dd></div>
            </dl>
          </section>

          <section className="cartao p-5" aria-labelledby="t-historico">
            <h2 id="t-historico" className="text-2xl">Linha do tempo</h2>
            <ol className="mt-3 space-y-2">
              {order.history.map((h) => (
                <li key={h.id}><strong>{ORDER_STATUS_LABEL[h.status]}</strong> · {fmtDateTime(h.createdAt)}{h.note ? ` — ${h.note}` : ""}</li>
              ))}
            </ol>
          </section>

          {canUpdate && (
            <form action={saveInternalNotes} className="cartao p-5 print:hidden">
              <input type="hidden" name="orderId" value={order.id} />
              <label htmlFor="internalNotes" className="text-2xl font-serif text-marca-escuro block">Observações internas</label>
              <p className="ajuda">Visíveis só para a equipe.</p>
              <textarea id="internalNotes" name="internalNotes" defaultValue={order.internalNotes ?? ""} className="campo mt-2" maxLength={2000} />
              <button className="btn btn-secundario btn-pequeno mt-2">Salvar observações</button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <section className="cartao p-5" aria-labelledby="t-cliente">
            <h2 id="t-cliente" className="text-2xl">Cliente</h2>
            <p className="mt-2 font-semibold">{order.customerName}</p>
            <p>{order.customerEmail}</p>
            <p>{phone}</p>
            <p className="text-sm text-suave">CPF {order.customerCpfEnc ? maskCpf(decryptString(order.customerCpfEnc)) : "—"}</p>
            <a href={`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá, ${order.customerName.split(" ")[0]}! Aqui é do Espaço Óptico Luísa, sobre o pedido #${order.number}.`)}`}
              target="_blank" rel="noopener noreferrer" className="btn btn-secundario btn-pequeno mt-3 print:hidden">
              Conversar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
            </a>
            {order.customerNotes && <p className="mt-3"><strong>Obs. do cliente:</strong> {order.customerNotes}</p>}
          </section>

          <section className="cartao p-5" aria-labelledby="t-recebimento">
            <h2 id="t-recebimento" className="text-2xl">{order.fulfillment === "RETIRADA" ? "Retirada na loja" : "Entrega"}</h2>
            {order.fulfillment === "RETIRADA" ? (
              <p className="mt-2">Código de retirada: <strong className="text-xl tracking-widest">{order.pickupCode}</strong><br /><span className="text-sm text-suave">Confira documento com foto na entrega.</span></p>
            ) : addr ? (
              <address className="not-italic mt-2">
                {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}<br />
                {addr.district} · {addr.city}/{addr.state}<br />CEP {formatCep(addr.cep)}
                {addr.reference && <><br />Ref.: {addr.reference}</>}
              </address>
            ) : null}
          </section>

          <section className="cartao p-5" aria-labelledby="t-pagamento">
            <h2 id="t-pagamento" className="text-2xl">Pagamento</h2>
            <ul className="mt-2 space-y-2 text-[0.97rem]">
              {order.payments.map((p) => (
                <li key={p.id} className="border-b border-contorno pb-2">
                  {p.method === "PIX" ? "Pix" : "Cartão"} · {formatBRL(p.amountCents)} · <strong>{p.status.toLowerCase().replace("_", " ")}</strong>
                  {p.cardLast4 && <> · final {p.cardLast4}</>}
                  {p.installments > 1 && <> · {p.installments}x</>}
                  {p.refundedCents > 0 && <> · reembolsado {formatBRL(p.refundedCents)}</>}
                  <span className="block text-xs text-suave">{p.provider} · ref. {p.externalId ?? "—"} · {fmtDateTime(p.createdAt)}</span>
                </li>
              ))}
            </ul>
            {paid && can(user.role, "pedidos.reembolsar") && (
              <form action={refundOrder} className="mt-4 space-y-2 print:hidden">
                <input type="hidden" name="orderId" value={order.id} />
                <p className="font-semibold">Registrar reembolso</p>
                <label htmlFor="amount" className="text-sm">Valor (R$)</label>
                <input id="amount" name="amount" inputMode="decimal" defaultValue={centsToInput(paid.amountCents - paid.refundedCents)} className="campo" />
                <label htmlFor="reason" className="text-sm">Motivo</label>
                <input id="reason" name="reason" required className="campo" />
                <ConfirmButton message="Registrar reembolso? Esta ação não pode ser desfeita.">Registrar reembolso</ConfirmButton>
              </form>
            )}
          </section>

          {order.prescription && (
            <section className="cartao p-5" aria-labelledby="t-receita">
              <h2 id="t-receita" className="text-2xl">Receita</h2>
              <p className="mt-2">Status: <strong>{order.prescription.sendLater && order.prescription.fileKeys.length === 0 && !order.prescription.dataEnc ? "cliente vai enviar depois" : RX_STATUS_LABEL[order.prescription.status]}</strong></p>
              {can(user.role, "receitas.ver") && (
                <Link href={`/admin/receitas/${order.prescription.id}`} className="btn btn-secundario btn-pequeno mt-3">Abrir receita</Link>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
