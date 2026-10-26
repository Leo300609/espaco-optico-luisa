import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const cardInclude = {
  images: { orderBy: { position: "asc" as const }, take: 2 },
  variants: { where: { active: true } },
} satisfies Prisma.ProductInclude;

export const publicProductWhere: Prisma.ProductWhereInput = {
  status: "ATIVO",
  deletedAt: null,
  category: { active: true },
};

export type CatalogFilters = {
  categoria?: string;
  q?: string;
  marca?: string[];
  formato?: string[];
  material?: string[];
  genero?: string[];
  min?: number;
  max?: number;
  disponivel?: boolean;
  promo?: boolean;
  ordem?: "relevancia" | "menor" | "maior" | "novidades";
  pagina?: number;
};

export const PAGE_SIZE = 12;

export async function searchProducts(f: CatalogFilters) {
  const and: Prisma.ProductWhereInput[] = [publicProductWhere];
  if (f.categoria) {
    and.push({ OR: [{ category: { slug: f.categoria } }, { category: { parent: { slug: f.categoria } } }] });
  }
  if (f.q) {
    const terms = f.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) {
      and.push({
        OR: [
          { name: { contains: t, mode: "insensitive" } },
          { brand: { contains: t, mode: "insensitive" } },
          { description: { contains: t, mode: "insensitive" } },
          { sku: { equals: t.toUpperCase() } },
        ],
      });
    }
  }
  if (f.marca?.length) and.push({ brand: { in: f.marca } });
  if (f.formato?.length) and.push({ frameShape: { in: f.formato } });
  if (f.material?.length) and.push({ material: { in: f.material } });
  if (f.genero?.length) and.push({ gender: { in: f.genero } });
  if (f.min != null) and.push({ priceCents: { gte: f.min } });
  if (f.max != null) and.push({ priceCents: { lte: f.max } });
  if (f.disponivel) and.push({ variants: { some: { active: true, stock: { gt: 0 } } } });
  if (f.promo) {
    const now = new Date();
    and.push({
      promoCents: { not: null },
      OR: [{ promoStart: null }, { promoStart: { lte: now } }],
      AND: [{ OR: [{ promoEnd: null }, { promoEnd: { gte: now } }] }],
    });
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    f.ordem === "menor"
      ? [{ priceCents: "asc" }]
      : f.ordem === "maior"
        ? [{ priceCents: "desc" }]
        : f.ordem === "novidades"
          ? [{ createdAt: "desc" }]
          : [{ featured: "desc" }, { createdAt: "desc" }];

  const where: Prisma.ProductWhereInput = { AND: and };
  const page = Math.max(1, f.pagina ?? 1);
  const [items, total] = await Promise.all([
    db.product.findMany({ where, include: cardInclude, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Valores disponíveis para os filtros, a partir dos produtos ativos da categoria. */
export async function facetValues(categoria?: string) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      publicProductWhere,
      categoria ? { OR: [{ category: { slug: categoria } }, { category: { parent: { slug: categoria } } }] } : {},
    ],
  };
  const rows = await db.product.findMany({ where, select: { brand: true, frameShape: true, material: true, gender: true } });
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    marcas: uniq(rows.map((r) => r.brand)),
    formatos: uniq(rows.map((r) => r.frameShape)),
    materiais: uniq(rows.map((r) => r.material)),
    generos: uniq(rows.map((r) => r.gender)),
  };
}

export function isNewProduct(createdAt: Date) {
  return Date.now() - createdAt.getTime() < 30 * 86400000;
}
