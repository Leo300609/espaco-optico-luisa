import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { formatBRL } from "@/lib/money";
import { PageHeader, Stat } from "@/components/admin/ui";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requireStaff("relatorios.ver");
  const sp = await searchParams;
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000 - 3 * 3600_000).toISOString().slice(0, 10);
  const de = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? "") ? sp.de! : monthAgo;
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? "") ? sp.ate! : today;
  const from = new Date(`${de}T00:00:00-03:00`);
  const to = new Date(`${ate}T23:59:59-03:00`);
  const paidWhere = { paidAt: { gte: from, lte: to }, status: { notIn: ["CANCELADO" as const, "REEMBOLSADO" as const] } };

  const [agg, byCategory, coupons, stale] = await Promise.all([
    db.order.aggregate({ where: paidWhere, _sum: { totalCents: true, discountCents: true, shippingCents: true }, _count: true }),
    db.$queryRaw<{ categoria: string; quantidade: bigint; total: bigint }[]>`
      SELECT c."name" AS categoria, SUM(i."quantity")::bigint AS quantidade, SUM(i."unitCents" * i."quantity")::bigint AS total
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" JOIN "Product" p ON p."id" = i."productId" JOIN "Category" c ON c."id" = p."categoryId"
      WHERE o."paidAt" BETWEEN ${from} AND ${to} AND o."status" NOT IN ('CANCELADO','REEMBOLSADO')
      GROUP BY c."name" ORDER BY total DESC`,
    db.couponUse.groupBy({ by: ["couponId"], where: { createdAt: { gte: from, lte: to } }, _sum: { amountCents: true }, _count: true }),
    db.$queryRaw<{ nome: string; sku: string; estoque: number }[]>`
      SELECT p."name" AS nome, v."sku" AS sku, v."stock" AS estoque FROM "Variant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE v."stock" > 0 AND p."deletedAt" IS NULL AND NOT EXISTS (
        SELECT 1 FROM "StockMovement" m WHERE m."variantId" = v."id" AND m."type" IN ('VENDA_ONLINE','VENDA_LOJA') AND m."createdAt" > NOW() - INTERVAL '90 days')
      ORDER BY v."stock" DESC LIMIT 20`,
  ]);
  const couponNames = new Map((await db.coupon.findMany({ where: { id: { in: coupons.map((c) => c.couponId) } } })).map((c) => [c.id, c.code]));

  return (
    <>
      <PageHeader title="Relatórios" action={<a href={`/api/admin/relatorios/pedidos.csv?de=${de}&ate=${ate}`} className="btn btn-secundario btn-pequeno">Exportar pedidos (CSV)</a>} />
      <form className="cartao p-4 flex flex-wrap gap-3 items-end mb-6">
        <div><label htmlFor="de" className="rotulo">De</label><input id="de" name="de" type="date" defaultValue={de} className="campo" /></div>
        <div><label htmlFor="ate" className="rotulo">Até</label><input id="ate" name="ate" type="date" defaultValue={ate} className="campo" /></div>
        <button className="btn btn-primario">Atualizar</button>
      </form>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Faturamento" value={formatBRL(agg._sum.totalCents ?? 0)} />
        <Stat label="Pedidos pagos" value={agg._count} />
        <Stat label="Descontos concedidos" value={formatBRL(agg._sum.discountCents ?? 0)} />
        <Stat label="Frete cobrado" value={formatBRL(agg._sum.shippingCents ?? 0)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <section className="cartao p-5"><h2 className="text-2xl">Vendas por categoria</h2>
          <table className="tabela mt-3"><thead><tr><th scope="col">Categoria</th><th scope="col">Itens</th><th scope="col">Total</th></tr></thead>
            <tbody>{byCategory.map((r) => <tr key={r.categoria}><td>{r.categoria}</td><td>{String(r.quantidade)}</td><td>{formatBRL(Number(r.total))}</td></tr>)}</tbody></table>
        </section>
        <section className="cartao p-5"><h2 className="text-2xl">Uso de cupons</h2>
          <table className="tabela mt-3"><thead><tr><th scope="col">Cupom</th><th scope="col">Usos</th><th scope="col">Desconto</th></tr></thead>
            <tbody>{coupons.map((c) => <tr key={c.couponId}><td>{couponNames.get(c.couponId)}</td><td>{c._count}</td><td>{formatBRL(c._sum.amountCents ?? 0)}</td></tr>)}</tbody></table>
        </section>
        <section className="cartao p-5 lg:col-span-2"><h2 className="text-2xl">Estoque parado (sem venda em 90 dias)</h2>
          <table className="tabela mt-3"><thead><tr><th scope="col">Produto</th><th scope="col">Código</th><th scope="col">Estoque</th></tr></thead>
            <tbody>{stale.map((r) => <tr key={r.sku}><td>{r.nome}</td><td>{r.sku}</td><td>{r.estoque}</td></tr>)}</tbody></table>
        </section>
      </div>
    </>
  );
}
