import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { currentPrice, formatBRL } from "@/lib/money";
import { PRODUCT_TYPE_LABEL } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { applyBulkPrice } from "./actions";

export const metadata = { title: "Produtos" };

type SP = Record<string, string | undefined>;

export default async function ProdutosAdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireStaff("produtos.ver");
  const sp = await searchParams;
  const categories = await db.category.findMany({ orderBy: { position: "asc" } });
  const where: Prisma.ProductWhereInput = { deletedAt: sp.lixeira ? { not: null } : null };
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q.toUpperCase() } }, { brand: { contains: sp.q, mode: "insensitive" } }];
  if (sp.categoria) where.categoryId = sp.categoria;
  if (sp.status === "ATIVO" || sp.status === "RASCUNHO" || sp.status === "OCULTO") where.status = sp.status;
  if (sp.marca) where.brand = sp.marca;

  const products = await db.product.findMany({
    where,
    include: { category: true, variants: true, images: { take: 1, orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const bulk = sp.reajuste && can(user.role, "precos.editar");
  const bulkValue = Number(String(sp.valor ?? "").replace(",", "."));
  const preview = bulk && Number.isFinite(bulkValue) && bulkValue !== 0
    ? products.map((p) => ({
        p,
        next: Math.max(100, sp.modo === "valor" ? p.priceCents + Math.round(bulkValue * 100) : Math.round(p.priceCents * (1 + bulkValue / 100))),
      }))
    : null;

  return (
    <>
      <PageHeader
        title={sp.lixeira ? "Lixeira de produtos" : "Produtos"}
        description={`${products.length} produto(s).`}
        action={
          <div className="flex gap-2">
            <Link href={sp.lixeira ? "/admin/produtos" : "/admin/produtos?lixeira=1"} className="btn btn-secundario btn-pequeno">{sp.lixeira ? "Voltar" : "Lixeira"}</Link>
            {can(user.role, "produtos.editar") && <Link href="/admin/produtos/novo" className="btn btn-primario btn-pequeno">Novo produto</Link>}
          </div>
        }
      />
      <Flash sp={sp} />

      <form className="cartao p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-5" role="search">
        {sp.lixeira && <input type="hidden" name="lixeira" value="1" />}
        <div className="lg:col-span-2">
          <label htmlFor="q" className="rotulo">Buscar</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Nome, marca ou código" className="campo" />
        </div>
        <div>
          <label htmlFor="categoria" className="rotulo">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={sp.categoria ?? ""} className="campo">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="rotulo">Situação</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="campo">
            <option value="">Todas</option><option value="ATIVO">Ativo</option><option value="RASCUNHO">Rascunho</option><option value="OCULTO">Oculto</option>
          </select>
        </div>
        <button className="btn btn-primario">Filtrar</button>
      </form>

      {can(user.role, "precos.editar") && !sp.lixeira && (
        <details className="cartao p-4 mb-5" open={!!bulk}>
          <summary className="font-semibold cursor-pointer">Reajustar preço em massa (aplica aos produtos filtrados acima)</summary>
          <form className="mt-3 grid sm:grid-cols-4 gap-3 items-end">
            {Object.entries(sp).filter(([k]) => ["q", "categoria", "status", "marca"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="reajuste" value="1" />
            <div>
              <label htmlFor="modo" className="rotulo">Tipo</label>
              <select id="modo" name="modo" defaultValue={sp.modo ?? "percentual"} className="campo">
                <option value="percentual">Percentual (%)</option><option value="valor">Valor (R$)</option>
              </select>
            </div>
            <div>
              <label htmlFor="valor" className="rotulo">Valor (use negativo para reduzir)</label>
              <input id="valor" name="valor" defaultValue={sp.valor} inputMode="decimal" className="campo" placeholder="10 ou -5" />
            </div>
            <button className="btn btn-secundario">Ver prévia</button>
          </form>
          {preview && (
            <div className="mt-4">
              <table className="tabela">
                <thead><tr><th scope="col">Produto</th><th scope="col">Preço atual</th><th scope="col">Novo preço</th></tr></thead>
                <tbody>{preview.slice(0, 50).map(({ p, next }) => <tr key={p.id}><td>{p.name}</td><td>{formatBRL(p.priceCents)}</td><td><strong>{formatBRL(next)}</strong></td></tr>)}</tbody>
              </table>
              {preview.length > 50 && <p className="ajuda">E mais {preview.length - 50} produto(s).</p>}
              <form action={applyBulkPrice} className="mt-3">
                <input type="hidden" name="ids" value={preview.map((x) => x.p.id).join(",")} />
                <input type="hidden" name="mode" value={sp.modo === "valor" ? "valor" : "percentual"} />
                <input type="hidden" name="value" value={String(bulkValue)} />
                <ConfirmButton className="btn btn-primario" message={`Aplicar o novo preço a ${preview.length} produto(s)?`}>Confirmar reajuste</ConfirmButton>
              </form>
            </div>
          )}
        </details>
      )}

      {products.length === 0 ? <Empty>Nenhum produto encontrado.</Empty> : (
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead><tr><th scope="col">Foto</th><th scope="col">Produto</th><th scope="col">Categoria</th><th scope="col">Preço</th><th scope="col">Estoque livre</th><th scope="col">Situação</th></tr></thead>
            <tbody>
              {products.map((p) => {
                const { price, original } = currentPrice(p);
                const free = p.variants.reduce((s, v) => s + (v.active ? v.stock - v.reserved : 0), 0);
                return (
                  <tr key={p.id}>
                    <td>{p.images[0] ? <img src={p.images[0].url} alt="" className="w-14 h-14 object-contain bg-gelo rounded" /> : <span className="text-suave text-sm">sem foto</span>}</td>
                    <td><Link href={`/admin/produtos/${p.id}`} className="underline font-semibold">{p.name}</Link><span className="block text-sm text-suave">{p.brand} · {p.sku} · {PRODUCT_TYPE_LABEL[p.type]}</span></td>
                    <td>{p.category.name}</td>
                    <td>{formatBRL(price)}{original && <span className="block text-sm text-suave line-through">{formatBRL(original)}</span>}</td>
                    <td>{free <= 0 ? <Badge tone="erro">Esgotado</Badge> : free}</td>
                    <td><Badge tone={p.status === "ATIVO" ? "ok" : p.status === "RASCUNHO" ? "alerta" : "neutro"}>{p.status.toLowerCase()}</Badge>{p.featured && <> <Badge tone="marca">destaque</Badge></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
