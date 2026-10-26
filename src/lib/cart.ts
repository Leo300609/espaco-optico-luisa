import "server-only";
import { cookies } from "next/headers";
import type { Coupon, LensOption, Prisma, Treatment } from "@prisma/client";
import { db } from "./db";
import { currentPrice } from "./money";

export const CART_COOKIE = "eol_cart";
const CART_DAYS = 7;

export type LensConfig = { lensOptionId: string; treatmentIds: string[] };

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: { include: { images: { orderBy: { position: "asc" as const }, take: 1 }, category: true } },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export async function getCart(): Promise<CartWithItems | null> {
  const jar = await cookies();
  const id = jar.get(CART_COOKIE)?.value;
  if (!id) return null;
  const cart = await db.cart.findUnique({ where: { id }, include: cartInclude });
  if (!cart || cart.expiresAt < new Date()) return null;
  return cart;
}

export async function getOrCreateCart(): Promise<CartWithItems> {
  const existing = await getCart();
  if (existing) return existing;
  const cart = await db.cart.create({
    data: { expiresAt: new Date(Date.now() + CART_DAYS * 86400000) },
    include: cartInclude,
  });
  const jar = await cookies();
  jar.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_DAYS * 86400,
  });
  return cart;
}

export async function clearCartCookie() {
  const jar = await cookies();
  jar.delete(CART_COOKIE);
}

export type PricedLine = {
  itemId: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  image: string | null;
  imageAlt: string;
  unitCents: number; // armação + lentes + tratamentos
  baseCents: number;
  originalCents: number | null;
  quantity: number;
  lineCents: number;
  available: number;
  needsRx: boolean;
  rxOptional: boolean;
  categoryId: string;
  onPromo: boolean;
  lens: null | { option: LensOption; treatments: Treatment[]; cents: number; productionDays: number };
};

/** Recalcula preços SEMPRE no servidor a partir do banco (nunca confia no navegador). */
export async function priceCart(cart: CartWithItems): Promise<PricedLine[]> {
  const lensIds = new Set<string>();
  const treatmentIds = new Set<string>();
  for (const item of cart.items) {
    const cfg = item.lensConfig as LensConfig | null;
    if (cfg) {
      lensIds.add(cfg.lensOptionId);
      cfg.treatmentIds.forEach((t) => treatmentIds.add(t));
    }
  }
  const [lenses, treatments] = await Promise.all([
    db.lensOption.findMany({ where: { id: { in: [...lensIds] }, active: true } }),
    db.treatment.findMany({ where: { id: { in: [...treatmentIds] }, active: true } }),
  ]);

  return cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const { price, original } = currentPrice(p);
    const base = v.priceCents ?? price;
    const cfg = item.lensConfig as LensConfig | null;
    let lens: PricedLine["lens"] = null;
    if (cfg) {
      const option = lenses.find((l) => l.id === cfg.lensOptionId);
      if (option) {
        const ts = treatments.filter((t) => cfg.treatmentIds.includes(t.id));
        lens = {
          option,
          treatments: ts,
          cents: option.priceCents + ts.reduce((s, t) => s + t.priceCents, 0),
          productionDays: option.productionDays,
        };
      }
    }
    const unit = base + (lens?.cents ?? 0);
    const variantName = [v.color, v.size].filter(Boolean).join(" · ") || null;
    return {
      itemId: item.id,
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      variantName,
      image: p.images[0]?.url ?? null,
      imageAlt: p.images[0]?.alt ?? p.name,
      unitCents: unit,
      baseCents: base,
      originalCents: v.priceCents == null ? original : null,
      quantity: item.quantity,
      lineCents: unit * item.quantity,
      available: Math.max(0, v.stock - v.reserved),
      needsRx: p.requiresRx === "SIM" || lens != null,
      rxOptional: p.requiresRx === "OPCIONAL",
      categoryId: p.categoryId,
      onPromo: original != null,
      lens,
    };
  });
}

export type CouponCheck = { ok: true; discountCents: number; freeShipping: boolean; coupon: Coupon } | { ok: false; message: string };

export async function evaluateCoupon(
  code: string,
  lines: PricedLine[],
  customerEmail?: string | null,
): Promise<CouponCheck> {
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!coupon || !coupon.active) return { ok: false, message: "Cupom não encontrado." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, message: "Este cupom ainda não está válido." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, message: "Este cupom expirou." };

  const eligible = lines.filter(
    (l) => (coupon.categoryIds.length === 0 || coupon.categoryIds.includes(l.categoryId)) && (coupon.combineWithPromo || !l.onPromo),
  );
  const eligibleCents = eligible.reduce((s, l) => s + l.lineCents, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  if (subtotal < coupon.minOrderCents) return { ok: false, message: "O pedido não atingiu o valor mínimo do cupom." };
  if (eligibleCents === 0 && coupon.type !== "FRETE_GRATIS") return { ok: false, message: "Nenhum item do carrinho é elegível a este cupom." };

  if (coupon.maxUses != null) {
    const used = await db.couponUse.count({ where: { couponId: coupon.id } });
    if (used >= coupon.maxUses) return { ok: false, message: "Este cupom atingiu o limite de usos." };
  }
  if (customerEmail) {
    const email = customerEmail.toLowerCase();
    if (coupon.maxUsesPerUser != null) {
      const usedByUser = await db.couponUse.count({ where: { couponId: coupon.id, customerEmail: email } });
      if (usedByUser >= coupon.maxUsesPerUser) return { ok: false, message: "Você já usou este cupom." };
    }
    if (coupon.firstOrderOnly) {
      const previous = await db.order.count({
        where: { customerEmail: email, status: { notIn: ["CANCELADO", "AGUARDANDO_PAGAMENTO"] } },
      });
      if (previous > 0) return { ok: false, message: "Cupom válido apenas na primeira compra." };
    }
  }

  let discount = 0;
  if (coupon.type === "PERCENTUAL") discount = Math.round((eligibleCents * Math.min(coupon.value, 100)) / 100);
  if (coupon.type === "VALOR_FIXO") discount = Math.min(coupon.value, eligibleCents);
  return { ok: true, discountCents: discount, freeShipping: coupon.type === "FRETE_GRATIS", coupon };
}

export async function findShippingZone(cep: string) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return db.shippingZone.findFirst({
    where: { active: true, cepStart: { lte: digits }, cepEnd: { gte: digits } },
    orderBy: { priceCents: "asc" },
  });
}

export function shippingFor(zone: { priceCents: number; freeAboveCents: number | null }, subtotalAfterDiscount: number) {
  return zone.freeAboveCents != null && subtotalAfterDiscount >= zone.freeAboveCents ? 0 : zone.priceCents;
}
