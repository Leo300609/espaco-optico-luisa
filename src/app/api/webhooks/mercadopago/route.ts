import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchRemotePayment, verifyMpSignature } from "@/lib/payments";
import { markOrderPaid } from "@/lib/orders";

/**
 * Avisos de pagamento do Mercado Pago (capítulo 6.2 e 7.5):
 * 1) valida a assinatura; 2) ignora avisos repetidos; 3) consulta o pagamento no gateway (fonte da verdade);
 * 4) confere valor e pedido; 5) só então atualiza o pedido.
 */
export async function POST(request: Request) {
  if (env().PAYMENT_PROVIDER !== "mercadopago") return NextResponse.json({ ok: true });

  const url = new URL(request.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* alguns avisos vêm só na query string */
  }
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? "");
  if (type !== "payment" || !/^\d{1,20}$/.test(dataId)) return NextResponse.json({ ignored: true });

  if (!verifyMpSignature(request.headers.get("x-signature"), request.headers.get("x-request-id"), dataId)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const remote = await fetchRemotePayment(dataId);
  if (!remote || !remote.orderId) return NextResponse.json({ error: "pagamento não encontrado" }, { status: 404 });

  const eventKey = `mp:${dataId}:${remote.status}`;
  const already = await db.webhookEvent.findUnique({ where: { id: eventKey } });
  if (already) return NextResponse.json({ ok: true, duplicate: true });

  const order = await db.order.findUnique({ where: { id: remote.orderId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
  if (!order) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });

  // Associa o pagamento remoto ao nosso registro (Pix: mesmo id; cartão: a preferência gera um pagamento novo)
  let payment = order.payments.find((p) => p.externalId === dataId) ?? order.payments.find((p) => p.status === "PENDENTE");
  if (!payment) {
    payment = await db.payment.create({
      data: { orderId: order.id, provider: "mercadopago", method: remote.cardBrand ? "CARTAO" : "PIX", externalId: dataId, amountCents: remote.amountCents },
    });
  } else if (payment.externalId !== dataId) {
    payment = await db.payment.update({ where: { id: payment.id }, data: { externalId: dataId } });
  }

  if (remote.status === "APROVADO") {
    if (remote.amountCents !== order.totalCents) {
      console.error(`Valor divergente no pedido ${order.number}: esperado ${order.totalCents}, recebido ${remote.amountCents}`);
      await db.payment.update({ where: { id: payment.id }, data: { status: "PENDENTE" } });
      return NextResponse.json({ error: "valor divergente" }, { status: 409 });
    }
    await markOrderPaid(order.id, payment.id, {
      cardBrand: remote.cardBrand,
      cardLast4: remote.cardLast4,
      installments: remote.installments ?? 1,
    });
  } else if (remote.status === "RECUSADO" || remote.status === "EXPIRADO") {
    await db.payment.update({ where: { id: payment.id }, data: { status: remote.status } });
  } else if (remote.status === "ESTORNADO") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "ESTORNADO", refundedCents: payment.amountCents } });
  }

  await db.webhookEvent.create({ data: { id: eventKey, provider: "mercadopago" } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
