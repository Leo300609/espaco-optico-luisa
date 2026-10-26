import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteBanner, saveBanner, savePage } from "../config-actions";

export const metadata = { title: "Banners e páginas" };

const toDate = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");

export default async function BannersPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; pagina?: string }> }) {
  await requireStaff("conteudo.editar");
  const sp = await searchParams;
  const [banners, pages] = await Promise.all([db.banner.findMany({ orderBy: { position: "asc" } }), db.page.findMany({ orderBy: { title: "asc" } })]);
  const page = pages.find((p) => p.id === sp.pagina);

  return (
    <>
      <PageHeader title="Banners e páginas" description="O primeiro banner ativo vira o destaque da página inicial. Banners fora do período saem do ar sozinhos." />
      <Flash sp={sp} />
      <section className="space-y-4" aria-labelledby="t-banners">
        <h2 id="t-banners" className="text-2xl">Banners</h2>
        {[...banners, undefined].map((b) => (
          <form key={b?.id ?? "novo"} action={saveBanner} className={`cartao p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end ${b ? "" : "bg-gelo"}`}>
            {b && <input type="hidden" name="id" value={b.id} />}
            <p className="sm:col-span-2 lg:col-span-6 font-semibold">{b ? <>{b.title} {b.active ? <Badge tone="ok">ativo</Badge> : <Badge>inativo</Badge>}</> : "Novo banner"}</p>
            <div className="lg:col-span-2"><label className="text-sm" htmlFor={`t-${b?.id}`}>Título</label><input id={`t-${b?.id}`} name="title" defaultValue={b?.title} required className="campo" /></div>
            <div className="lg:col-span-4"><label className="text-sm" htmlFor={`s-${b?.id}`}>Texto de apoio</label><input id={`s-${b?.id}`} name="subtitle" defaultValue={b?.subtitle ?? ""} className="campo" /></div>
            <div><label className="text-sm" htmlFor={`cl-${b?.id}`}>Texto do botão</label><input id={`cl-${b?.id}`} name="ctaLabel" defaultValue={b?.ctaLabel ?? ""} className="campo" /></div>
            <div><label className="text-sm" htmlFor={`ch-${b?.id}`}>Link do botão</label><input id={`ch-${b?.id}`} name="ctaHref" defaultValue={b?.ctaHref ?? ""} placeholder="/catalogo/armacoes" className="campo" /></div>
            <div><label className="text-sm" htmlFor={`i-${b?.id}`}>Imagem</label><input id={`i-${b?.id}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" className="campo py-2" /></div>
            <div><label className="text-sm" htmlFor={`a-${b?.id}`}>Início</label><input id={`a-${b?.id}`} name="startsAt" type="date" defaultValue={toDate(b?.startsAt ?? null)} className="campo" /></div>
            <div><label className="text-sm" htmlFor={`e-${b?.id}`}>Fim</label><input id={`e-${b?.id}`} name="endsAt" type="date" defaultValue={toDate(b?.endsAt ?? null)} className="campo" /></div>
            <div><label className="text-sm" htmlFor={`o-${b?.id}`}>Ordem</label><input id={`o-${b?.id}`} name="position" type="number" defaultValue={b?.position ?? 0} className="campo" /></div>
            <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="w-5 h-5 accent-marca" /> Ativo</label>
            <div className="flex gap-2">
              <button className="btn btn-primario btn-pequeno">{b ? "Salvar" : "Criar"}</button>
            </div>
          </form>
        ))}
        {banners.map((b) => (
          <form key={`del-${b.id}`} action={deleteBanner} className="inline-block mr-2">
            <input type="hidden" name="id" value={b.id} />
            <ConfirmButton message={`Excluir o banner "${b.title}"?`}>Excluir “{b.title}”</ConfirmButton>
          </form>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="t-paginas">
        <h2 id="t-paginas" className="text-2xl">Páginas institucionais</h2>
        <p className="ajuda">Formatação simples: linha começando com &quot;## &quot; vira subtítulo; linhas começando com &quot;- &quot; viram lista. Textos jurídicos devem ser revisados por advogado.</p>
        <ul className="flex flex-wrap gap-2 mt-3">
          {pages.map((p) => <li key={p.id}><a href={`?pagina=${p.id}#editor`} className={`btn btn-pequeno ${p.id === sp.pagina ? "btn-primario" : "btn-secundario"}`}>{p.title}</a></li>)}
        </ul>
        {page && (
          <form id="editor" action={savePage} className="cartao p-5 mt-4 space-y-3">
            <input type="hidden" name="id" value={page.id} />
            <p className="text-sm text-suave">Endereço: /paginas/{page.slug} · versão atual {page.version}</p>
            <div><label htmlFor="title" className="rotulo">Título</label><input id="title" name="title" defaultValue={page.title} className="campo" /></div>
            <div><label htmlFor="content" className="rotulo">Conteúdo</label><textarea id="content" name="content" defaultValue={page.content} className="campo min-h-[420px] font-mono text-sm" /></div>
            <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={page.published} className="w-5 h-5 accent-marca" /> Publicada</label>
            <button className="btn btn-primario">Salvar nova versão</button>
          </form>
        )}
      </section>
    </>
  );
}
