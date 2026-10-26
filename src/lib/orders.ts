import "server-only";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { sendEmail, notifyStore } from "./email";
import { ORDER_STATUS_LABEL } from "./format";
import { formatBRL } from "./money";
import { STORE, fullAddress } from "./site";

/**
 * Máquina de estados do pedido (capítulo 6.1). Um pedido não pula etapas:
 * só são aceitas as transições listadas aqui.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AGUARDANDO_PAGAMENTO: ["PAGAMENTO_CONFIRMADO", "AGUARDANDO_RECEITA", "RECEITA_EM_ANALISE", "CANCELADO"],
  PAGAMENTO_CONFIRMADO: ["SEPARANDO", "EM_PRODUCAO", "CANCELADO", "REEMBOLSADO"],
  AGUARDANDO_RECEITA: ["RECEITA_EM_ANALISE", "CANCELADO", "REEMBOLSADO"],
  RECEITA_EM_ANALISE: ["EM_PRODUCAO", "SEPARANDO", "RECEITA_PENDENTE", "CANCELADO", "REEMBOLSADO"],
  RECEITA_PENDENTE: ["RECEITA_EM_ANALISE", "CANCELADO", "REEMBOLSADO"],
  EM_PRODUCAO: ["SEPARANDO", "CANCELADO", "REEMBOLSADO"],
  SEPARANDO: ["PRONTO_RETIRADA", "EM_ROTA", "CANCELADO", "REEMBOLSADO"],
  PRONTO_RETIRADA: ["RETIRADO", "CANCELADO", "REEMBOLSADO"],
  EM_ROTA: ["ENTREGUE", "SEPARANDO", "REEMBOLSADO"],
  ENTREGUE: ["REEMBOLSADO"],
  RETIRADO: ["REEMBOLSADO"],
  CANCELADO: [],
  REEMBOLSADO: [],
};

/** Status que só o sistema pode aplicar (o painel não oferece manualmente). */
const SYSTEM_ONLY: OrderStatus[] = ["PAGAMENTO_CONFIRMADO", "AGUARDANDO_RECEITA"];

export function allowedManualTransitions(order: Pick<Order, "status" | "fulfillment" | "prescriptionId">, rxApproved: boolean) {
  return TRANSITIONS[order.status].filter((s) => {
    if (SYSTEM_ONLY.includes(s)) return false;
    if (s === "REEMBOLSADO") return false; // reembolso tem fluxo próprio
    if (s === "PRONTO_RETIRADA" || s === "RETIRADO") return order.fulfillment === "RETIRADA";
    if (s === "EM_ROTA" || s === "ENTREGUE") return order.fulfillment === "ENTREGA";
    if (s === "EM_PRODUCAO" && order.prescriptionId && !rxApproved) return false;
    if (s === "SEPARANDO" && order.status === "RECEITA_EM_ANALISE" && !rxApproved) return false;
    return true;
  });
}

type Tx = Prisma.TransactionClient;

/** Libera reservas de estoque de um pedido não pago. */
async function releaseReservations(tx: Tx, orderId: string, reason: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    await tx.variant.update({ where: { id: item.variantId }, data: { reserved: { decrement: item.quantity } } });
    await tx.stockMovement.create({
      data: { variantId: item.variantId, type: "LIBERACAO_RESERVA", quantity: item.quantity, orderId, reason },
    });
  }
}

/** Devolve ao estoque itens de um pedido já pago (cancelamento/reembolso antes da entrega). */
async function returnStock(tx: Tx, orderId: string, reason: string, userId?: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    await tx.variant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    await tx.stockMovement.create({
      data: { variantId: item.variantId, type: "DEVOLUCAO", quantity: item.quantity, orderId, reason, userId },
    });
  }
}

/**
 * Confirmação de pagamento: idempotente. Converte reserva em baixa definitiva e decide o próximo status
 * (aguardando receita, receita em análise ou pagamento confirmado).
 */
