"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { markOrderPaid, expireStaleOrders } from "@/lib/orders";
import { savePrivateFile, deletePrivateFile } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/session";
import { POLICY_VERSION } from "@/lib/site";
import { notifyStore } from "@/lib/email";

async function orderByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.order.findUnique({ where: { publicToken: token }, include: { prescription: true, payments: { orderBy: { createdAt: "desc" } } } });
}

/** Somente no modo de teste: simula a confirmação do pagamento. */
export async function simulatePayment(form: FormData) {
  if (env().PAYMENT_PROVIDER !== "mock") throw new Error("Indisponível.");
  const order = await orderByToken(String(form.get("token") ?? ""));
  if (!order) return;
  const payment = order.payments.find((p) => p.status === "PENDENTE");
  if (!payment) return;
  await markOrderPaid(order.id, payment.id, payment.method === "CARTAO" ? { cardBrand: "visa", cardLast4: "4242", installments: 3 } : {});
  revalidatePath(`/pedido/${order.publicToken}`);
  redirect(`/pedido/${order.publicToken}`);
}

export type UploadState = { ok?: boolean; error?: string } | null;

/** Envio (ou reenvio) da receita depois da compra. */
export async function uploadPrescription(_: UploadState, form: FormData): Promise<UploadState> {
  if (!(await rateLimit(`rx-upload:${await getClientIp()}`, 10, 3600))) return { error: "Muitas tentativas. Tente mais tarde." };
  const order = await orderByToken(String(form.get("token") ?? ""));
  if (!order || !order.prescription) return { error: "Pedido não encontrado." };
  if (!["AGUARDANDO_RECEITA", "RECEITA_PENDENTE", "AGUARDANDO_PAGAMENTO"].includes(order.status)) {
    return { error: "Este pedido não está aguardando receita." };
  }
  if (form.get("consentHealth") !== "on") return { error: "Marque a autorização para tratarmos a sua receita." };
  const files = form.getAll("rxFiles").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 2);
  if (files.length === 0) return { error: "Anexe a foto ou o PDF da receita." };

  const keys: string[] = [];
  try {
    for (const f of files) keys.push((await savePrivateFile(f)).key);
  } catch (e) {
    for (const k of keys) await deletePrivateFile(k);
    return { error: e instanceof Error ? e.message : "Arquivo inválido." };
  }
  const old = order.prescription.fileKeys;
  await db.$transaction(async (tx) => {
    const consent = await tx.consent.create({
      data: { userId: order.userId, email: order.customerEmail, type: "DADO_SAUDE", textVersion: POLICY_VERSION, ip: await getClientIp() },
    });
    await tx.prescription.update({
      where: { id: order.prescription!.id },
      data: { fileKeys: keys, sendLater: false, status: "RECEBIDA", reason: null, consentId: consent.id, customerNotes: String(form.get("rxNotes") ?? "").slice(0, 500) || undefined },
    });
    if (order.status !== "AGUARDANDO_PAGAMENTO") {
      await tx.order.update({ where: { id: order.id }, data: { status: "RECEITA_EM_ANALISE" } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "RECEITA_EM_ANALISE", note: "Receita enviada pelo cliente" } });
    }
  });
  for (const k of old) await deletePrivateFile(k);
  await notifyStore(`Receita recebida — pedido #${order.number}`, ["Há uma receita aguardando conferência na fila do painel."]);
  revalidatePath(`/pedido/${order.publicToken}`);
  return { ok: true };
}

/** Gera uma nova cobrança Pix para pedido cujo pagamento por cartão falhou ou expirou (ainda não cancelado). */
export async function retryWithPix(form: FormData) {
  const token = String(form.get("token") ?? "");
  await expireStaleOrders();
  const order = await orderByToken(token);
  if (!order || order.status !== "AGUARDANDO_PAGAMENTO") redirect(`/pedido/${token}`);
  const { createPixCharge } = await import("@/lib/payments");
  const { decryptString } = await import("@/lib/crypto");
  const cpf = order.customerCpfEnc ? decryptString(order.customerCpfEnc) : null;
  const fresh = await db.order.update({
    where: { id: order.id },
    data: { paymentMethod: "PIX", expiresAt: new Date(Date.now() + env().PIX_EXPIRATION_MINUTES * 60_000) },
  });
  const pix = await createPixCharge(fresh, cpf);
  await db.payment.updateMany({ where: { orderId: order.id, status: "PENDENTE" }, data: { status: "EXPIRADO" } });
  await db.payment.create({
    data: { orderId: order.id, provider: env().PAYMENT_PROVIDER, method: "PIX", externalId: pix.externalId, amountCents: order.totalCents, pixCode: pix.code, pixQrBase64: pix.qrBase64, expiresAt: pix.expiresAt },
  });
  redirect(`/pedido/${token}`);
}
