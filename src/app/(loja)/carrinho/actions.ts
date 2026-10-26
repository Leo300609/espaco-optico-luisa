"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { evaluateCoupon, findShippingZone, getCart, getOrCreateCart, priceCart, shippingFor, type LensConfig } from "@/lib/cart";
import { getCustomer, getClientIp } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { formatBRL } from "@/lib/money";

export type ActionState = { ok?: boolean; message?: string; error?: string } | null;

const addSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

export async function addToCart(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = addSchema.safeParse({ variantId: form.get("variantId"), quantity: form.get("quantity") ?? 1 });
  if (!parsed.success) return { error: "Escolha uma opção do produto." };
  const variant = await db.variant.findUnique({ where: { id: parsed.data.variantId }, include: { product: true } });
  if (!variant || !variant.active || variant.product.status !== "ATIVO" || variant.product.deletedAt) {
    return { error: "Produto indisponível." };
  }
  if (variant.product.acceptsLenses && form.get("comLentes") === "1") redirect(`/monte-seu-oculos/${variant.product.slug}?v=${variant.id}`);

  const available = variant.stock - variant.reserved;
  const cart = await getOrCreateCart();
  const existing = cart.items.find((i) => i.variantId === variant.id && !i.lensConfig);
  const newQty = (existing?.quantity ?? 0) + parsed.data.quantity;
  if (newQty > available) return { error: available > 0 ? `Temos apenas ${available} em estoque.` : "Produto esgotado." };

  if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  else await db.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: parsed.data.quantity } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Adicionado ao carrinho." };
}

/** Adiciona armação + lentes (vindo do "Monte seu óculos"). */
export async function addGlassesToCart(variantId: string, cfg: LensConfig): Promise<ActionState> {
  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || !variant.active || !variant.product.acceptsLenses || variant.product.status !== "ATIVO") return { error: "Armação indisponível." };
  if (variant.stock - variant.reserved < 1) return { error: "Armação esgotada." };
  const lens = await db.lensOption.findFirst({ where: { id: cfg.lensOptionId, active: true } });
  if (!lens) return { error: "Escolha um tipo de lente." };
  const treatments = await db.treatment.findMany({ where: { id: { in: cfg.treatmentIds }, active: true }, select: { id: true } });
  const cart = await getOrCreateCart();
  await db.cartItem.create({
    data: {
      cartId: cart.id,
      variantId,
      quantity: 1,
      lensConfig: { lensOptionId: lens.id, treatmentIds: treatments.map((t) => t.id) },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateQuantity(form: FormData) {
  const itemId = String(form.get("itemId") ?? "");
  const qty = Math.max(0, Math.min(10, Number(form.get("quantity")) || 0));
  const cart = await getCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) return;
  if (qty === 0) await db.cartItem.delete({ where: { id: item.id } });
  else {
    const available = item.variant.stock - item.variant.reserved;
    await db.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(qty, Math.max(1, available)) } });
  }
  revalidatePath("/carrinho");
  revalidatePath("/", "layout");
}

export async function removeItem(form: FormData) {
  const itemId = String(form.get("itemId") ?? "");
  const cart = await getCart();
  if (cart?.items.some((i) => i.id === itemId)) await db.cartItem.delete({ where: { id: itemId } });
  revalidatePath("/carrinho");
  revalidatePath("/", "layout");
}

export async function applyCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await rateLimit(`cupom:${await getClientIp()}`, 15, 600))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const code = String(form.get("code") ?? "").trim().toUpperCase().slice(0, 40);
  if (!code) return { error: "Digite o código do cupom." };
  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { error: "Seu carrinho está vazio." };
  const lines = await priceCart(cart);
  const customer = await getCustomer();
  const check = await evaluateCoupon(code, lines, customer?.email);
  if (!check.ok) return { error: check.message };
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: check.coupon.code } });
  revalidatePath("/carrinho");
  return { ok: true, message: check.freeShipping ? "Cupom de frete grátis aplicado." : `Cupom aplicado: ${formatBRL(check.discountCents)} de desconto.` };
}

export async function removeCoupon() {
  const cart = await getCart();
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  revalidatePath("/carrinho");
}

export type ShippingState = { error?: string; result?: { zone: string; price: string; days: number; free: boolean } } | null;

export async function simulateShipping(_: ShippingState, form: FormData): Promise<ShippingState> {
  if (!(await rateLimit(`frete:${await getClientIp()}`, 40, 600))) return { error: "Muitas consultas. Aguarde alguns minutos." };
  const cep = String(form.get("cep") ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return { error: "Digite um CEP com 8 números." };
  const zone = await findShippingZone(cep);
  if (!zone) return { error: "Ainda não entregamos neste CEP. Você pode retirar grátis na loja em Suzano ou consultar pelo WhatsApp." };
  const subtotal = Number(form.get("subtotal")) || 0;
  const price = shippingFor(zone, subtotal);
  return { result: { zone: zone.name, price: price === 0 ? "Grátis" : formatBRL(price), days: zone.days, free: price === 0 } };
}

export async function subscribeStockAlert(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await rateLimit(`aviseme:${await getClientIp()}`, 10, 3600))) return { error: "Muitas tentativas. Tente mais tarde." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const variantId = String(form.get("variantId") ?? "");
  if (!z.string().email().safeParse(email).success) return { error: "Digite um e-mail válido." };
  const v = await db.variant.findUnique({ where: { id: variantId } });
  if (!v) return { error: "Produto não encontrado." };
  await db.stockAlertSubscription.upsert({
    where: { variantId_email: { variantId, email } },
    create: { variantId, email },
    update: { notified: false },
  });
  return { ok: true, message: "Pronto! Avisaremos por e-mail quando o produto chegar." };
}
