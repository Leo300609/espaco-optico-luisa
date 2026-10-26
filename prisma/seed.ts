/**
 * Dados iniciais: categorias, lentes, tratamentos, frete, páginas, produtos de exemplo e o usuário proprietário.
 * Uso: npm run db:seed   (lê SEED_OWNER_EMAIL, SEED_OWNER_NAME e SEED_OWNER_PASSWORD do .env)
 * Seguro para rodar mais de uma vez (usa upsert).
 */
import { PrismaClient, type ProductType, type RxRequirement } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PAGES } from "./content";

const db = new PrismaClient();

const CATEGORIES = [
  { slug: "armacoes", name: "Armações", description: "Armações para óculos de grau: feminina, masculina, infantil e unissex.", position: 1 },
  { slug: "oculos-de-sol", name: "Óculos de sol", description: "Óculos de sol com proteção UV, com opção de lentes de grau.", position: 2 },
  { slug: "lentes-de-contato", name: "Lentes de contato", description: "Lentes de contato de visão e coloridas.", position: 3 },
  { slug: "lentes-de-grau", name: "Lentes de grau", description: "Lentes de grau de visão simples, multifocais e ocupacionais.", position: 4 },
  { slug: "acessorios", name: "Acessórios", description: "Estojos, flanelas, soluções e kits de limpeza.", position: 5 },
];

const LENSES = [
  { kind: "VISAO_SIMPLES", name: "Visão simples", refractiveIdx: "1.50", priceCents: 19000, minSphere: -6, maxSphere: 4, maxCylinder: 2, productionDays: 5, description: "Resina, ótima para graus baixos." },
  { kind: "VISAO_SIMPLES", name: "Visão simples fina", refractiveIdx: "1.61", priceCents: 34000, minSphere: -8, maxSphere: 6, maxCylinder: 4, productionDays: 7, description: "Mais fina e leve, indicada a partir de 3 graus." },
  { kind: "VISAO_SIMPLES", name: "Visão simples ultrafina", refractiveIdx: "1.67", priceCents: 52000, minSphere: -12, maxSphere: 8, maxCylinder: 4, productionDays: 10, description: "Para graus altos." },
  { kind: "MULTIFOCAL", name: "Multifocal digital", refractiveIdx: "1.50", priceCents: 89000, minSphere: -6, maxSphere: 4, maxCylinder: 3, productionDays: 10, description: "Longe, intermediário e perto, sem linha visível." },
  { kind: "MULTIFOCAL", name: "Multifocal digital fina", refractiveIdx: "1.61", priceCents: 129000, minSphere: -8, maxSphere: 6, maxCylinder: 4, productionDays: 12, description: "Campo visual amplo e lente mais fina." },
  { kind: "OCUPACIONAL", name: "Ocupacional (computador)", refractiveIdx: "1.50", priceCents: 64000, minSphere: -6, maxSphere: 4, maxCylinder: 3, productionDays: 10, description: "Conforto para perto e meia distância." },
  { kind: "BIFOCAL", name: "Bifocal", refractiveIdx: "1.50", priceCents: 39000, minSphere: -6, maxSphere: 4, maxCylinder: 3, productionDays: 7, description: "Longe e perto com linha divisória." },
] as const;

const TREATMENTS = [
  { name: "Antirreflexo", description: "Menos reflexos e visão mais nítida.", priceCents: 9000, position: 1 },
  { name: "Filtro de luz azul", description: "Mais conforto em telas.", priceCents: 12000, position: 2 },
  { name: "Fotossensível", description: "Escurece no sol e clareia em ambientes internos.", priceCents: 28000, position: 3 },
  { name: "Antirrisco", description: "Maior resistência a riscos.", priceCents: 5000, position: 4 },
  { name: "Hidrofóbico", description: "Repele água e gordura, fácil de limpar.", priceCents: 6000, position: 5 },
];