export async function markOrderPaid(orderId: string, paymentId: string, info: { cardBrand?: string; cardLast4?: string; installments?: number } = {}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, prescription: true } });
    if (!order) throw new Error("Pedido não encontrado");
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "APROVADO", approvedAt: new Date(), ...info },
    });
    if (order.paidAt) return { order, changed: false };

    // Pix pago depois de expirar: o estoque já foi liberado. Reservar de novo se ainda houver.
    const expiredBefore = order.status === "CANCELADO";
    for (const item of order.items) {
      if (expiredBefore) {
        const v = await tx.variant.findUniqueOrThrow({ where: { id: item.variantId } });
        if (v.stock - v.reserved < item.quantity) {
          return { order, changed: false, needsManual: true };
        }
        await tx.variant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } });
      } else {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity }, reserved: { decrement: item.quantity } },
        });
      }
      await tx.stockMovement.create({
        data: { variantId: item.variantId, type: "VENDA_ONLINE", quantity: -item.quantity, orderId: order.id },
      });
    }

    const needsRx = order.items.some((i) => i.needsRx);
    let next: OrderStatus = "PAGAMENTO_CONFIRMADO";
    if (needsRx) {
      const rx = order.prescription;
      if (!rx || rx.sendLater || (rx.fileKeys.length === 0 && !rx.dataEnc)) next = "AGUARDANDO_RECEITA";
      else next = rx.status === "APROVADA" ? "PAGAMENTO_CONFIRMADO" : "RECEITA_EM_ANALISE";
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paidAt: new Date(), status: next, cancelledAt: null, cancelReason: null },
    });
    await tx.orderEvent.create({ data: { orderId: order.id, status: next, note: "Pagamento confirmado pelo gateway" } });
    if (order.couponId) {
      const exists = await tx.couponUse.findFirst({ where: { orderId: order.id } });
      if (!exists) {
        await tx.couponUse.create({
          data: { couponId: order.couponId, orderId: order.id, customerEmail: order.customerEmail, amountCents: order.discountCents },
        });
      }
    }
    return { order: updated, changed: true };
  });

  if ("needsManual" in result && result.needsManual) {
    await notifyStore(`Pix pago após expirar — pedido #${result.order.number}`, [
      "O cliente pagou depois do prazo e não há estoque suficiente para reativar automaticamente.",
      "Verifique no painel: reative manualmente ou devolva o valor.",
    ]);
    return;
  }
  if (result.changed) {
    const o = result.order;
    const link = `${env().APP_URL}/pedido/${o.publicToken}`;
    const extra =
      o.status === "AGUARDANDO_RECEITA"
        ? ["Seu pedido tem itens que precisam da receita. Envie a foto ou o PDF pelo link abaixo para seguirmos com a produção."]
        : [];
    await sendEmail(o.customerEmail, `Pagamento confirmado — pedido #${o.number}`, "Recebemos seu pagamento!", [
      `Olá, ${o.customerName.split(" ")[0]}! O pagamento do pedido #${o.number} (${formatBRL(o.totalCents)}) foi confirmado.`,
      ...extra,
      "Você recebe um aviso a cada mudança de status.",
    ], { label: "Acompanhar pedido", href: link });
    await notifyStore(`Novo pedido pago #${o.number}`, [`Total: ${formatBRL(o.totalCents)}`, `Status: ${ORDER_STATUS_LABEL[o.status]}`]);
  }
}

/** Cancela pedidos não pagos cujo Pix expirou, liberando o estoque. Seguro para rodar a qualquer momento. */
export async function expireStaleOrders(): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "AGUARDANDO_PAGAMENTO", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  let count = 0;
  for (const { id } of stale) {
    const done = await db.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id, status: "AGUARDANDO_PAGAMENTO" },
        data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: "Pagamento não realizado no prazo" },
      });
      if (res.count === 0) return false;
      await releaseReservations(tx, id, "Pagamento expirado");
      await tx.payment.updateMany({ where: { orderId: id, status: "PENDENTE" }, data: { status: "EXPIRADO" } });
      await tx.orderEvent.create({ data: { orderId: id, status: "CANCELADO", note: "Pagamento expirado; estoque liberado" } });
      return true;
    });
    if (done) count++;
  }
  return count;
}

