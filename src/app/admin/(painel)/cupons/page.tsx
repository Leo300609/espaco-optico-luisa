import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { centsToInput, formatBRL } from "@/lib/money";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { saveCoupon } from "../config-actions";

export const metadata = { title: "Cupons" };

const toDate = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");

export default async function CuponsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; editar?: string }> }) {
  await requireStaff("cupons.editar");
  const sp = await searchParams;
  const [coupons, categories] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { uses: { select: { amountCents: true } } } }),
    db.category.findMany({ orderBy: { position: "asc" } }),
  ]);
  const editing = coupons.find((c) => c.id === sp.editar);

  return (
    <>
      <PageHeader title="Cupons de desconto" />
      <Flash sp={sp} />
      <div className="grid xl:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead><tr><th scope="col">Código</th><th scope="col">Desconto</th><th scope="col">Validade</th><th scope="col">Usos</th><th scope="col">Total concedido</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono font-semibold">{c.code}</td>
                  <td>{c.type === "PERCENTUAL" ? `${c.value}%` : c.type === "VALOR_FIXO" ? formatBRL(c.value) : "Frete grátis"}{c.minOrderCents ? <span className="block text-sm text-suave">mín. {formatBRL(c.minOrderCents)}</span> : null}</td>
                  <td className="text-sm">{c.startsAt ? toDate(c.startsAt) : "—"} a {c.endsAt ? toDate(c.endsAt) : "sem fim"}</td>
                  <td>{c.uses.length}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                  <td>{formatBRL(c.uses.reduce((s, u) => s + u.amountCents, 0))}</td>
                  <td><Badge tone={c.active ? "ok" : "neutro"}>{c.active ? "ativo" : "pausado"}</Badge></td>
                  <td><a href={`?editar=${c.id}`} className="underline">Editar</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={saveCoupon} className="cartao p-5 space-y-3">
          <h2 className="text-2xl">{editing ? `Editar ${editing.code}` : "Novo cupom"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div><label htmlFor="code" className="rotulo">Código</label><input id="code" name="code" required defaultValue={editing?.code} className="campo uppercase font-mono" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="type" className="rotulo">Tipo</label>
              <select id="type" name="type" defaultValue={editing?.type ?? "PERCENTUAL"} className="campo"><option value="PERCENTUAL">Percentual</option><option value="VALOR_FIXO">Valor fixo</option><option value="FRETE_GRATIS">Frete grátis</option></select></div>
            <div><label htmlFor="value" className="rotulo">Valor (% ou R$)</label><input id="value" name="value" defaultValue={editing ? (editing.type === "VALOR_FIXO" ? centsToInput(editing.value) : String(editing.value)) : ""} className="campo" /></div>
          </div>
          <div><label htmlFor="minOrder" className="rotulo">Pedido mínimo (R$)</label><input id="minOrder" name="minOrder" defaultValue={editing?.minOrderCents ? centsToInput(editing.minOrderCents) : ""} className="campo" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="startsAt" className="rotulo">Início</label><input id="startsAt" name="startsAt" type="date" defaultValue={toDate(editing?.startsAt ?? null)} className="campo" /></div>
            <div><label htmlFor="endsAt" className="rotulo">Fim</label><input id="endsAt" name="endsAt" type="date" defaultValue={toDate(editing?.endsAt ?? null)} className="campo" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="maxUses" className="rotulo">Limite total</label><input id="maxUses" name="maxUses" type="number" min={1} defaultValue={editing?.maxUses ?? ""} className="campo" /></div>
            <div><label htmlFor="maxUsesPerUser" className="rotulo">Por cliente</label><input id="maxUsesPerUser" name="maxUsesPerUser" type="number" min={1} defaultValue={editing?.maxUsesPerUser ?? 1} className="campo" /></div>
          </div>
          <fieldset>
            <legend className="rotulo">Categorias (vazio = todas)</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" name="categoryIds" value={c.id} defaultChecked={editing?.categoryIds.includes(c.id)} className="w-5 h-5 accent-marca" /> {c.name}</label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2"><input type="checkbox" name="firstOrderOnly" defaultChecked={editing?.firstOrderOnly} className="w-5 h-5 accent-marca" /> Só na primeira compra</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="combineWithPromo" defaultChecked={editing?.combineWithPromo ?? true} className="w-5 h-5 accent-marca" /> Vale para produtos já em promoção</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="w-5 h-5 accent-marca" /> Ativo</label>
          <p className="ajuda">Cupons não se somam: vale um por pedido.</p>
          <button className="btn btn-primario w-full">Salvar cupom</button>
        </form>
      </div>
    </>
  );
}
