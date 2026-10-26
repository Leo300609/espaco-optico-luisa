import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { centsToInput } from "@/lib/money";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteProduct, duplicateProduct, restoreProduct, saveVariant, updateImage, uploadImages } from "../actions";

export const metadata = { title: "Editar produto" };

export default async function EditarProdutoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireStaff("produtos.ver");
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: { variants: { orderBy: { sku: "asc" } }, images: { orderBy: { position: "asc" } } },
  });
  if (!product) notFound();
  const categories = await db.category.findMany({ orderBy: { position: "asc" } });
  const editable = can(user.role, "produtos.editar");

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.brand}`}
        action={
          <div className="flex flex-wrap gap-2">
            {product.status === "ATIVO" && !product.deletedAt && <Link href={`/produto/${product.slug}`} target="_blank" className="btn btn-secundario btn-pequeno">Ver na loja ↗</Link>}
            {editable && !product.deletedAt && (
              <>
                <form action={duplicateProduct}><input type="hidden" name="id" value={product.id} /><button className="btn btn-secundario btn-pequeno">Duplicar</button></form>
                <form action={deleteProduct}><input type="hidden" name="id" value={product.id} /><ConfirmButton message="Mover este produto para a lixeira? Ele sai da loja imediatamente.">Mover para a lixeira</ConfirmButton></form>
              </>
            )}
            {editable && product.deletedAt && (
              <form action={restoreProduct}><input type="hidden" name="id" value={product.id} /><button className="btn btn-primario btn-pequeno">Restaurar</button></form>
            )}
          </div>
        }
      />
      <Flash sp={await searchParams} />
      {product.deletedAt && <p className="cartao p-4 mb-5 border-2 border-promo">Este produto está na lixeira.</p>}

      {editable ? (
        <ProductForm product={product} categories={categories} canEditPrice={can(user.role, "precos.editar")} />
      ) : (
        <p className="cartao p-4">Seu perfil pode apenas visualizar produtos.</p>
      )}

      <section className="cartao p-5 mt-6" aria-labelledby="t-fotos">
        <h2 id="t-fotos" className="text-2xl">Fotos</h2>
        <p className="ajuda">A primeira foto é a principal. Prefira fundo claro, a partir de 1200×1200 px. JPG, PNG ou WebP até 5 MB.</p>
        <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {product.images.map((img, i) => (
            <li key={img.id} className="cartao p-3">
              <img src={img.url} alt={img.alt} className="w-full aspect-square object-contain bg-gelo rounded" />
              {i === 0 && <Badge tone="marca">Principal</Badge>}
              {editable && (
                <>
                  <form action={updateImage} className="mt-2 space-y-1">
                    <input type="hidden" name="imageId" value={img.id} />
                    <input type="hidden" name="op" value="alt" />
                    <label htmlFor={`alt-${img.id}`} className="text-sm font-semibold">Texto alternativo</label>
                    <input id={`alt-${img.id}`} name="alt" defaultValue={img.alt} className="campo min-h-10 text-sm" required />
                    <button className="btn btn-secundario btn-pequeno w-full">Salvar texto</button>
                  </form>
                  <form action={updateImage} className="mt-2 flex flex-wrap gap-1">
                    <input type="hidden" name="imageId" value={img.id} />
                    {i > 0 && <button name="op" value="main" className="btn btn-secundario btn-pequeno">Tornar principal</button>}
                    {i > 0 && <button name="op" value="up" className="btn btn-secundario btn-pequeno" aria-label="Mover para a esquerda">←</button>}
                    {i < product.images.length - 1 && <button name="op" value="down" className="btn btn-secundario btn-pequeno" aria-label="Mover para a direita">→</button>}
                    <ConfirmButton name="op" value="delete" message="Excluir esta foto?">Excluir</ConfirmButton>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form action={uploadImages} className="mt-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <input type="hidden" name="productId" value={product.id} />
            <div>
              <label htmlFor="images" className="rotulo">Enviar fotos</label>
              <input id="images" name="images" type="file" multiple required accept="image/jpeg,image/png,image/webp" className="campo py-2.5" />
            </div>
            <div>
              <label htmlFor="alt" className="rotulo">Descrição da foto (texto alternativo) *</label>
              <input id="alt" name="alt" required minLength={5} placeholder="Ex.: Armação redonda preta vista de frente" className="campo" />
            </div>
            <button className="btn btn-primario">Enviar</button>
          </form>
        )}
      </section>

      <section className="cartao p-5 mt-6" aria-labelledby="t-variacoes">
        <h2 id="t-variacoes" className="text-2xl">Variações (cor, tamanho, grau)</h2>
        <p className="ajuda">O estoque de variações existentes é ajustado na tela Estoque, com motivo registrado.</p>
        <div className="mt-4 space-y-3">
          {product.variants.map((v) => (
            <form key={v.id} action={saveVariant} className="grid sm:grid-cols-2 lg:grid-cols-8 gap-2 items-end border-b border-contorno pb-3">
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="variantId" value={v.id} />
              <div className="lg:col-span-2"><label className="text-sm" htmlFor={`sku-${v.id}`}>Código</label><input id={`sku-${v.id}`} name="sku" defaultValue={v.sku} className="campo min-h-10" disabled={!editable} /></div>
              <div><label className="text-sm" htmlFor={`cor-${v.id}`}>Cor</label><input id={`cor-${v.id}`} name="color" defaultValue={v.color ?? ""} className="campo min-h-10" disabled={!editable} /></div>
              <div><label className="text-sm" htmlFor={`tam-${v.id}`}>Tamanho/grau</label><input id={`tam-${v.id}`} name="size" defaultValue={v.size ?? ""} className="campo min-h-10" disabled={!editable} /></div>
              <div><label className="text-sm" htmlFor={`preco-${v.id}`}>Preço próprio</label><input id={`preco-${v.id}`} name="price" defaultValue={centsToInput(v.priceCents)} placeholder="usa o do produto" className="campo min-h-10" disabled={!editable} /></div>
              <div><label className="text-sm" htmlFor={`min-${v.id}`}>Alerta abaixo de</label><input id={`min-${v.id}`} name="minStock" type="number" min={0} defaultValue={v.minStock} className="campo min-h-10" disabled={!editable} /></div>
              <div className="text-sm">Estoque: <strong>{v.stock}</strong><br />Reservado: {v.reserved}</div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={v.active} className="w-5 h-5 accent-marca" disabled={!editable} /> Ativa</label>
                {editable && <button className="btn btn-secundario btn-pequeno">Salvar</button>}
              </div>
            </form>
          ))}
        </div>
        {editable && (
          <form action={saveVariant} className="mt-5 grid sm:grid-cols-2 lg:grid-cols-7 gap-2 items-end bg-gelo p-3 rounded-lg">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="active" value="on" />
            <p className="sm:col-span-2 lg:col-span-7 font-semibold">Nova variação</p>
            <div className="lg:col-span-2"><label className="text-sm" htmlFor="nv-sku">Código *</label><input id="nv-sku" name="sku" required defaultValue={`${product.sku}-${product.variants.length + 1}`} className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor="nv-cor">Cor</label><input id="nv-cor" name="color" className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor="nv-tam">Tamanho/grau</label><input id="nv-tam" name="size" className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor="nv-estoque">Estoque inicial</label><input id="nv-estoque" name="initialStock" type="number" min={0} defaultValue={0} className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor="nv-min">Alerta abaixo de</label><input id="nv-min" name="minStock" type="number" min={0} defaultValue={1} className="campo min-h-10" /></div>
            <button className="btn btn-primario btn-pequeno">Adicionar</button>
          </form>
        )}
      </section>
    </>
  );
}
