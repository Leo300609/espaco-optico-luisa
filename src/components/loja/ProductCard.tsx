import Link from "next/link";
import type { Product, ProductImage, Variant } from "@prisma/client";
import { currentPrice, formatBRL, installmentText } from "@/lib/money";

export type CardProduct = Product & { images: ProductImage[]; variants: Variant[] };

export function Price({ price, original, size = "md" }: { price: number; original: number | null; size?: "md" | "lg" }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      {original != null && (
        <span className="text-suave line-through text-[0.95rem]">
          <span className="sr-only">De </span>
          {formatBRL(original)}
        </span>
      )}
      <span className={`font-bold text-marca-escuro ${size === "lg" ? "text-3xl" : "text-xl"}`}>
        {original != null && <span className="sr-only">por </span>}
        {formatBRL(price)}
      </span>
    </p>
  );
}

export function ProductCard({ product, isNew }: { product: CardProduct; isNew?: boolean }) {
  const { price, original } = currentPrice(product);
  const available = product.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
  const [img1, img2] = product.images;
  const parcel = installmentText(price, 6);
  const discount = original ? Math.round((1 - price / original) * 100) : 0;

  return (
    <article className="cartao cartao-produto overflow-hidden relative flex flex-col">
      <div className="relative aspect-square bg-gelo">
        {img1 ? (
          <img src={img1.url} alt={img1.alt} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-contain p-4" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-suave">Sem foto</div>
        )}
        {img2 && (
          <img src={img2.url} alt="" loading="lazy" decoding="async" className="foto-2 absolute inset-0 w-full h-full object-contain p-4 bg-gelo" />
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {discount > 0 && <span className="selo bg-promo text-white">-{discount}% promoção</span>}
          {isNew && <span className="selo bg-marca text-white">Novo</span>}
          {available === 0 ? (
            <span className="selo bg-texto text-white">Esgotado</span>
          ) : available <= 2 ? (
            <span className="selo bg-champanhe text-marca-escuro">Últimas unidades</span>
          ) : null}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <p className="text-sm uppercase tracking-wider text-suave">{product.brand}</p>
        <h3 className="font-sans text-[1.05rem] font-semibold text-texto leading-snug">
          <Link href={`/produto/${product.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto pt-2">
          <Price price={price} original={original} />
          {parcel && <p className="text-sm text-suave">{parcel}</p>}
        </div>
      </div>
    </article>
  );
}
