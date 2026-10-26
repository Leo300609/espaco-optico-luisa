"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { parseBRL } from "@/lib/money";
import { onlyDigits } from "@/lib/format";
import { savePublicImage } from "@/lib/storage";

function go(path: string, key: "ok" | "erro", msg: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const money = (f: FormData, k: string, path: string) => {
  const v = parseBRL(s(f, k));
  if (v == null) go(path, "erro", "Valor em reais inválido.");
  return v;
};
const dateSP = (v: string, end = false) => (v ? new Date(`${v}T${end ? "23:59:59" : "00:00:00"}-03:00`) : null);

// ---------- Lentes ----------
export async function saveLens(f: FormData) {
  const user = await assertStaff("lentes.editar");
  const path = "/admin/lentes";
  const id = s(f, "id");
  const kind = z.enum(["VISAO_SIMPLES", "MULTIFOCAL", "BIFOCAL", "OCUPACIONAL"]).safeParse(s(f, "kind"));
  if (!kind.success || s(f, "name").length < 2 || !/^1\.\d{2}$/.test(s(f, "refractiveIdx"))) go(path, "erro", "Preencha tipo, nome e índice (ex.: 1.61).");
  const num = (k: string, d: number) => {
    const n = Number(s(f, k).replace(",", "."));
    return Number.isFinite(n) && s(f, k) !== "" ? n : d;
  };
  const data = {
    kind: kind.data!,
    name: s(f, "name").slice(0, 80),
    refractiveIdx: s(f, "refractiveIdx"),
    description: s(f, "description").slice(0, 200) || null,
    priceCents: money(f, "price", path),
    minSphere: num("minSphere", -8),
    maxSphere: num("maxSphere", 6),
    maxCylinder: num("maxCylinder", 4),
    productionDays: Math.max(1, Math.round(num("productionDays", 7))),
    active: f.get("active") === "on",
  };
  if (id) await db.lensOption.update({ where: { id }, data });
  else await db.lensOption.create({ data });
  await audit(user.id, id ? "lente_editada" : "lente_criada", "lente", id || null, data.name);
  revalidatePath("/", "layout");
  go(path, "ok", "Lente salva.");
}

export async function saveTreatment(f: FormData) {
  const user = await assertStaff("lentes.editar");
  const path = "/admin/lentes";
  const id = s(f, "id");
  if (s(f, "name").length < 2) go(path, "erro", "Informe o nome do tratamento.");
  const data = { name: s(f, "name").slice(0, 80), description: s(f, "description").slice(0, 200) || null, priceCents: money(f, "price", path), active: f.get("active") === "on" };
  if (id) await db.treatment.update({ where: { id }, data });
  else await db.treatment.create({ data });
  await audit(user.id, id ? "tratamento_editado" : "tratamento_criado", "tratamento", id || null, data.name);
  revalidatePath("/", "layout");
  go(path, "ok", "Tratamento salvo.");
}

// ---------- Cupons ----------
export async function saveCoupon(f: FormData) {
  const user = await assertStaff("cupons.editar");
  const path = "/admin/cupons";
  const id = s(f, "id");
  const code = s(f, "code").toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) go(path, "erro", "Código: 3 a 30 letras, números, - ou _.");
  const type = z.enum(["PERCENTUAL", "VALOR_FIXO", "FRETE_GRATIS"]).parse(s(f, "type"));
  let value = 0;
  if (type === "PERCENTUAL") {
    value = Math.round(Number(s(f, "value").replace(",", ".")));
    if (!(value > 0 && value <= 90)) go(path, "erro", "Percentual entre 1 e 90.");
  } else if (type === "VALOR_FIXO") value = money(f, "value", path);
  const data = {
    code,
    type,
    value,
    minOrderCents: s(f, "minOrder") ? money(f, "minOrder", path) : 0,
    startsAt: dateSP(s(f, "startsAt")),
    endsAt: dateSP(s(f, "endsAt"), true),
    maxUses: s(f, "maxUses") ? Math.max(1, Number(s(f, "maxUses"))) : null,
    maxUsesPerUser: s(f, "maxUsesPerUser") ? Math.max(1, Number(s(f, "maxUsesPerUser"))) : null,
    firstOrderOnly: f.get("firstOrderOnly") === "on",
    combineWithPromo: f.get("combineWithPromo") === "on",
    categoryIds: f.getAll("categoryIds").map(String).filter(Boolean),
    active: f.get("active") === "on",
  };
  try {
    if (id) await db.coupon.update({ where: { id }, data });
    else await db.coupon.create({ data });
  } catch {
    go(path, "erro", "Já existe um cupom com este código.");
  }
  await audit(user.id, id ? "cupom_editado" : "cupom_criado", "cupom", id || null, code);
  go(path, "ok", `Cupom ${code} salvo.`);
}

