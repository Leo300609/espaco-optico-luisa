import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { RichText } from "@/components/RichText";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await db.page.findUnique({ where: { slug: (await params).slug } });
  return page ? { title: page.title, alternates: { canonical: `/paginas/${page.slug}` } } : {};
}

export default async function InstitucionalPage({ params }: Props) {
  const page = await db.page.findUnique({ where: { slug: (await params).slug } });
  if (!page || !page.published) notFound();
  return (
    <article className="conteudo py-10 max-w-3xl">
      <h1 className="text-4xl md:text-5xl">{page.title}</h1>
      <p className="text-suave mt-2 text-sm">Atualizado em {fmtDate(page.updatedAt)} · versão {page.version}</p>
      <RichText text={page.content} className="texto-longo mt-6 text-[1.05rem]" />
    </article>
  );
}
