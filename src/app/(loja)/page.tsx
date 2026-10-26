import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { cardInclude, isNewProduct, publicProductWhere } from "@/lib/catalog";
import { ProductCard } from "@/components/loja/ProductCard";
import { STORE, fullAddress, whatsappLink } from "@/lib/site";
import { IconCard, IconGlasses, IconPin, IconPix, IconStore, IconWhats } from "@/components/icons";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { slug: "armacoes", label: "Armações", text: "Para o dia a dia, com ou sem lentes de grau" },
  { slug: "oculos-de-sol", label: "Óculos de sol", text: "Proteção UV com estilo" },
  { slug: "lentes-de-contato", label: "Lentes de contato", text: "Diárias, mensais e coloridas" },
  { slug: "lentes-de-grau", label: "Lentes de grau", text: "Visão simples, multifocal e mais" },
  { slug: "acessorios", label: "Acessórios", text: "Estojos, flanelas e limpeza" },
];

export default async function HomePage() {
  const now = new Date();
  const [banners, featured, latest] = await Promise.all([
    db.banner.findMany({
      where: {
        active: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: "asc" },
      take: 3,
    }),
    db.product.findMany({ where: { ...publicProductWhere, featured: true }, include: cardInclude, take: 8, orderBy: { updatedAt: "desc" } }),
    db.product.findMany({ where: publicProductWhere, include: cardInclude, take: 4, orderBy: { createdAt: "desc" } }),
  ]);
  const hero = banners[0];

  return (
    <>
      {/* Banner principal (editável no painel) */}
      <section aria-labelledby="titulo-destaque" className="bg-gelo">
        <div className="conteudo grid md:grid-cols-2 gap-8 items-center py-10 md:py-16">
          <div>
            <p className="font-script text-4xl text-marca">Bem-vindo à Luísa</p>
            <h1 id="titulo-destaque" className="text-4xl md:text-5xl mt-2">
              {hero?.title ?? "Enxergar bem, com o carinho de quem cuida de Suzano"}
            </h1>
            <p className="mt-4 text-lg text-suave max-w-prose">
              {hero?.subtitle ??
                "Armações, óculos de sol, lentes de contato e lentes de grau. Compre online e retire grátis na loja, ou receba em Suzano e região."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={hero?.ctaHref ?? "/catalogo/armacoes"} className="btn btn-primario">
                {hero?.ctaLabel ?? "Ver armações"}
              </Link>
              <Link href="/paginas/como-comprar-oculos-de-grau" className="btn btn-secundario">
                Como comprar óculos de grau
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm aspect-square">
            {hero?.imageUrl ? (
              <img src={hero.imageUrl} alt="" className="w-full h-full object-cover rounded-[2rem]" />
            ) : (
              <div className="w-full h-full rounded-full bg-marca grid place-items-center shadow-xl">
                <Image src="/logo.png" alt={`Logo ${STORE.name}`} width={360} height={360} className="rounded-full w-[88%] h-auto" priority />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section aria-label="Benefícios" className="border-y border-contorno">
        <ul className="conteudo grid grid-cols-2 md:grid-cols-4 gap-4 py-5 text-[0.97rem]">
          <li className="flex items-center gap-3"><IconStore className="w-7 h-7 text-marca shrink-0" /> Retirada grátis na loja</li>
          <li className="flex items-center gap-3"><IconPix className="w-7 h-7 text-marca shrink-0" /> Pagamento por Pix</li>
          <li className="flex items-center gap-3"><IconCard className="w-7 h-7 text-marca shrink-0" /> Cartão em até 6x</li>
          <li className="flex items-center gap-3"><IconWhats className="w-7 h-7 text-marca shrink-0" /> Atendimento no WhatsApp</li>
        </ul>
      </section>

      {/* Categorias */}
      <section aria-labelledby="titulo-categorias" className="conteudo py-12">
        <h2 id="titulo-categorias" className="text-3xl md:text-4xl">Encontre o que você procura</h2>
        <ul className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link href={`/catalogo/${c.slug}`} className="cartao block h-full p-5 hover:border-marca hover:shadow-md transition">
                <IconGlasses className="w-8 h-8 text-marca" />
                <span className="block mt-3 font-semibold text-lg">{c.label}</span>
                <span className="block text-sm text-suave mt-1">{c.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="titulo-destaques" className="conteudo py-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="titulo-destaques" className="text-3xl md:text-4xl">Destaques da loja</h2>
            <Link href="/catalogo" className="underline underline-offset-4 shrink-0">Ver todos</Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <li key={p.id}><ProductCard product={p} isNew={isNewProduct(p.createdAt)} /></li>
            ))}
          </ul>
        </section>
      )}

      {/* Como comprar óculos de grau em 3 passos */}
      <section aria-labelledby="titulo-passos" className="bg-gelo mt-12">
        <div className="conteudo py-12">
          <h2 id="titulo-passos" className="text-3xl md:text-4xl">Óculos de grau em 3 passos</h2>
          <ol className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Escolha a armação", "Veja as medidas de lente, ponte e haste em cada produto e compare com seus óculos atuais."],
              ["Monte as lentes", "Escolha o tipo de lente e os tratamentos. O preço é atualizado a cada escolha."],
              ["Envie a receita", "Digite os valores e anexe a foto, ou envie depois. Nossa equipe confere tudo antes da produção."],
            ].map(([t, d], i) => (
              <li key={t} className="cartao p-6">
                <span className="font-script text-5xl text-marca" aria-hidden>{i + 1}</span>
                <h3 className="text-2xl mt-1">{t}</h3>
                <p className="mt-2 text-suave">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {latest.length > 0 && (
        <section aria-labelledby="titulo-novidades" className="conteudo py-12">
          <h2 id="titulo-novidades" className="text-3xl md:text-4xl">Novidades</h2>
          <ul className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {latest.map((p) => (
              <li key={p.id}><ProductCard product={p} isNew={isNewProduct(p.createdAt)} /></li>
            ))}
          </ul>
        </section>
      )}

      {/* A loja */}
      <section aria-labelledby="titulo-loja" className="conteudo py-6">
        <div className="cartao p-6 md:p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 id="titulo-loja" className="text-3xl md:text-4xl">Venha nos visitar em Suzano</h2>
            <p className="mt-3 text-suave flex gap-2"><IconPin className="w-5 h-5 mt-1 shrink-0" />{fullAddress()}</p>
            <ul className="mt-3 text-suave">
              {STORE.hours.map((h) => <li key={h.days}>{h.days}: {h.time}</li>)}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/sobre" className="btn btn-primario">Conheça a loja</Link>
              <a href={whatsappLink("Olá! Gostaria de falar com a ótica.")} target="_blank" rel="noopener noreferrer" className="btn btn-secundario">
                Chamar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
              </a>
            </div>
          </div>
          <p className="font-script text-5xl md:text-6xl text-marca text-center">{STORE.motto}</p>
        </div>
      </section>
    </>
  );
}