// ---------- Frete ----------
export async function saveZone(f: FormData) {
  const user = await assertStaff("frete.editar");
  const path = "/admin/frete";
  const id = s(f, "id");
  const start = onlyDigits(s(f, "cepStart"));
  const end = onlyDigits(s(f, "cepEnd"));
  if (start.length !== 8 || end.length !== 8 || end < start) go(path, "erro", "Faixa de CEP inválida (8 números; final maior ou igual ao inicial).");
  if (s(f, "name").length < 2) go(path, "erro", "Dê um nome à zona (ex.: Suzano — Centro).");
  const data = {
    name: s(f, "name").slice(0, 80),
    cepStart: start,
    cepEnd: end,
    priceCents: money(f, "price", path),
    days: Math.max(0, Math.round(Number(s(f, "days")) || 1)),
    freeAboveCents: s(f, "freeAbove") ? money(f, "freeAbove", path) : null,
    active: f.get("active") === "on",
  };
  if (id) await db.shippingZone.update({ where: { id }, data });
  else await db.shippingZone.create({ data });
  await audit(user.id, id ? "frete_editado" : "frete_criado", "frete", id || null, `${data.name} ${start}-${end}`);
  go(path, "ok", "Zona de entrega salva.");
}

// ---------- Banners e páginas ----------
export async function saveBanner(f: FormData) {
  const user = await assertStaff("conteudo.editar");
  const path = "/admin/banners";
  const id = s(f, "id");
  if (s(f, "title").length < 3) go(path, "erro", "Informe o título do banner.");
  const href = s(f, "ctaHref");
  if (href && !href.startsWith("/") && !href.startsWith("https://")) go(path, "erro", "O link deve começar com / (página do site) ou https://");
  let imageUrl: string | undefined;
  const file = f.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await savePublicImage(file, "banners");
    } catch (e) {
      go(path, "erro", e instanceof Error ? e.message : "Imagem inválida.");
    }
  }
  const data = {
    title: s(f, "title").slice(0, 120),
    subtitle: s(f, "subtitle").slice(0, 240) || null,
    ctaLabel: s(f, "ctaLabel").slice(0, 40) || null,
    ctaHref: href || null,
    position: Number(s(f, "position")) || 0,
    startsAt: dateSP(s(f, "startsAt")),
    endsAt: dateSP(s(f, "endsAt"), true),
    active: f.get("active") === "on",
    ...(imageUrl ? { imageUrl } : {}),
  };
  if (id) await db.banner.update({ where: { id }, data });
  else await db.banner.create({ data });
  await audit(user.id, id ? "banner_editado" : "banner_criado", "banner", id || null, data.title);
  revalidatePath("/");
  go(path, "ok", "Banner salvo.");
}

export async function deleteBanner(f: FormData) {
  const user = await assertStaff("conteudo.editar");
  await db.banner.delete({ where: { id: s(f, "id") } });
  await audit(user.id, "banner_excluido", "banner", s(f, "id"));
  revalidatePath("/");
  go("/admin/banners", "ok", "Banner excluído.");
}

export async function savePage(f: FormData) {
  const user = await assertStaff("conteudo.editar");
  const path = "/admin/banners";
  const id = s(f, "id");
  const content = String(f.get("content") ?? "").slice(0, 50000);
  if (s(f, "title").length < 3 || content.trim().length < 20) go(path, "erro", "Título e conteúdo são obrigatórios.");
  const page = await db.page.findUniqueOrThrow({ where: { id } });
  await db.page.update({ where: { id }, data: { title: s(f, "title"), content, published: f.get("published") === "on", version: page.version + 1 } });
  await audit(user.id, "pagina_editada", "pagina", id, `${page.slug} v${page.version + 1}`);
  revalidatePath(`/paginas/${page.slug}`);
  go(path, "ok", `Página "${s(f, "title")}" atualizada (versão ${page.version + 1}).`);
}

// ---------- Mensagens ----------
export async function toggleMessage(f: FormData) {
  const user = await assertStaff("mensagens.ver");
  const id = s(f, "id");
  await db.contactMessage.update({ where: { id }, data: { handled: f.get("handled") === "1", notes: s(f, "notes").slice(0, 1000) || null } });
  await audit(user.id, "mensagem_atualizada", "mensagem", id);
  go("/admin/mensagens", "ok", "Mensagem atualizada.");
}
