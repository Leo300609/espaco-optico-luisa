import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Registro de atividades" };

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<{ q?: string; usuario?: string }> }) {
  await requireStaff("atividades.ver");
  const sp = await searchParams;
  const staff = await db.user.findMany({ where: { role: { not: "CLIENTE" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const logs = await db.auditLog.findMany({
    where: {
      ...(sp.usuario ? { userId: sp.usuario } : {}),
      ...(sp.q ? { OR: [{ action: { contains: sp.q } }, { entity: { contains: sp.q } }, { summary: { contains: sp.q, mode: "insensitive" } }] } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <PageHeader title="Registro de atividades" description="Quem alterou o quê e quando (preços, estoque, receitas, usuários, configurações). Mantido por 12 meses." />
      <form className="cartao p-4 flex flex-wrap gap-3 items-end mb-4" role="search">
        <div className="flex-1 min-w-52"><label htmlFor="q" className="rotulo">Buscar ação</label><input id="q" name="q" defaultValue={sp.q} className="campo" placeholder="ex.: receita, preco, login" /></div>
        <div><label htmlFor="usuario" className="rotulo">Pessoa</label>
          <select id="usuario" name="usuario" defaultValue={sp.usuario ?? ""} className="campo"><option value="">Todas</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <button className="btn btn-primario">Filtrar</button>
      </form>
      <div className="cartao overflow-x-auto">
        <table className="tabela">
          <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">Item</th><th scope="col">Resumo</th><th scope="col">IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td><td>{l.user?.name ?? "sistema"}</td>
                <td className="font-mono text-sm">{l.action}</td><td className="text-sm">{l.entity}{l.entityId ? ` ${l.entityId.slice(-6)}` : ""}</td>
                <td className="text-sm">{l.summary ?? ""}</td><td className="text-sm">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
