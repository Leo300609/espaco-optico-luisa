import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { expireStaleOrders } from "@/lib/orders";
import { Flash, PageHeader, Stat } from "@/components/admin/ui";

const PAID = ["PAGAMENTO_CONFIRMADO", "AGUARDANDO_RECEITA", "RECEITA_EM_ANALISE", "RECEITA_PENDENTE", "EM_PRODUCAO", "SEPARANDO", "PRONTO_RETIRADA", "EM_ROTA", "ENTREGUE", "RETIRADO"] as const;

/** Meia-noite em São Paulo (UTC-3, sem horário de verão desde 2019) de N dias atrás. */
function startOfDaySP(offsetDays = 0) {
  const sp = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - offsetDays, 3, 0, 0));
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireStaff("dashboard");
  await expireStaleOrders();
  const today = startOfDaySP(0);
  const week = startOfDaySP(6);
  const month = startOfDaySP(29);

  const sum = (from: Date) =>
    db.order.aggregate({ where: { paidAt: { gte: from }, status: { in: [...PAID] } }, _sum: { totalCents: true }, _count: true });

  const [d, w, m, byStatus, rxQueue, lowStock, unread, recent, topItems] = await Promise.all([
    sum(today), sum(week), sum(month),
    db.order.groupBy({ by: ["status"], _count: true, where: { status: { notIn: ["ENTREGUE", "RETIRADO", "CANCELADO", "REEMBOLSADO"] } } }),
    db.prescription.count({ where: { status: { in: ["RECEBIDA", "EM_ANALISE"] }, orders: { some: { status: { in: ["RECEITA_EM_ANALISE", "AGUARDANDO_PAGAMENTO", "PAGAMENTO_CONFIRMADO"] } } } } }),
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*)::bigint AS c FROM "Variant" WHERE "active" = true AND "stock" - "reserved" <= "minStock"`,
    db.contactMessage.count({ where: { handled: false } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.orderItem.groupBy({ by: ["name"], _sum: { quantity: true }, where: { order: { paidAt: { gte: month } } }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
  ]);
  const avg = m._count ? Math.round((m._sum.totalCents ?? 0) / m._count) : 0;

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} description="Resumo da loja. Valores consideram pedidos pagos." />
      <Flash sp={await searchParams} />
      {can(user.role, "relatorios.ver") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Vendas hoje" value={formatBRL(d._sum.totalCents ?? 0)} />
          <Stat label="Últimos 7 dias" value={formatBRL(w._sum.totalCents ?? 0)} />
          <Stat label="Últimos 30 dias" value={formatBRL(m._sum.totalCents ?? 0)} />
          <Stat label="Ticket médio (30 dias)" value={formatBRL(avg)} />
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {can(user.role, "receitas.ver") && <Stat label="Receitas para conferir" value={rxQueue} href="/admin/receitas" />}
        {can(user.role, "estoque.ver") && <Stat label="Variações com estoque baixo" value={Number(lowStock[0]?.c ?? 0)} href="/admin/estoque?baixo=1" />}
        {can(user.role, "mensagens.ver") && <Stat label="Mensagens não respondidas" value={unread} href="/admin/mensagens" />}
        <Stat label="Pedidos em andamento" value={byStatus.reduce((s, x) => s + x._count, 0)} href="/admin/pedidos" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <section className="cartao p-5" aria-labelledby="t-status">
          <h2 id="t-status" className="text-2xl">Pedidos por status</h2>
          <ul className="mt-3 divide-y divide-contorno">
            {byStatus.length === 0 && <li className="py-2 text-suave">Nenhum pedido em andamento.</li>}
            {byStatus.map((s) => (
              <li key={s.status} className="py-2 flex justify-between">
                <Link href={`/admin/pedidos?status=${s.status}`} className="underline">{ORDER_STATUS_LABEL[s.status]}</Link>
                <strong>{s._count}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="cartao p-5" aria-labelledby="t-recentes">
          <h2 id="t-recentes" className="text-2xl">Pedidos recentes</h2>
          <ul className="mt-3 divide-y divide-contorno">
            {recent.map((o) => (
              <li key={o.id} className="py-2 flex flex-wrap justify-between gap-2">
                <Link href={`/admin/pedidos/${o.id}`} className="underline">#{o.number} · {o.customerName}</Link>
                <span className="text-suave text-sm">{ORDER_STATUS_LABEL[o.status]} · {formatBRL(o.totalCents)} · {fmtDateTime(o.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
        {can(user.role, "relatorios.ver") && (
          <section className="cartao p-5" aria-labelledby="t-top">
            <h2 id="t-top" className="text-2xl">Mais vendidos (30 dias)</h2>
            <ol className="mt-3 list-decimal pl-5 space-y-1">
              {topItems.length === 0 && <li className="text-suave list-none -ml-5">Sem vendas no período.</li>}
              {topItems.map((t) => <li key={t.name}>{t.name} — <strong>{t._sum.quantity}</strong> un.</li>)}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
