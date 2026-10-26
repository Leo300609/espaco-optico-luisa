"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { changeOrderStatus, registerRefund } from "@/lib/orders";
import { parseBRL } from "@/lib/money";

const back = (id: string, msg: string, key: "ok" | "erro" = "ok") => redirect(`/admin/pedidos/${id}?${key}=${encodeURIComponent(msg)}`);

export async function updateStatus(form: FormData) {
  const user = await assertStaff("pedidos.atualizar");
  const id = String(form.get("orderId"));
  const next = z.string().parse(form.get("status")) as OrderStatus;
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || undefined;
  try {
    await changeOrderStatus(id, next, user.id, note);
    await audit(user.id, "pedido_status", "pedido", id, `→ ${next}`);
  } catch (e) {
    back(id, e instanceof Error ? e.message : "Não foi possível alterar o status.", "erro");
  }
  revalidatePath(`/admin/pedidos/${id}`);
  back(id, "Status atualizado e cliente avisado.");
}

export async function saveInternalNotes(form: FormData) {
  const user = await assertStaff("pedidos.atualizar");
  const id = String(form.get("orderId"));
  await db.order.update({ where: { id }, data: { internalNotes: String(form.get("internalNotes") ?? "").slice(0, 2000) } });
  await audit(user.id, "pedido_observacao", "pedido", id);
  back(id, "Observações salvas.");
}

export async function refundOrder(form: FormData) {
  const user = await assertStaff("pedidos.reembolsar");
  const id = String(form.get("orderId"));
  const amount = parseBRL(String(form.get("amount") ?? ""));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  if (!amount || reason.length < 3) back(id, "Informe o valor e o motivo do reembolso.", "erro");
  try {
    await registerRefund(id, amount!, reason, user.id);
    await audit(user.id, "pedido_reembolso", "pedido", id, `${amount} centavos: ${reason}`);
  } catch (e) {
    back(id, e instanceof Error ? e.message : "Falha no reembolso.", "erro");
  }
  back(id, "Reembolso registrado. Lembre-se de concluir o estorno no painel do Mercado Pago.");
}
