import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [products, categories, pages] = await Promise.all([
    db.product.findMany({ where: { status: "ATIVO", deletedAt: null }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { active: true }, select: { slug: true } }),
    db.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/sobre`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contato`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${base}/catalogo/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/produto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...pages.map((p) => ({ url: `${base}/paginas/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