// Faixas de CEP aproximadas — CONFERIR nos Correios antes de lançar.
const ZONES = [
  { name: "Suzano", cepStart: "08600000", cepEnd: "08699999", priceCents: 1000, days: 1, freeAboveCents: 30000 },
  { name: "Poá", cepStart: "08550000", cepEnd: "08569999", priceCents: 1500, days: 2, freeAboveCents: 40000 },
  { name: "Ferraz de Vasconcelos", cepStart: "08500000", cepEnd: "08549999", priceCents: 1500, days: 2, freeAboveCents: 40000 },
  { name: "Itaquaquecetuba", cepStart: "08570000", cepEnd: "08599999", priceCents: 1800, days: 2, freeAboveCents: 40000 },
  { name: "Mogi das Cruzes", cepStart: "08700000", cepEnd: "08899999", priceCents: 2000, days: 3, freeAboveCents: 45000 },
];

type P = {
  sku: string; name: string; brand: string; cat: string; type: ProductType; rx: RxRequirement; lenses?: boolean;
  price: number; promo?: number; gender?: string; shape?: string; material?: string; img: string[];
  attrs?: Record<string, string | boolean>; variants: { suffix: string; color?: string; size?: string; stock: number }[]; featured?: boolean; desc: string;
};

const PRODUCTS: P[] = [
  { sku: "ARM-001", name: "Armação Redonda Clássica", brand: "Luísa Collection", cat: "armacoes", type: "ARMACAO", rx: "NAO", lenses: true, price: 29900, gender: "Unissex", shape: "Redondo", material: "Acetato", img: ["armacao-redonda-preta", "armacao-redonda-preta-lado"], attrs: { larguraLente: "49", ponte: "21", haste: "145", peso: "22" }, variants: [{ suffix: "PT", color: "Preto", stock: 6 }, { suffix: "TT", color: "Tartaruga", stock: 3 }], featured: true, desc: "Armação redonda em acetato, leve e confortável para o dia todo.\n\nCombina com rostos quadrados e de traços marcantes." },
  { sku: "ARM-002", name: "Armação Quadrada Urbana", brand: "Luísa Collection", cat: "armacoes", type: "ARMACAO", rx: "NAO", lenses: true, price: 34900, promo: 27900, gender: "Masculino", shape: "Quadrado", material: "Acetato", img: ["armacao-quadrada-tartaruga", "armacao-quadrada-tartaruga-lado"], attrs: { larguraLente: "53", ponte: "18", haste: "145", peso: "26" }, variants: [{ suffix: "TT", color: "Tartaruga", stock: 4 }], featured: true, desc: "Armação quadrada com presença, em acetato tartaruga.\n\nIdeal para rostos redondos e ovais." },
  { sku: "ARM-003", name: "Armação Gatinho Elegance", brand: "Bella Vista", cat: "armacoes", type: "ARMACAO", rx: "NAO", lenses: true, price: 39900, gender: "Feminino", shape: "Gatinho", material: "Acetato", img: ["armacao-gatinho-vinho", "armacao-gatinho-vinho-lado"], attrs: { larguraLente: "52", ponte: "17", haste: "140", peso: "24" }, variants: [{ suffix: "VN", color: "Vinho", stock: 2 }, { suffix: "PT", color: "Preto", stock: 5 }], featured: true, desc: "Formato gatinho sofisticado que valoriza o olhar." },
  { sku: "ARM-004", name: "Armação Retangular Titânio", brand: "Prime Titanium", cat: "armacoes", type: "ARMACAO", rx: "NAO", lenses: true, price: 59900, gender: "Unissex", shape: "Retangular", material: "Titânio", img: ["armacao-retangular-titanio", "armacao-retangular-titanio-lado"], attrs: { larguraLente: "54", ponte: "17", haste: "145", peso: "14" }, variants: [{ suffix: "GR", color: "Grafite", stock: 3 }], desc: "Leveza extrema e resistência do titânio, com plaquetas ajustáveis." },
  { sku: "ARM-005", name: "Armação Infantil Flex", brand: "Kids Vision", cat: "armacoes", type: "ARMACAO", rx: "NAO", lenses: true, price: 24900, gender: "Infantil", shape: "Redondo", material: "TR90", img: ["armacao-infantil-azul", "armacao-infantil-azul-lado"], attrs: { larguraLente: "44", ponte: "16", haste: "125", peso: "12" }, variants: [{ suffix: "AZ", color: "Azul", stock: 5 }], desc: "Flexível e resistente, feita para acompanhar a energia das crianças." },
  { sku: "SOL-001", name: "Óculos de Sol Aviador", brand: "Sun Coast", cat: "oculos-de-sol", type: "OCULOS_SOL", rx: "OPCIONAL", lenses: true, price: 44900, gender: "Unissex", shape: "Aviador", material: "Metal", img: ["sol-aviador-dourado", "sol-aviador-dourado-lado"], attrs: { larguraLente: "58", ponte: "14", haste: "140", protecaoUV: "UV400", polarizado: true, corLente: "Verde G15" }, variants: [{ suffix: "DR", color: "Dourado", stock: 4 }], featured: true, desc: "O clássico aviador com lentes polarizadas e proteção UV400." },
  { sku: "SOL-002", name: "Óculos de Sol Quadrado Noir", brand: "Sun Coast", cat: "oculos-de-sol", type: "OCULOS_SOL", rx: "OPCIONAL", lenses: true, price: 32900, promo: 26900, gender: "Masculino", shape: "Quadrado", material: "Acetato", img: ["sol-quadrado-preto", "sol-quadrado-preto-lado"], attrs: { larguraLente: "54", ponte: "19", haste: "145", protecaoUV: "UV400", polarizado: false, corLente: "Cinza" }, variants: [{ suffix: "PT", color: "Preto", stock: 6 }], desc: "Visual marcante e proteção total contra raios UV." },
  { sku: "SOL-003", name: "Óculos de Sol Gatinho Rosé", brand: "Bella Vista", cat: "oculos-de-sol", type: "OCULOS_SOL", rx: "NAO", price: 37900, gender: "Feminino", shape: "Gatinho", material: "Acetato", img: ["sol-gatinho-rose", "sol-gatinho-rose-lado"], attrs: { protecaoUV: "UV400", polarizado: false, corLente: "Marrom degradê" }, variants: [{ suffix: "RS", color: "Rosé", stock: 0 }], desc: "Delicado e feminino, com lentes degradê." },
  { sku: "LC-001", name: "Lente de Contato Mensal Hidratante", brand: "AquaVision", cat: "lentes-de-contato", type: "LENTE_CONTATO", rx: "SIM", price: 18900, material: "Silicone hidrogel", img: ["lente-contato-caixa"], attrs: { periodicidade: "Mensal", curvaBase: "8.6", diametro: "14.2", unidadesCaixa: "6" }, variants: [{ suffix: "-100", size: "-1,00", stock: 8 }, { suffix: "-200", size: "-2,00", stock: 8 }, { suffix: "-300", size: "-3,00", stock: 6 }], desc: "Lentes mensais de silicone hidrogel, confortáveis o dia todo.\n\nVenda mediante receita." },
  { sku: "LC-002", name: "Lente de Contato Colorida Natural", brand: "ColorEyes", cat: "lentes-de-contato", type: "LENTE_CONTATO", rx: "SIM", price: 14900, img: ["lente-contato-colorida"], attrs: { periodicidade: "Mensal", unidadesCaixa: "2", corLente: "Azul / Verde" }, variants: [{ suffix: "AZ", color: "Azul", size: "Plano", stock: 5 }, { suffix: "VD", color: "Verde", size: "Plano", stock: 5 }], desc: "Cores naturais para transformar o olhar. Requer orientação profissional." },
  { sku: "LG-001", name: "Par de Lentes Visão Simples com Antirreflexo", brand: "Luísa Lab", cat: "lentes-de-grau", type: "LENTE_GRAU", rx: "SIM", price: 27900, img: ["lente-grau"], variants: [{ suffix: "150", size: "Índice 1.50", stock: 50 }], desc: "Troque as lentes da sua armação atual. Traga a armação à loja ou combine a retirada." },
  { sku: "ACE-001", name: "Estojo Rígido Premium", brand: "Luísa Collection", cat: "acessorios", type: "ACESSORIO", rx: "NAO", price: 4900, img: ["estojo"], attrs: { volume: "16 x 6 cm" }, variants: [{ suffix: "AZ", color: "Azul-marinho", stock: 20 }], desc: "Estojo rígido com interior aveludado." },
  { sku: "ACE-002", name: "Kit Limpeza Spray + Flanela", brand: "Clean View", cat: "acessorios", type: "ACESSORIO", rx: "NAO", price: 3500, img: ["kit-limpeza"], attrs: { volume: "60 ml" }, variants: [{ suffix: "UN", stock: 30 }], desc: "Limpa sem riscar e sem danificar o antirreflexo." },
];

