import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { anonymizeCustomer, closeDataRequest } from "../team-actions";

export const metadata = { title: "Clientes e LGPD" };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; q?: string }> }) {
  const user = await requireStaff("clientes.ver");
  const sp = await searchParams;
  const [requests, customers] = await Promise.all([
    db.dataRequest.findMany({ where: { status: "ABERTA" }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({
      where: { role: "CLIENTE", status: { not: "ANONIMIZADO" }, ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }] } : {}) },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const lgpd = can(user.role, "clientes.lgpd");

  return (
    <>
      <PageHeader title="Clientes e LGPD" />
      <Flash sp={sp} />
      <section className="cartao p-5 mb-6" aria-labelledby="t-lgpd">
        <h2 id="t-lgpd" className="text-2xl">Solicitações de titulares em aberto</h2>
        <p className="ajuda">Prazo de resposta: 15 dias a partir do pedido.</p>
        {requests.length === 0 ? <p className="mt-2 text-suave">Nenhuma solicitação em aberto.</p> : (
          <ul className="mt-3 space-y-3">
            {requests.map((r) => {
              const days = Math.floor((Date.now() - r.createdAt.getTime()) / 86400000);
              return (
                <li key={r.id} className="border border-contorno rounded-lg p-4">
                  <p><strong>{r.type}</strong> · {r.user.name} ({r.user.email}) · aberta em {fmtDateTime(r.createdAt)} <Badge tone={days > 10 ? "erro" : "alerta"}>{days} dia(s)</Badge></p>
                  {r.details && <p className="mt-1 text-suave">{r.details}</p>}
                  {lgpd && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.type === "EXCLUSAO" && (
                        <form action={anonymizeCustomer}>
                          <input type="hidden" name="requestId" value={r.id} />
                          <ConfirmButton message="Anonimizar este cliente e eliminar as receitas? Não pode ser desfeito.">Anonimizar e eliminar receitas</ConfirmButton>
                        </form>
                      )}
                      <form action={closeDataRequest}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <button name="status" value="ATENDIDA" className="btn btn-secundario btn-pequeno">Marcar como atendida</button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form className="cartao p-4 flex gap-3 items-end mb-4" role="search">
        <div className="flex-1"><label htmlFor="q" className="rotulo">Buscar cliente</label><input id="q" name="q" defaultValue={sp.q} className="campo" /></div>
        <button className="btn btn-primario">Buscar</button>
      </form>
      <div className="cartao overflow-x-auto">
        <table className="tabela">
          <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Telefone</th><th scope="col">Pedidos</th><th scope="col">Comunicações</th><th scope="col">Desde</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.email}</td><td>{c.phone ?? "—"}</td><td>{c._count.orders}</td>
                <td>{c.marketingOptIn ? <Badge tone="ok">aceita</Badge> : "não"}</td><td>{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