const CUSTOMER_MESSAGES: Partial<Record<OrderStatus, (o: Order) => string[]>> = {
  EM_PRODUCAO: () => ["Suas lentes entraram em produção. Avisaremos quando estiver tudo pronto."],
  PRONTO_RETIRADA: (o) => [
    `Seu pedido está pronto para retirada! Código de retirada: ${o.pickupCode}.`,
    `Endereço: ${fullAddress()}.`,
    `Leve um documento com foto. O pedido fica guardado por ${STORE.pickupDays} dias.`,
  ],
  EM_ROTA: () => ["Seu pedido saiu para entrega."],
  ENTREGUE: () => ["Seu pedido foi entregue. Obrigado pela confiança!"],
  RETIRADO: () => ["Pedido retirado na loja. Obrigado pela confiança!"],
  RECEITA_PENDENTE: () => ["Precisamos de uma correção na sua receita. Veja o motivo no acompanhamento do pedido."],
  CANCELADO: (o) => [`Seu pedido foi cancelado.${o.cancelReason ? ` Motivo: ${o.cancelReason}.` : ""}`],
};

/** Mudança manual de status feita pela equipe, validando a transição. */
export async function changeOrderStatus(orderId: string, next: OrderStatus, userId: string, note?: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { prescription: true } });
  const rxApproved = order.prescription?.status === "APROVADA";
  if (!allowedManualTransitions(order, rxApproved).includes(next)) {
    throw new Error(`Não é possível mudar de "${ORDER_STATUS_LABEL[order.status]}" para "${ORDER_STATUS_LABEL[next]}".`);
  }
  const updated = await db.$transaction(async (tx) => {
    if (next === "CANCELADO") {
      if (order.paidAt) await returnStock(tx, order.id, note ?? "Cancelamento", userId);
      else await releaseReservations(tx, order.id, note ?? "Cancelamento");
    }
    const u = await tx.order.update({
      where: { id: order.id },
      data: {
        status: next,
        ...(next === "CANCELADO" ? { cancelledAt: new Date(), cancelReason: note || "Cancelado pela loja" } : {}),
      },
    });
    await tx.orderEvent.create({ data: { orderId: order.id, status: next, note, userId } });
    return u;
  });
  const msg = CUSTOMER_MESSAGES[next]?.(updated);
  if (msg) {
    await sendEmail(updated.customerEmail, `Pedido #${updated.number}: ${ORDER_STATUS_LABEL[next]}`, ORDER_STATUS_LABEL[next], msg, {
      label: "Acompanhar pedido",
      href: `${env().APP_URL}/pedido/${updated.publicToken}`,
    });
  }
  return updated;
}

/** Registra reembolso (o estorno em si é feito no gateway). Somente proprietário. */
export async function registerRefund(orderId: string, amountCents: number, reason: string, userId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    const paid = order.payments.find((p) => p.status === "APROVADO" || p.status === "ESTORNADO_PARCIAL");
    if (!paid) throw new Error("Pedido sem pagamento aprovado.");
    const total = paid.refundedCents + amountCents;
    if (amountCents <= 0 || total > paid.amountCents) throw new Error("Valor de reembolso inválido.");
    await tx.payment.update({
      where: { id: paid.id },
      data: { refundedCents: total, refundReason: reason, status: total === paid.amountCents ? "ESTORNADO" : "ESTORNADO_PARCIAL" },
    });
    if (total === paid.amountCents) {
      const delivered = ["ENTREGUE", "RETIRADO"].includes(order.status);
      if (!delivered) await returnStock(tx, order.id, `Reembolso: ${reason}`, userId);
      await tx.order.update({ where: { id: order.id }, data: { status: "REEMBOLSADO" } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "REEMBOLSADO", note: reason, userId } });
    } else {
      await tx.orderEvent.create({
        data: { orderId: order.id, status: order.status, note: `Reembolso parcial de ${formatBRL(amountCents)}: ${reason}`, userId },
      });
    }
  });
}
