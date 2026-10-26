import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader } from "@/components/admin/ui";
import { adjustStock } from "./actions";

export const metadata = { title: "Estoque" };

const MOV_LABEL: Record<string, string> = {
  ENTRADA: "Entrada", VENDA_ONLINE: "Venda online", VENDA_LOJA: "Venda na loja", RESERVA: "Reserva", LIBERACAO_RESERVA: "Reserva liberada",
  PERDA: "Perda", CORRECAO: "Correção", DEVOLUCAO: "Devolução",
};

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ q?: string; baixo?: string; v?: string; ok?: string; erro?: string }> }) {
  const user = await requireStaff("estoque.ver");
  const sp = await searchParams;
  const variants = await db.variant.findMany({
    where: {
      product: { deletedAt: null, ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q.toUpperCase() } }] } : {}) },
    },
    include: { product: { select: { name: true, id: true, brand: true } } },
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    take: 300,
  });
  const list = sp.baixo ? variants.filter((v) => v.active && v.stock - v.reserved <= v.minStock) : variants;
  const selected = sp.v ? await db.variant.findUnique({ where: { id: sp.v }, include: { product: true, movements: { orderBy: { createdAt: "desc" }, take: 30 } } }) : null;
  const users = selected ? new Map((await db.user.findMany({ where: { id: { in: selected.movements.map((m) => m.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])) : new Map();
  const backUrl = `/admin/estoque?${new URLSearchParams(Object.entries({ q: sp.q, baixo: sp.baixo, v: sp.v }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader title="Estoque" description="Estoque livre = estoque − reservado em pedidos aguardando pagamento." />
      <Flash sp={sp} />
      <form className="cartao p-4 flex flex-wrap gap-3 items-end mb-5" role="search">
        <div className="flex-1 min-w-60"><label htmlFor="q" className="rotulo">Buscar produto</label><input id="q" name="q" defaultValue={sp.q} className="campo" /></div>
        <label className="flex items-center gap-2 min-h-12"><input type="checkbox" name="baixo" value="1" defaultChecked={!!sp.baixo} className="w-5 h-5 accent-marca" /> Só estoque baixo</label>
        <button className="btn btn-primario">Filtrar</button>
      </form>

      <div className="grid xl:grid-cols-[1fr_420px] gap-6 items-start">
        {list.length === 0 ? <Empty>Nada por aqui.</Empty> : (
          <div className="cartao overflow-x-auto">
            <table className="tabela">
              <thead><tr><th scope="col">Produto / variação</th><th scope="col">Estoque</th><th scope="col">Reservado</th><th scope="col">Livre</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead>
              <tbody>
                {list.map((v) => {
                  const free = v.stock - v.reserved;
                  return (
                    <tr key={v.id} className={sp.v === v.id ? "bg-gelo" : ""}>
                      <td><Link href={`/admin/produtos/${v.product.id}`} className="underline">{v.product.name}</Link><span className="block text-sm text-suave">{v.sku}{v.color ? ` · ${v.color}` : ""}{v.size ? ` · ${v.size}` : ""}{!v.active ? " · inativa" : ""}</span></td>
                      <td>{v.stock}</td><td>{v.reserved}</td>
                      <td>{free <= 0 ? <Badge tone="erro">{free}</Badge> : free <= v.minStock ? <Badge tone="alerta">{free}</Badge> : free}</td>
                      <td><Link href={`/admin/estoque?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.baixo ? { baixo: "1" } : {}), v: v.id })}`} className="btn btn-secundario btn-pequeno">Ajustar</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <aside className="cartao p-5 xl:sticky xl:top-6" aria-labelledby="t-ajuste">
            <h2 id="t-ajuste" className="text-2xl">{selected.product.name}</h2>
            <p className="text-suave">{selected.sku} · estoque {selected.stock} · reservado {selected.reserved}</p>
            {can(user.role, "estoque.ajustar") && (
              <form action={adjustStock} className="mt-4 space-y-3">
                <input type="hidden" name="variantId" value={selected.id} />
                <input type="hidden" name="back" value={backUrl} />
                <div>
                  <label htmlFor="type" className="rotulo">Movimentação</label>
                  <select id="type" name="type" className="campo" required>
                    <option value="ENTRADA">Entrada (chegou mercadoria)</option>
                    <option value="VENDA_LOJA">Venda na loja física</option>
                    <option value="PERDA">Perda / avaria</option>
                    <option value="CORRECAO">Correção de contagem (+ ou −)</option>
                  </select>
                </div>
                <div><label htmlFor="quantity" className="rotulo">Quantidade</label><input id="quantity" name="quantity" type="number" required className="campo" /></div>
                <div><label htmlFor="reason" className="rotulo">Motivo *</label><input id="reason" name="reason" required minLength={3} className="campo" placeholder="Ex.: nota fiscal 123, contagem mensal" /></div>
                <button className="btn btn-primario w-full">Registrar</button>
              </form>
            )}
            <h3 className="font-sans font-semibold mt-6">Histórico</h3>
            <ul className="mt-2 text-sm space-y-1.5 max-h-96 overflow-y-auto">
              {selected.movements.map((m) => (
                <li key={m.id} className="border-b border-contorno pb-1.5">
                  <strong>{MOV_LABEL[m.type]}</strong> {m.quantity > 0 ? `+${m.quantity}` : m.quantity} · {fmtDateTime(m.createdAt)}
                  <span className="block text-suave">{m.reason ?? ""}{m.userId ? ` · ${users.get(m.userId) ?? ""}` : ""}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </>
  );
}
