import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { evaluateCoupon, getCart, priceCart } from "@/lib/cart";
import { getCustomer } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { env } from "@/lib/env";
import { STORE, fullAddress } from "@/lib/site";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/carrinho");
  const lines = await priceCart(cart);
  const customer = await getCustomer();
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const coupon = cart.couponCode ? await evaluateCoupon(cart.couponCode, lines, customer?.email) : null;
  const discount = coupon?.ok ? coupon.discountCents : 0;
  const zones = await db.shippingZone.findMany({ where: { active: true }, orderBy: { priceCents: "asc" } });
  const address = customer ? await db.address.findFirst({ where: { userId: customer.id }, orderBy: { isDefault: "desc" } }) : null;
  const needsAddition = lines.some((l) => l.lens && ["MULTIFOCAL", "BIFOCAL", "OCUPACIONAL"].includes(l.lens.option.kind));

  return (
    <div className="conteudo py-8">
      <h1 className="text-4xl">Finalizar compra</h1>
      <p className="text-suave mt-1">Ambiente seguro. Seus dados são usados apenas para processar o pedido.</p>
      <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <CheckoutForm
          customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone ?? "" } : null}
          address={address ? { cep: address.cep, street: address.street, number: address.number, complement: address.complement ?? "", district: address.district, city: address.city, state: address.state } : null}
          needsRx={lines.some((l) => l.needsRx)}
          needsAddition={needsAddition}
          subtotalAfterDiscount={subtotal - discount}
          zones={zones.map((z) => ({ cepStart: z.cepStart, cepEnd: z.cepEnd, name: z.name, priceCents: z.priceCents, freeAboveCents: z.freeAboveCents, days: z.days }))}
          freeShippingCoupon={coupon?.ok ? coupon.freeShipping : false}
          pixMinutes={env().PIX_EXPIRATION_MINUTES}
          maxInstallments={env().MAX_INSTALLMENTS}
          storeAddress={fullAddress()}
          pickupDays={STORE.pickupDays}
        />
        <aside className="cartao p-5 lg:sticky lg:top-40" aria-labelledby="resumo-pedido">
          <h2 id="resumo-pedido" className="text-2xl">Seu pedido</h2>
          <ul className="mt-3 space-y-3">
            {lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3 text-[0.97rem]">
                <span>
                  {l.quantity}× {l.productName}
                  {l.variantName ? ` (${l.variantName})` : ""}
                  {l.lens && <span className="block text-sm text-suave">+ lentes {l.lens.option.name}</span>}
                </span>
                <span className="whitespace-nowrap">{formatBRL(l.lineCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 pt-3 border-t border-contorno space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-sucesso"><dt>Desconto ({cart.couponCode})</dt><dd>- {formatBRL(discount)}</dd></div>}
          </dl>
          <p className="ajuda mt-2">A entrega é somada conforme o CEP. O total final aparece antes de pagar.</p>
          <Link href="/carrinho" className="block underline mt-3">Editar carrinho</Link>
        </aside>
      </div>
    </div>
  );
}
