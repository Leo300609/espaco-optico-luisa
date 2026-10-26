import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Novo produto" };

export default async function NovoProdutoPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireStaff("produtos.editar");
  const categories = await db.category.findMany({ orderBy: { position: "asc" } });
  return (
    <>
      <PageHeader title="Novo produto" description="Depois de salvar, cadastre as fotos e as variações (cor/tamanho) para poder publicar." />
      <Flash sp={await searchParams} />
      <ProductForm categories={categories} canEditPrice={can(user.role, "precos.editar")} />
    </>
  );
}
