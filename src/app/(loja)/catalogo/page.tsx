import type { Metadata } from "next";
import { CatalogView } from "@/components/loja/CatalogView";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Armações, óculos de sol, lentes de contato, lentes de grau e acessórios na ótica Espaço Óptico Luísa, em Suzano.",
  alternates: { canonical: "/catalogo" },
};

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  return <CatalogView title={q ? `Resultados para "${q}"` : sp.promo ? "Promoções" : "Catálogo"} searchParams={sp} basePath="/catalogo" />;
}
