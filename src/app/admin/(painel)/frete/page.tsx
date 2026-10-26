import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { centsToInput } from "@/lib/money";
import { formatCep } from "@/lib/format";
import { Flash, PageHeader } from "@/components/admin/ui";
import { saveZone } from "../config-actions";

export const metadata = { title: "Frete e retirada" };

export default async function FretePage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireStaff("frete.editar");
  const zones = await db.shippingZone.findMany({ orderBy: { cepStart: "asc" } });
  return (
    <>
      <PageHeader title="Frete e retirada" description="Zonas por faixa de CEP. A retirada na loja é sempre gratuita. Confira as faixas oficiais de CEP de cada bairro/cidade nos Correios." />
      <Flash sp={await searchParams} />
      <section className="cartao p-5 space-y-3">
        {[...zones, undefined].map((z) => (
          <form key={z?.id ?? "nova"} action={saveZone} className={`grid sm:grid-cols-2 lg:grid-cols-8 gap-2 items-end pb-3 border-b border-contorno ${z ? "" : "bg-gelo p-3 rounded-lg"}`}>
            {z && <input type="hidden" name="id" value={z.id} />}
            {!z && <p className="sm:col-span-2 lg:col-span-8 font-semibold">Nova zona</p>}
            <div className="lg:col-span-2"><label className="text-sm" htmlFor={`n-${z?.id}`}>Nome</label><input id={`n-${z?.id}`} name="name" defaultValue={z?.name} required className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`a-${z?.id}`}>CEP inicial</label><input id={`a-${z?.id}`} name="cepStart" defaultValue={z ? formatCep(z.cepStart) : ""} required className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`b-${z?.id}`}>CEP final</label><input id={`b-${z?.id}`} name="cepEnd" defaultValue={z ? formatCep(z.cepEnd) : ""} required className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`p-${z?.id}`}>Valor (R$)</label><input id={`p-${z?.id}`} name="price" defaultValue={centsToInput(z?.priceCents)} required className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`d-${z?.id}`}>Prazo (dias úteis)</label><input id={`d-${z?.id}`} name="days" type="number" min={0} defaultValue={z?.days ?? 1} className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`f-${z?.id}`}>Grátis acima de (R$)</label><input id={`f-${z?.id}`} name="freeAbove" defaultValue={z?.freeAboveCents ? centsToInput(z.freeAboveCents) : ""} className="campo min-h-10" /></div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={z?.active ?? true} className="w-5 h-5 accent-marca" /> Ativa</label>
              <button className="btn btn-secundario btn-pequeno">{z ? "Salvar" : "Adicionar"}</button>
            </div>
          </form>
        ))}
      </section>
    </>
  );
}
