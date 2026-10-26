import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { cardInclude, publicProductWhere } from "@/lib/catalog";
import { currentPrice, installmentText } from "@/lib/money";
import { PRODUCT_TYPE_LABEL } from "@/lib/format";
import { STORE, whatsappLink } from "@/lib/site";
import { ProductGallery } from "@/components/loja/ProductGallery";
import { BuyBox } from "@/components/loja/BuyBox";
import { Price, ProductCard } from "@/components/loja/ProductCard";
import { IconWhats } from "@/components/icons";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.product.findFirst({
    where: { ...publicProductWhere, slug },
    include: { images: { orderBy: { position: "asc" } }, variants: { where: { active: true } }, category: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  return {
    title: p.seoTitle ?? `${p.name} — ${p.brand}`,
    description: p.seoDesc ?? p.description.slice(0, 155),
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt }] : undefined },
  };
}

const ATTR_LABEL: Record<string, string> = {
  larguraLente: "Largura da lente",
  ponte: "Ponte",
  haste: "Haste",
  alturaLente: "Altura da lente",
  peso: "Peso",
  protecaoUV: "Proteção UV",
  polarizado: "Polarizado",
  periodicidade: "Periodicidade de troca",
  curvaBase: "Curva base",
  diametro: "Diâmetro",
  unidadesCaixa: "Unidades por caixa",
  volume: "Volume",
  corLente: "Cor da lente",
};

export default async function ProdutoPage({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const { price, original } = currentPrice(p);
  const attrs = (p.attributes ?? {}) as Record<string, string | number | boolean>;
  const variants = p.variants.map((v) => ({
    id: v.id,
    label: [v.color, v.size].filter(Boolean).join(" · ") || "Única",
    available: Math.max(0, v.stock - v.reserved),
  }));
  const anyAvailable = variants.some((v) => v.available > 0);
  const related = await db.product.findMany({
    where: { ...publicProductWhere, categoryId: p.categoryId, id: { not: p.id } },
    include: cardInclude,
    take: 4,
    orderBy: { featured: "desc" },
  });
  const parcel = installmentText(price, 6);
  const appUrl = process.env.APP_URL ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    brand: { "@type": "Brand", name: p.brand },
    description: p.description,
    image: p.images.map((i) => (i.url.startsWith("http") ? i.url : `${appUrl}${i.url}`)),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (price / 100).toFixed(2),
      availability: anyAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${appUrl}/produto/${p.slug}`,
      seller: { "@type": "Organization", name: STORE.name },
    },
  };

  return (
    <div className="conteudo py-8">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Trilha de navegação" className="text-sm text-suave mb-4">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/" className="underline">Início</Link> /</li>
          <li><Link href={`/catalogo/${p.category.slug}`} className="underline">{p.category.name}</Link> /</li>
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
        <ProductGallery images={p.images.map((i) => ({ url: i.url, alt: i.alt }))} />

        <div>
          <p className="uppercase tracking-wider text-suave text-sm">{p.brand} · Cód. {p.sku}</p>
          <h1 className="text-4xl mt-1">{p.name}</h1>
          <div className="mt-4">
            <Price price={price} original={original} size="lg" />
            {parcel && <p className="text-suave">{parcel} no cartão</p>}
            {p.acceptsLenses && <p className="text-suave mt-1">Preço da armação. As lentes são escolhidas no próximo passo.</p>}
          </div>

          <div className="mt-6">
            <BuyBox variants={variants} acceptsLenses={p.acceptsLenses} priceCents={price} requiresRx={p.requiresRx} />
          </div>

          <a
            href={whatsappLink(`Olá! Tenho uma dúvida sobre o produto "${p.name}" (cód. ${p.sku}).`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 underline underline-offset-4"
          >
            <IconWhats className="w-5 h-5" /> Tirar dúvida sobre este produto no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>
      </div>

      <div className="mt-12 grid lg:grid-cols-2 gap-10">
        <section aria-labelledby="titulo-descricao">
          <h2 id="titulo-descricao" className="text-3xl">Descrição</h2>
          <div className="texto-longo mt-3">
            {p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </section>
        <section aria-labelledby="titulo-especificacoes">
          <h2 id="titulo-especificacoes" className="text-3xl">Especificações</h2>
          <table className="tabela mt-3">
            <caption className="sr-only">Especificações do produto</caption>
            <tbody>
              <tr><th scope="row">Tipo</th><td>{PRODUCT_TYPE_LABEL[p.type]}</td></tr>
              <tr><th scope="row">Marca</th><td>{p.brand}</td></tr>
              {p.frameShape && <tr><th scope="row">Formato</th><td>{p.frameShape}</td></tr>}
              {p.material && <tr><th scope="row">Material</th><td>{p.material}</td></tr>}
              {p.gender && <tr><th scope="row">Público</th><td>{p.gender}</td></tr>}
              {Object.entries(attrs).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{ATTR_LABEL[k] ?? k}</th>
                  <td>{typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(attrs.larguraLente || attrs.ponte || attrs.haste) && (
            <details className="mt-4 cartao p-4">
              <summary className="font-semibold cursor-pointer">Como conferir se a armação serve em você</summary>
              <p className="mt-2 text-suave">
                Os números ficam gravados na parte interna da haste dos seus óculos atuais, por exemplo 52□18 140:
                largura da lente (52 mm), ponte (18 mm) e haste (140 mm). Diferenças de até 2 mm na lente e na ponte
                costumam ser confortáveis. Na dúvida, venha experimentar na loja ou fale com a gente.
              </p>
            </details>
          )}
        </section>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="titulo-relacionados" className="mt-14">
          <h2 id="titulo-relacionados" className="text-3xl">Você também pode gostar</h2>
          <ul className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((r) => <li key={r.id}><ProductCard product={r} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