async function main() {
  for (const c of CATEGORIES) await db.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  const cats = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  if ((await db.lensOption.count()) === 0) await db.lensOption.createMany({ data: LENSES.map((l, i) => ({ ...l, position: i })) });
  if ((await db.treatment.count()) === 0) await db.treatment.createMany({ data: TREATMENTS });
  if ((await db.shippingZone.count()) === 0) await db.shippingZone.createMany({ data: ZONES });

  for (const p of PAGES) await db.page.upsert({ where: { slug: p.slug }, update: {}, create: p });

  for (const p of PRODUCTS) {
    const slug = `${p.brand} ${p.name} ${p.sku}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const exists = await db.product.findUnique({ where: { sku: p.sku } });
    if (exists) continue;
    await db.product.create({
      data: {
        sku: p.sku, name: p.name, slug, brand: p.brand, description: p.desc, categoryId: cats[p.cat]!, type: p.type, requiresRx: p.rx,
        acceptsLenses: p.lenses ?? false, priceCents: p.price, promoCents: p.promo ?? null, gender: p.gender, frameShape: p.shape,
        material: p.material, attributes: p.attrs ?? {}, status: "ATIVO", featured: p.featured ?? false,
        images: { create: p.img.map((f, i) => ({ url: `/produtos/${f}.svg`, alt: `${p.name}${i === 0 ? " — vista de frente" : " — vista lateral"}`, position: i })) },
        variants: {
          create: p.variants.map((v) => ({
            sku: `${p.sku}-${v.suffix}`.replace("--", "-"), color: v.color, size: v.size, stock: v.stock, minStock: 1,
            movements: v.stock > 0 ? { create: { type: "ENTRADA", quantity: v.stock, reason: "Estoque inicial (seed)" } } : undefined,
          })),
        },
      },
    });
  }

  await db.coupon.upsert({
    where: { code: "BEMVINDO10" },
    update: {},
    create: { code: "BEMVINDO10", type: "PERCENTUAL", value: 10, minOrderCents: 10000, firstOrderOnly: true, maxUsesPerUser: 1 },
  });
  await db.banner.upsert({
    where: { id: "banner-inicial" },
    update: {},
    create: { id: "banner-inicial", title: "Enxergar bem, com o carinho de quem cuida de Suzano", subtitle: "Armações, óculos de sol e lentes. Compre online e retire grátis na loja.", ctaLabel: "Ver armações", ctaHref: "/catalogo/armacoes", position: 0 },
  });

  const email = process.env.SEED_OWNER_EMAIL?.toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error("SEED_OWNER_PASSWORD precisa ter pelo menos 12 caracteres.");
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: process.env.SEED_OWNER_NAME ?? "Proprietário(a)", role: "PROPRIETARIO", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`Usuário proprietário pronto: ${email} (configure o 2FA no primeiro acesso em /admin)`);
  } else {
    console.log("Defina SEED_OWNER_EMAIL e SEED_OWNER_PASSWORD para criar o usuário proprietário.");
  }
  console.log("Dados iniciais carregados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
