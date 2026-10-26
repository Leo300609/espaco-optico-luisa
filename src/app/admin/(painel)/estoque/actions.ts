"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const TYPES = { ENTRADA: 1, VENDA_LOJA: -1, PERDA: -1, CORRECAO: 0 } as const;

export async function adjustStock(form: FormData) {
  const user = await assertStaff("estoque.ajustar");
  const variantId = String(form.get("variantId"));
  const type = String(form.get("type")) as keyof typeof TYPES;
  const qty = Math.trunc(Number(form.get("quantity")));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  const backUrl = String(form.get("back") ?? "/admin/estoque");
  const fail = (m: string) => redirect(`${backUrl}${backUrl.includes("?") ? "&" : "?"}erro=${encodeURIComponent(m)}`);

  if (!(type in TYPES)) fail("Tipo de movimentação inválido.");
  if (!Number.isFinite(qty) || qty === 0 || Math.abs(qty) > 10000) fail("Quantidade inválida.");
  if (reason.length < 3) fail("Informe o motivo do ajuste.");

  // Correção aceita número positivo ou negativo; demais tipos usam o sinal do tipo
  const delta = TYPES[type] === 0 ? qty : TYPES[type] * Math.abs(qty);
  let becameAvailable = false;
  try {
    await db.$transaction(async (tx) => {
      const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId } });
      if (v.stock + delta < v.reserved) throw new Error("O estoque não pode ficar abaixo do que já está reservado em pedidos.");
      if (v.stock + delta < 0) throw new Error("O estoque não pode ficar negativo.");
      becameAvailable = v.stock - v.reserved <= 0 && v.stock + delta - v.reserved > 0;
      await tx.variant.update({ where: { id: variantId }, data: { stock: { increment: delta } } });
      await tx.stockMovement.create({ data: { variantId, type, quantity: delta, reason, userId: user.id } });
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : "Falha no ajuste.");
  }
  await audit(user.id, "estoque_ajuste", "variacao", variantId, `${type} ${delta}: ${reason}`);

  if (becameAvailable) {
    const subs = await db.stockAlertSubscription.findMany({ where: { variantId, notified: false }, take: 200 });
    const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
    for (const s of subs) {
      await sendEmail(s.email, `Chegou: ${v?.product.name}`, "O produto que você queria chegou!", [
        `${v?.product.name} voltou ao estoque. Corra, as unidades são limitadas.`,
      ], { label: "Ver produto", href: `${env().APP_URL}/produto/${v?.product.slug}` });
    }
    await db.stockAlertSubscription.updateMany({ where: { id: { in: subs.map((s) => s.id) } }, data: { notified: true } });
  }
  revalidatePath("/", "layout");
  redirect(`${backUrl}${backUrl.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Estoque ajustado.")}`);
}
