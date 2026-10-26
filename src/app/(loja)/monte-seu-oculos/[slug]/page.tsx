import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { publicProductWhere } from "@/lib/catalog";
import { currentPrice } from "@/lib/money";
import { Configurator } from "./Configurator";

export const metadata: Metadata = { title: "Monte seu óculos", robots: { index: false } };

export default async function MonteSeuOculosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug } = await params;
  const { v } = await searchParams;
  const product = await db.product.findFirst({
    where: { ...publicProductWhere, slug, acceptsLenses: true },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { where: { active: true } } },
  });
  if (!product) notFound();
  const variant = product.variants.find((x) => x.id === v && x.stock - x.reserved > 0) ?? product.variants.find((x) => x.stock - x.reserved > 0);
  if (!variant) {
    return (
      <div className="conteudo py-12">
        <h1 className="text-3xl">Armação esgotada</h1>
        <p className="mt-2"><Link className="underline" href={`/produto/${slug}`}>Voltar ao produto</Link></p>
      </div>
    );
  }
  const [lenses, treatments] = await Promise.all([
    db.lensOption.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { position: "asc" }, { priceCents: "asc" }] }),
    db.treatment.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { priceCents: "asc" }] }),
  ]);
  const frame = currentPrice(product);

  return (
    <div className="conteudo py-8">
      <nav aria-label="Trilha de navegação" className="text-sm text-suave mb-3">
        <Link href={`/produto/${product.slug}`} className="underline">← Voltar para a armação</Link>
      </nav>
      <h1 className="text-4xl">Monte seu óculos</h1>
      <p className="text-suave mt-2 max-w-prose">
        Escolha as lentes para a armação <strong>{product.name}</strong>. O preço é atualizado a cada escolha. A receita é
        enviada na finalização da compra (ou depois, se preferir), e nossa equipe confere tudo antes da produção.
      </p>
      <Configurator
        frame={{
          variantId: variant.id,
          name: product.name,
          variantLabel: [variant.color, variant.size].filter(Boolean).join(" · "),
          image: product.images[0]?.url ?? null,
          priceCents: variant.priceCents ?? frame.price,
        }}
        lenses={lenses.map((l) => ({
          id: l.id,
          kind: l.kind,
          name: l.name,
          index: l.refractiveIdx,
          description: l.description,
          priceCents: l.priceCents,
          productionDays: l.productionDays,
          minSphere: l.minSphere,
          maxSphere: l.maxSphere,
          maxCylinder: l.maxCylinder,
        }))}
        treatments={treatments.map((t) => ({ id: t.id, name: t.name, description: t.description, priceCents: t.priceCents }))}
      />
    </div>
  );
}
