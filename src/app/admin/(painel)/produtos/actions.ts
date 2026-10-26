"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { parseBRL, formatBRL } from "@/lib/money";
import { slugify } from "@/lib/format";
import { savePublicImage } from "@/lib/storage";

const ATTR_KEYS = ["larguraLente", "ponte", "haste", "alturaLente", "peso", "protecaoUV", "polarizado", "corLente", "periodicidade", "curvaBase", "diametro", "unidadesCaixa", "volume"] as const;

const productSchema = z.object({
  name: z.string().trim().min(3, "Nome muito curto").max(140),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, "Código: letras, números e hífen (3 a 30)"),
  brand: z.string().trim().min(1, "Informe a marca").max(60),
  categoryId: z.string().min(1, "Escolha a categoria"),
  type: z.enum(["ARMACAO", "OCULOS_SOL", "LENTE_CONTATO", "LENTE_GRAU", "ACESSORIO"]),
  requiresRx: z.enum(["NAO", "SIM", "OPCIONAL"]),
  description: z.string().trim().min(10, "Descreva o produto (mínimo 10 caracteres)").max(5000),
  gender: z.string().trim().max(30).optional(),
  frameShape: z.string().trim().max(30).optional(),
  material: z.string().trim().max(40).optional(),
  weightGrams: z.coerce.number().int().min(1).max(5000),
  seoTitle: z.string().trim().max(70).optional(),
  seoDesc: z.string().trim().max(160).optional(),
  status: z.enum(["RASCUNHO", "ATIVO", "OCULTO"]),
});

function opt(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || undefined;
}

