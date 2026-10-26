import type { Metadata } from "next";
import Link from "next/link";
import { getCart, priceCart, evaluateCoupon } from "@/lib/cart";
import { getCustomer } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { removeCoupon, removeItem, updateQuantity } from "./actions";
import { CouponForm } from "./CouponForm";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CarrinhoPage() {
  const cart = await getCart();
  const lines = cart ? await priceCart(cart) : [];

  if (!cart || lines.length === 0) {
    return (
      <div className="conteudo py-12 text-center">
        <h1 className="text-4xl">Seu carrinho está vazio</h1>
        <p className="text-suave mt-2">Que tal dar uma olhada nas novidades?</p>
        <Link href="/catalogo" className="btn btn-primario mt-6">Ver produtos</Link>
      </div>
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const customer = await getCustomer();
  const coupon = cart.couponCode ? await evaluateCoupon(cart.couponCode, lines, customer?.email) : null;
  const discount = coupon?.ok ? coupon.discountCents : 0;
  const needsRx = lines.some((l) => l.needsRx);
  const stockIssue = lines.some((l) => l.quantity > l.available);

  return (
    <div className="conteudo py-8">
      <h1 className="text-4xl">Carrinho</h1>
      <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <section aria-labelledby="titulo-itens">
          <h2 id="titulo-itens" className="sr-only">Itens</h2>
          <ul className="space-y-4">
            {lines.map((l) => (
              <li key={l.itemId} className="cartao p-4 flex gap-4">
                <div className="w-24 h-24 shrink-0 bg-gelo rounded-lg overflow-hidden">
                  {l.image && <img src={l.image} alt="" className="w-full h-full object-contain p-2" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans text-lg font-semibold">
                    <Link href={`/produto/${l.productSlug}`} className="hover:underline">{l.productName}</Link>
                  </h3>
                  {l.variantName && <p className="text-suave">{l.variantName}</p>}
                  {l.lens && (
                    <div className="text-sm text-suave mt-1">
                      <p>Lentes: {l.lens.option.name} (índice {l.lens.option.refractiveIdx}) — {formatBRL(l.lens.option.priceCents)}</p>
                      {l.lens.treatments.length > 0 && <p>Tratamentos: {l.lens.treatments.map((t) => t.name).join(", ")}</p>}
                      <p>Produção: até {l.lens.productionDays} dias úteis após aprovação da receita</p>
                    </div>
                  )}
                  {l.needsRx && <p className="selo bg-gelo text-marca border border-marca mt-2">Exige receita</p>}
                  {l.quantity > l.available && (
                    <p className="erro font-semibold" role="alert">
                      {l.available === 0 ? "Este item esgotou. Remova-o para continuar." : `Só temos ${l.available} em estoque.`}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {!l.lens && (
                      <form action={updateQuantity} className="flex items-center gap-2">
                        <input type="hidden" name="itemId" value={l.itemId} />
                        <label htmlFor={`qtd-${l.itemId}`} className="text-sm">Quantidade</label>
                        <select id={`qtd-${l.itemId}`} name="quantity" defaultValue={l.quantity} className="campo w-20 min-h-10 py-1">
                          {Array.from({ length: Math.max(1, Math.min(10, Math.max(l.available, l.quantity))) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button className="btn btn-secundario btn-pequeno">Atualizar</button>
                      </form>
                    )}
                    <form action={removeItem}>
                      <input type="hidden" name="itemId" value={l.itemId} />
                      <button className="underline text-promo min-h-10">Remover<span className="sr-only"> {l.productName}</span></button>
                    </form>
                  </div>
                </div>
                <p className="font-bold text-lg whitespace-nowrap">{formatBRL(l.lineCents)}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="cartao p-5 lg:sticky lg:top-40" aria-labelledby="titulo-resumo">
          <h2 id="titulo-resumo" className="text-2xl">Resumo</h2>
          <CouponForm current={cart.couponCode} />
          {cart.couponCode && (
            <div className="mt-2 text-sm">
              {coupon && !coupon.ok ? <p className="erro">{coupon.message}</p> : <p className="text-sucesso">Cupom {cart.couponCode} aplicado.</p>}
              <form action={removeCoupon}><button className="underline">Remover cupom</button></form>
            </div>
          )}
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-sucesso"><dt>Desconto</dt><dd>- {formatBRL(discount)}</dd></div>}
            <div className="flex justify-between text-suave"><dt>Entrega</dt><dd>calculada no próximo passo</dd></div>
          </dl>
          <p className="mt-3 pt-3 border-t border-contorno flex justify-between text-xl font-bold">
            <span>Total</span><span>{formatBRL(subtotal - discount)}</span>
          </p>
          {needsRx && (
            <p className="ajuda mt-3">Há itens que exigem receita. Você poderá enviá-la na finalização ou depois.</p>
          )}
          {stockIssue ? (
            <p className="erro mt-4">Ajuste os itens sem estoque para continuar.</p>
          ) : (
            <Link href="/checkout" className="btn btn-primario w-full mt-4">Finalizar compra</Link>
          )}
          <Link href="/catalogo" className="block text-center underline mt-3">Continuar comprando</Link>
        </aside>
      </div>
    </div>
  );
}
