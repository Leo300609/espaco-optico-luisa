import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CatalogView } from "@/components/loja/CatalogView";

type Props = {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria } = await params;
  const cat = await db.category.findUnique({ where: { slug: categoria } });
  if (!cat) return {};
  return {
    title: cat.seoTitle ?? `${cat.name} em Suzano`,
    description: cat.seoDesc ?? cat.description ?? `${cat.name} na ótica Espaço Óptico Luísa, em Suzano/SP.`,
    alternates: { canonical: `/catalogo/${cat.slug}` },
  };
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const { categoria } = await params;
  const cat = await db.category.findUnique({ where: { slug: categoria } });
  if (!cat || !cat.active) notFound();
  return (
    <CatalogView
      title={cat.name}
      description={cat.description}
      categoria={cat.slug}
      searchParams={await searchParams}
      basePath={`/catalogo/${cat.slug}`}
    />
  );
}
