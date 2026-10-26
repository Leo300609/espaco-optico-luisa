import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { expireStaleOrders } from "@/lib/orders";
import { ORDER_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { Badge, Empty, Flash, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Pedidos" };

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export default async function PedidosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff("pedidos.ver");
  await expireStaleOrders();
  const sp = await searchParams;
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as OrderStatus)) where.status = sp.status as OrderStatus;
  if (sp.entrega === "ENTREGA" || sp.entrega === "RETIRADA") where.fulfillment = sp.entrega;
  if (sp.pagamento === "PIX" || sp.pagamento === "CARTAO") where.paymentMethod = sp.pagamento;
  if (sp.q) {
    const n = Number(sp.q.replace("#", ""));
    where.OR = [
      ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
      { customerName: { contains: sp.q, mode: "insensitive" } },
      { customerEmail: { contains: sp.q, mode: "insensitive" } },
      { pickupCode: sp.q.toUpperCase() },
    ];
  }
  const page = Math.max(1, Number(sp.pagina) || 1);
  const pageLink = (n: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1] && !["ok", "erro"].includes(e[0])));
    q.set("pagina", String(n));
    return `?${q}`;
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { prescription: { select: { status: true } } } }),
    db.order.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Pedidos" description={`${total} pedido(s) encontrados.`} />
      <Flash sp={sp} />
      <form className="cartao p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-5" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="rotulo">Buscar</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Nº, nome, e-mail ou código de retirada" className="campo" />
        </div>
        <div>
          <label htmlFor="status" className="rotulo">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="campo">
            <option value="">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="entrega" className="rotulo">Recebimento</label>
          <select id="entrega" name="entrega" defaultValue={sp.entrega ?? ""} className="campo">
            <option value="">Todos</option><option value="RETIRADA">Retirada</option><option value="ENTREGA">Entrega</option>
          </select>
        </div>
        <button className="btn btn-primario">Filtrar</button>
      </form>

      {orders.length === 0 ? <Empty>Nenhum pedido encontrado.</Empty> : (
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col">Receita</th><th scope="col">Recebimento</th><th scope="col">Total</th><th scope="col">Data</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/pedidos/${o.id}`} className="underline font-semibold">#{o.number}</Link></td>
                  <td>{o.customerName}</td>
                  <td><Badge tone={o.status === "CANCELADO" ? "erro" : o.status.startsWith("AGUARDANDO") || o.status.startsWith("RECEITA") ? "alerta" : "ok"}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td>{o.prescription ? o.prescription.status.replace("_", " ").toLowerCase() : "—"}</td>
                  <td>{o.fulfillment === "RETIRADA" ? "Retirada" : "Entrega"} · {o.paymentMethod === "PIX" ? "Pix" : "Cartão"}</td>
                  <td>{formatBRL(o.totalCents)}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 30 && (
        <nav aria-label="Paginação" className="mt-4 flex gap-3">
          {page > 1 && <Link className="btn btn-secundario btn-pequeno" href={pageLink(page - 1)}>Anterior</Link>}
          {page * 30 < total && <Link className="btn btn-secundario btn-pequeno" href={pageLink(page + 1)}>Próxima</Link>}
        </nav>
      )}
    </>
  );
}
