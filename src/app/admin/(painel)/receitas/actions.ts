"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export async function reviewPrescription(form: FormData) {
  const user = await assertStaff("receitas.revisar");
  const id = String(form.get("id"));
  const decision = String(form.get("decision"));
  const reasonPreset = String(form.get("reasonPreset") ?? "");
  const reasonText = String(form.get("reason") ?? "").trim().slice(0, 400);
  const reason = [reasonPreset, reasonText].filter(Boolean).join(" — ");

  if (!["APROVADA", "PENDENTE_CORRECAO", "RECUSADA"].includes(decision)) redirect(`/admin/receitas/${id}?erro=Decisão inválida`);
  if (decision !== "APROVADA" && !reason) redirect(`/admin/receitas/${id}?erro=${encodeURIComponent("Informe o motivo para o cliente.")}`);

  const rx = await db.prescription.findUniqueOrThrow({ where: { id }, include: { orders: true } });
  await db.$transaction(async (tx) => {
    await tx.prescription.update({
      where: { id },
      data: { status: decision as "APROVADA" | "PENDENTE_CORRECAO" | "RECUSADA", reason: decision === "APROVADA" ? null : reason, reviewedById: user.id, reviewedAt: new Date() },
    });
    await tx.rxAccessLog.create({ data: { prescriptionId: id, userId: user.id, action: `decisao_${decision}` } });
    for (const o of rx.orders) {
      if (decision !== "APROVADA" && ["RECEITA_EM_ANALISE", "PAGAMENTO_CONFIRMADO"].includes(o.status)) {
        await tx.order.update({ where: { id: o.id }, data: { status: "RECEITA_PENDENTE" } });
        await tx.orderEvent.create({ data: { orderId: o.id, status: "RECEITA_PENDENTE", note: reason, userId: user.id } });
      }
    }
  });
  await audit(user.id, "receita_revisada", "receita", id, decision);

  for (const o of rx.orders) {
    const link = `${env().APP_URL}/pedido/${o.publicToken}`;
    if (decision === "APROVADA") {
      await sendEmail(o.customerEmail, `Receita aprovada — pedido #${o.number}`, "Sua receita foi aprovada", [
        "Conferimos sua receita e está tudo certo. Seu pedido segue para a produção.",
      ], { label: "Acompanhar pedido", href: link });
    } else {
      await sendEmail(o.customerEmail, `Precisamos de ajuda com sua receita — pedido #${o.number}`, "Receita precisa de correção", [
        `Motivo: ${reason}.`,
        "Envie uma nova foto ou fale com a gente pelo WhatsApp. Seu pedido fica reservado.",
      ], { label: "Enviar nova receita", href: link });
    }
  }
  redirect(`/admin/receitas?ok=${encodeURIComponent("Decisão registrada e cliente avisado.")}`);
}

export async function markInReview(form: FormData) {
  const user = await assertStaff("receitas.revisar");
  const id = String(form.get("id"));
  await db.prescription.updateMany({ where: { id, status: "RECEBIDA" }, data: { status: "EM_ANALISE" } });
  await audit(user.id, "receita_em_analise", "receita", id);
  redirect(`/admin/receitas/${id}`);
}