function backTo(path: string, key: "ok" | "erro", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

export async function saveProduct(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const id = opt(form.get("id"));
  const path = id ? `/admin/produtos/${id}` : "/admin/produtos/novo";

  const parsed = productSchema.safeParse({
    name: form.get("name"), sku: form.get("sku"), brand: form.get("brand"), categoryId: form.get("categoryId"),
    type: form.get("type"), requiresRx: form.get("requiresRx"), description: form.get("description"),
    gender: opt(form.get("gender")), frameShape: opt(form.get("frameShape")), material: opt(form.get("material")),
    weightGrams: form.get("weightGrams") || 200, seoTitle: opt(form.get("seoTitle")), seoDesc: opt(form.get("seoDesc")),
    status: form.get("status") ?? "RASCUNHO",
  });
  if (!parsed.success) backTo(path, "erro", parsed.error.issues.map((i) => i.message).join(" · "));
  const d = parsed.data;

  const price = parseBRL(String(form.get("price") ?? ""));
  if (price == null || price <= 0) backTo(path, "erro", "Informe um preço válido.");
  const promo = opt(form.get("promo")) ? parseBRL(String(form.get("promo"))) : null;
  if (promo != null && promo >= price!) backTo(path, "erro", "O preço promocional deve ser menor que o preço normal.");
  const promoStart = opt(form.get("promoStart")) ? new Date(`${form.get("promoStart")}T00:00:00-03:00`) : null;
  const promoEnd = opt(form.get("promoEnd")) ? new Date(`${form.get("promoEnd")}T23:59:59-03:00`) : null;
  if (promoStart && promoEnd && promoEnd < promoStart) backTo(path, "erro", "A promoção termina antes de começar.");

  const attributes: Record<string, string | boolean> = {};
  for (const k of ATTR_KEYS) {
    const v = opt(form.get(`attr_${k}`));
    if (v) attributes[k] = v === "sim" ? true : v === "nao" ? false : v.slice(0, 60);
  }

  const existing = id ? await db.product.findUnique({ where: { id } }) : null;
  const priceChanged = existing && (existing.priceCents !== price || existing.promoCents !== promo);
  if ((!existing || priceChanged) && !can(user.role, "precos.editar") && existing) backTo(path, "erro", "Você não tem permissão para alterar preços.");

  const data: Prisma.ProductUncheckedCreateInput = {
    ...d,
    gender: d.gender ?? null,
    frameShape: d.frameShape ?? null,
    material: d.material ?? null,
    seoTitle: d.seoTitle ?? null,
    seoDesc: d.seoDesc ?? null,
    acceptsLenses: form.get("acceptsLenses") === "on" && (d.type === "ARMACAO" || d.type === "OCULOS_SOL"),
    featured: form.get("featured") === "on",
    priceCents: price!,
    promoCents: promo,
    promoStart,
    promoEnd,
    attributes,
    slug: existing?.slug ?? `${slugify(`${d.brand} ${d.name}`)}-${d.sku.toLowerCase()}`,
  };

  if (d.status === "ATIVO") {
    const images = id ? await db.productImage.count({ where: { productId: id } }) : 0;
    const variants = id ? await db.variant.count({ where: { productId: id, active: true } }) : 0;
    if (!id || images === 0 || variants === 0) {
      data.status = "RASCUNHO";
      form.set("_avisoAtivo", "1");
    }
  }

  const saved = await (id ? db.product.update({ where: { id }, data }) : db.product.create({ data })).catch((e: unknown) => {
    console.error("[produto] falha ao salvar:", e instanceof Error ? e.message : e);
    return null;
  });
  if (!saved) backTo(path, "erro", "Não foi possível salvar. Confira se o código (SKU) já não existe em outro produto.");
  await audit(user.id, id ? "produto_editado" : "produto_criado", "produto", saved.id,
    priceChanged ? `Preço ${formatBRL(existing!.priceCents)} → ${formatBRL(price!)}${promo != null ? ` (promo ${formatBRL(promo)})` : ""}` : d.name);
  revalidatePath("/", "layout");
  const warn = form.get("_avisoAtivo") ? " Ficou como rascunho: para publicar, cadastre ao menos uma foto e uma variação." : "";
  backTo(`/admin/produtos/${saved.id}`, "ok", `Produto salvo.${warn}`);
}

export async function deleteProduct(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const id = String(form.get("id"));
  await db.product.update({ where: { id }, data: { deletedAt: new Date(), status: "OCULTO" } });
  await audit(user.id, "produto_lixeira", "produto", id);
  revalidatePath("/", "layout");
  backTo("/admin/produtos", "ok", "Produto movido para a lixeira (30 dias).");
}

export async function restoreProduct(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const id = String(form.get("id"));
  await db.product.update({ where: { id }, data: { deletedAt: null } });
  await audit(user.id, "produto_restaurado", "produto", id);
  backTo(`/admin/produtos/${id}`, "ok", "Produto restaurado (oculto). Revise e publique.");
}

export async function duplicateProduct(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const src = await db.product.findUniqueOrThrow({ where: { id: String(form.get("id")) } });
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const copy = await db.product.create({
    data: {
      ...src,
      id: undefined,
      attributes: (src.attributes ?? {}) as Prisma.InputJsonValue,
      sku: `${src.sku}-C${suffix}`.slice(0, 30),
      slug: `${src.slug}-copia-${suffix.toLowerCase()}`,
      name: `${src.name} (cópia)`,
      status: "RASCUNHO",
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: null,
    },
  });
  await audit(user.id, "produto_duplicado", "produto", copy.id, `de ${src.sku}`);
  backTo(`/admin/produtos/${copy.id}`, "ok", "Cópia criada como rascunho. Cadastre fotos e variações.");
}

// ---------- Variações ----------

export async function saveVariant(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const productId = String(form.get("productId"));
  const id = opt(form.get("variantId"));
  const path = `/admin/produtos/${productId}`;
  const sku = String(form.get("sku") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(sku)) backTo(path, "erro", "Código da variação inválido.");
  const priceStr = opt(form.get("price"));
  const price = priceStr ? parseBRL(priceStr) : null;
  const base = {
    sku,
    color: opt(form.get("color")) ?? null,
    size: opt(form.get("size")) ?? null,
    priceCents: price,
    minStock: Math.max(0, Number(form.get("minStock")) || 0),
    barcode: opt(form.get("barcode")) ?? null,
    active: form.get("active") === "on",
  };
  try {
    if (id) {
      await db.variant.update({ where: { id }, data: base });
    } else {
      const initial = Math.max(0, Math.min(10000, Number(form.get("initialStock")) || 0));
      await db.$transaction(async (tx) => {
        const v = await tx.variant.create({ data: { ...base, productId, stock: initial } });
        if (initial > 0) await tx.stockMovement.create({ data: { variantId: v.id, type: "ENTRADA", quantity: initial, reason: "Estoque inicial", userId: user.id } });
      });
    }
  } catch {
    backTo(path, "erro", "Já existe uma variação com este código.");
  }
  await audit(user.id, id ? "variacao_editada" : "variacao_criada", "produto", productId, sku);
  revalidatePath("/", "layout");
  backTo(path, "ok", "Variação salva.");
}

// ---------- Fotos ----------

export async function uploadImages(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const productId = String(form.get("productId"));
  const path = `/admin/produtos/${productId}`;
  const alt = String(form.get("alt") ?? "").trim();
  if (alt.length < 5) backTo(path, "erro", "Descreva a foto no texto alternativo (ex.: 'Armação redonda preta vista de frente').");
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  if (files.length === 0) backTo(path, "erro", "Escolha ao menos uma imagem.");
  const last = await db.productImage.findFirst({ where: { productId }, orderBy: { position: "desc" } });
  let pos = (last?.position ?? -1) + 1;
  try {
    for (const f of files) {
      const url = await savePublicImage(f, `produtos/${productId}`);
      await db.productImage.create({ data: { productId, url, alt: files.length > 1 ? `${alt} (${pos + 1})` : alt, position: pos++ } });
    }
  } catch (e) {
    backTo(path, "erro", e instanceof Error ? e.message : "Falha no envio da imagem.");
  }
  await audit(user.id, "fotos_enviadas", "produto", productId, `${files.length} foto(s)`);
  revalidatePath("/", "layout");
  backTo(path, "ok", "Fotos enviadas.");
}

export async function updateImage(form: FormData) {
  const user = await assertStaff("produtos.editar");
  const id = String(form.get("imageId"));
  const img = await db.productImage.findUniqueOrThrow({ where: { id } });
  const path = `/admin/produtos/${img.productId}`;
  const op = String(form.get("op"));
  if (op === "delete") {
    await db.productImage.delete({ where: { id } });
  } else if (op === "up" || op === "down" || op === "main") {
    const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { position: "asc" } });
    const idx = all.findIndex((x) => x.id === id);
    const order = [...all];
    const [item] = order.splice(idx, 1);
    const target = op === "main" ? 0 : op === "up" ? Math.max(0, idx - 1) : Math.min(all.length - 1, idx + 1);
    order.splice(target, 0, item!);
    await db.$transaction(order.map((x, i) => db.productImage.update({ where: { id: x.id }, data: { position: i } })));
  } else {
    const alt = String(form.get("alt") ?? "").trim();
    if (alt.length < 5) backTo(path, "erro", "Texto alternativo muito curto.");
    await db.productImage.update({ where: { id }, data: { alt: alt.slice(0, 200) } });
  }
  await audit(user.id, `foto_${op}`, "produto", img.productId);
  revalidatePath("/", "layout");
  backTo(path, "ok", "Fotos atualizadas.");
}

// ---------- Reajuste em massa ----------

export async function applyBulkPrice(form: FormData) {
  const user = await assertStaff("precos.editar");
  const ids = String(form.get("ids") ?? "").split(",").filter(Boolean).slice(0, 500);
  const mode = String(form.get("mode"));
  const value = Number(String(form.get("value") ?? "").replace(",", "."));
  if (!ids.length || !Number.isFinite(value) || value === 0) backTo("/admin/produtos", "erro", "Reajuste inválido.");
  const products = await db.product.findMany({ where: { id: { in: ids } } });
  await db.$transaction(
    products.map((p) => {
      const next = mode === "percentual" ? Math.round(p.priceCents * (1 + value / 100)) : p.priceCents + Math.round(value * 100);
      return db.product.update({ where: { id: p.id }, data: { priceCents: Math.max(100, next) } });
    }),
  );
  await audit(user.id, "reajuste_em_massa", "produto", null, `${products.length} produtos, ${mode} ${value}`);
  revalidatePath("/", "layout");
  backTo("/admin/produtos", "ok", `Preço reajustado em ${products.length} produto(s).`);
}
