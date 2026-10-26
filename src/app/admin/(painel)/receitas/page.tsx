import Link from "next/link";
import type { RxStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { RX_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Fila de receitas" };

export default async function ReceitasPage({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; erro?: string }> }) {
  await requireStaff("receitas.ver");
  const sp = await searchParams;
  const statuses = Object.keys(RX_STATUS_LABEL) as RxStatus[];
  const filter = statuses.includes(sp.status as RxStatus) ? (sp.status as RxStatus) : undefined;
  const list = await db.prescription.findMany({
    where: filter ? { status: filter } : { status: { in: ["RECEBIDA", "EM_ANALISE"] }, OR: [{ fileKeys: { isEmpty: false } }, { dataEnc: { not: null } }] },
    include: { orders: { select: { id: true, number: true, customerName: true, status: true, paidAt: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Fila de receitas" description="Mais antigas primeiro. Pedidos com lentes só seguem para produção após aprovação." />
      <Flash sp={sp} />
      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2 mb-5">
        <Link href="/admin/receitas" className={`btn btn-pequeno ${!filter ? "btn-primario" : "btn-secundario"}`}>A conferir</Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/receitas?status=${s}`} className={`btn btn-pequeno ${filter === s ? "btn-primario" : "btn-secundario"}`}>{RX_STATUS_LABEL[s]}</Link>
        ))}
      </nav>
      {list.length === 0 ? <Empty>Nenhuma receita nesta situação. 🎉</Empty> : (
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead><tr><th scope="col">Recebida em</th><th scope="col">Cliente / pedido</th><th scope="col">Conteúdo</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead>
            <tbody>
              {list.map((rx) => (
                <tr key={rx.id}>
                  <td>{fmtDateTime(rx.updatedAt)}</td>
                  <td>{rx.orders.map((o) => <span key={o.id} className="block">{o.customerName} · #{o.number}{o.paidAt ? "" : " (não pago)"}</span>)}</td>
                  <td>{rx.dataEnc ? "Valores digitados" : ""}{rx.dataEnc && rx.fileKeys.length ? " + " : ""}{rx.fileKeys.length ? `${rx.fileKeys.length} arquivo(s)` : ""}{!rx.dataEnc && !rx.fileKeys.length ? "Aguardando envio" : ""}</td>
                  <td><Badge tone={rx.status === "APROVADA" ? "ok" : rx.status === "RECUSADA" ? "erro" : "alerta"}>{RX_STATUS_LABEL[rx.status]}</Badge></td>
                  <td><Link href={`/admin/receitas/${rx.id}`} className="btn btn-secundario btn-pequeno">Conferir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
