import Link from "next/link";
import { facetValues, isNewProduct, searchProducts, type CatalogFilters } from "@/lib/catalog";
import { parseBRL } from "@/lib/money";
import { ProductCard } from "./ProductCard";
import { AutoSubmit } from "./AutoSubmit";

type SP = Record<string, string | string[] | undefined>;

const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: SP, categoria?: string): CatalogFilters {
  const ordem = one(sp.ordem);
  return {
    categoria,
    q: one(sp.q).slice(0, 80) || undefined,
    marca: arr(sp.marca),
    formato: arr(sp.formato),
    material: arr(sp.material),
    genero: arr(sp.genero),
    min: one(sp.min) ? parseBRL(one(sp.min)) ?? undefined : undefined,
    max: one(sp.max) ? parseBRL(one(sp.max)) ?? undefined : undefined,
    disponivel: one(sp.disponivel) === "1",
    promo: one(sp.promo) === "1",
    ordem: (["menor", "maior", "novidades"].includes(ordem) ? ordem : "relevancia") as CatalogFilters["ordem"],
    pagina: Number(one(sp.pagina)) || 1,
  };
}

function Checks({ name, legend, values, selected }: { name: string; legend: string; values: string[]; selected: string[] }) {
  if (values.length === 0) return null;
  return (
    <fieldset className="border-t border-contorno pt-4">
      <legend className="font-semibold mb-2">{legend}</legend>
      <ul className="space-y-1.5">
        {values.map((v) => {
          const id = `${name}-${v}`.replace(/\s+/g, "-");
          return (
            <li key={v} className="flex items-center gap-2.5">
              <input id={id} type="checkbox" name={name} value={v} defaultChecked={selected.includes(v)} className="w-5 h-5 accent-marca" />
              <label htmlFor={id} className="cursor-pointer">{v}</label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export async function CatalogView({ title, description, categoria, searchParams, basePath }: {
  title: string;
  description?: string | null;
  categoria?: string;
  searchParams: SP;
  basePath: string;
}) {
  const f = parseFilters(searchParams, categoria);
  const [result, facets] = await Promise.all([searchProducts(f), facetValues(categoria)]);

  const active: { label: string; key: string; value: string }[] = [
    ...(f.q ? [{ label: `Busca: ${f.q}`, key: "q", value: f.q }] : []),
    ...f.marca!.map((v) => ({ label: v, key: "marca", value: v })),
    ...f.formato!.map((v) => ({ label: v, key: "formato", value: v })),
    ...f.material!.map((v) => ({ label: v, key: "material", value: v })),
    ...f.genero!.map((v) => ({ label: v, key: "genero", value: v })),
    ...(f.promo ? [{ label: "Em promoção", key: "promo", value: "1" }] : []),
    ...(f.disponivel ? [{ label: "Disponível", key: "disponivel", value: "1" }] : []),
  ];

  const urlWithout = (key: string, value: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      for (const val of arr(v)) if (!(k === key && val === value) && k !== "pagina") p.append(k, val);
    }
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const pageUrl = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) for (const val of arr(v)) if (k !== "pagina") p.append(k, val);
    p.set("pagina", String(n));
    return `${basePath}?${p.toString()}`;
  };

  return (
    <div className="conteudo py-8">
      <nav aria-label="Trilha de navegação" className="text-sm text-suave mb-3">
        <ol className="flex gap-2">
          <li><Link href="/" className="underline">Início</Link> /</li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <h1 className="text-4xl">{title}</h1>
      {description && <p className="mt-2 text-suave max-w-prose">{description}</p>}

      <div className="mt-6 grid lg:grid-cols-[260px_1fr] gap-8">
        <aside aria-label="Filtros">
          <form id="filtros" action={basePath} method="get" className="space-y-4">
            <AutoSubmit formId="filtros" />
            {f.q && <input type="hidden" name="q" value={f.q} />}
            <div>
              <label htmlFor="ordem" className="rotulo">Ordenar por</label>
              <select id="ordem" name="ordem" defaultValue={f.ordem} className="campo">
                <option value="relevancia">Relevância</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
                <option value="novidades">Novidades</option>
              </select>
            </div>
            <details open>
              <summary className="font-semibold cursor-pointer py-2 lg:hidden">Mostrar filtros</summary>
              <div className="space-y-4">
                <Checks name="marca" legend="Marca" values={facets.marcas} selected={f.marca!} />
                <Checks name="formato" legend="Formato" values={facets.formatos} selected={f.formato!} />
                <Checks name="material" legend="Material" values={facets.materiais} selected={f.material!} />
                <Checks name="genero" legend="Público" values={facets.generos} selected={f.genero!} />
                <fieldset className="border-t border-contorno pt-4">
                  <legend className="font-semibold mb-2">Faixa de preço (R$)</legend>
                  <div className="flex gap-2">
                    <div>
                      <label htmlFor="min" className="text-sm">Mínimo</label>
                      <input id="min" name="min" inputMode="decimal" defaultValue={one(searchParams.min)} className="campo" />
                    </div>
                    <div>
                      <label htmlFor="max" className="text-sm">Máximo</label>
                      <input id="max" name="max" inputMode="decimal" defaultValue={one(searchParams.max)} className="campo" />
                    </div>
                  </div>
                </fieldset>
                <fieldset className="border-t border-contorno pt-4 space-y-2">
                  <legend className="sr-only">Outras opções</legend>
                  <div className="flex items-center gap-2.5">
                    <input id="disponivel" type="checkbox" name="disponivel" value="1" defaultChecked={f.disponivel} className="w-5 h-5 accent-marca" />
                    <label htmlFor="disponivel">Somente disponíveis</label>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input id="promo" type="checkbox" name="promo" value="1" defaultChecked={f.promo} className="w-5 h-5 accent-marca" />
                    <label htmlFor="promo">Somente promoções</label>
                  </div>
                </fieldset>
                <button type="submit" className="btn btn-secundario w-full">Aplicar filtros</button>
              </div>
            </details>
          </form>
        </aside>

        <section aria-labelledby="titulo-resultados">
          <h2 id="titulo-resultados" className="sr-only">Resultados</h2>
          <p role="status" className="text-suave">
            {result.total} {result.total === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>
          {active.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-3" aria-label="Filtros ativos">
              {active.map((a) => (
                <li key={`${a.key}-${a.value}`}>
                  <Link href={urlWithout(a.key, a.value)} className="selo bg-gelo text-texto border border-contorno py-1.5 px-3 hover:border-marca">
                    {a.label} <span aria-hidden>×</span><span className="sr-only"> (remover filtro)</span>
                  </Link>
                </li>
              ))}
              <li><Link href={basePath} className="selo py-1.5 px-3 underline">Limpar tudo</Link></li>
            </ul>
          )}

          {result.items.length === 0 ? (
            <div className="cartao p-8 mt-6 text-center">
              <p className="text-lg">Nenhum produto encontrado com esses filtros.</p>
              <p className="text-suave mt-1">Tente remover algum filtro ou fale com a gente pelo WhatsApp.</p>
            </div>
          ) : (
            <ul className="mt-5 grid grid-cols-2 xl:grid-cols-3 gap-4">
              {result.items.map((p) => (
                <li key={p.id}><ProductCard product={p} isNew={isNewProduct(p.createdAt)} /></li>
              ))}
            </ul>
          )}

          {result.pages > 1 && (
            <nav aria-label="Paginação" className="mt-8 flex justify-center gap-2">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={pageUrl(n)}
                  aria-current={n === result.page ? "page" : undefined}
                  className={`min-w-11 min-h-11 grid place-items-center rounded-lg border ${n === result.page ? "bg-marca text-white border-marca" : "border-contorno hover:border-marca"}`}
                >
                  <span className="sr-only">Página </span>{n}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
