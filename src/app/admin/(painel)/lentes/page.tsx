import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { centsToInput } from "@/lib/money";
import { Flash, PageHeader } from "@/components/admin/ui";
import { saveLens, saveTreatment } from "../config-actions";

export const metadata = { title: "Lentes e tratamentos" };

const KINDS = [["VISAO_SIMPLES", "Visão simples"], ["MULTIFOCAL", "Multifocal"], ["OCUPACIONAL", "Ocupacional"], ["BIFOCAL", "Bifocal"]] as const;

export default async function LentesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireStaff("lentes.editar");
  const [lenses, treatments] = await Promise.all([
    db.lensOption.findMany({ orderBy: [{ kind: "asc" }, { priceCents: "asc" }] }),
    db.treatment.findMany({ orderBy: { priceCents: "asc" } }),
  ]);
  const lensRow = (l?: (typeof lenses)[number]) => (
    <form key={l?.id ?? "nova"} action={saveLens} className={`grid sm:grid-cols-2 lg:grid-cols-10 gap-2 items-end pb-3 border-b border-contorno ${l ? "" : "bg-gelo p-3 rounded-lg"}`}>
      {l && <input type="hidden" name="id" value={l.id} />}
      {!l && <p className="sm:col-span-2 lg:col-span-10 font-semibold">Nova lente</p>}
      <div className="lg:col-span-2"><label className="text-sm" htmlFor={`k-${l?.id}`}>Tipo</label>
        <select id={`k-${l?.id}`} name="kind" defaultValue={l?.kind ?? "VISAO_SIMPLES"} className="campo min-h-10">{KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      <div className="lg:col-span-2"><label className="text-sm" htmlFor={`n-${l?.id}`}>Nome</label><input id={`n-${l?.id}`} name="name" defaultValue={l?.name} required className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`i-${l?.id}`}>Índice</label><input id={`i-${l?.id}`} name="refractiveIdx" defaultValue={l?.refractiveIdx ?? "1.50"} className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`p-${l?.id}`}>Preço par (R$)</label><input id={`p-${l?.id}`} name="price" defaultValue={centsToInput(l?.priceCents)} required className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`mi-${l?.id}`}>Esf. mín.</label><input id={`mi-${l?.id}`} name="minSphere" defaultValue={l?.minSphere ?? -8} className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`ma-${l?.id}`}>Esf. máx.</label><input id={`ma-${l?.id}`} name="maxSphere" defaultValue={l?.maxSphere ?? 6} className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`c-${l?.id}`}>Cil. máx.</label><input id={`c-${l?.id}`} name="maxCylinder" defaultValue={l?.maxCylinder ?? 4} className="campo min-h-10" /></div>
      <div><label className="text-sm" htmlFor={`d-${l?.id}`}>Prazo (dias)</label><input id={`d-${l?.id}`} name="productionDays" defaultValue={l?.productionDays ?? 7} className="campo min-h-10" /></div>
      <div className="lg:col-span-6"><label className="text-sm" htmlFor={`desc-${l?.id}`}>Descrição curta</label><input id={`desc-${l?.id}`} name="description" defaultValue={l?.description ?? ""} className="campo min-h-10" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={l?.active ?? true} className="w-5 h-5 accent-marca" /> Ativa</label>
      <button className="btn btn-secundario btn-pequeno">{l ? "Salvar" : "Adicionar"}</button>
    </form>
  );

  return (
    <>
      <PageHeader title="Lentes e tratamentos" description="Alimentam o configurador “Monte seu óculos”. Faixas de grau evitam vender lente que não atende a receita." />
      <Flash sp={await searchParams} />
      <section className="cartao p-5 space-y-3" aria-labelledby="t-lentes">
        <h2 id="t-lentes" className="text-2xl">Lentes</h2>
        {lenses.map((l) => lensRow(l))}
        {lensRow()}
      </section>
      <section className="cartao p-5 space-y-3 mt-6" aria-labelledby="t-trat">
        <h2 id="t-trat" className="text-2xl">Tratamentos</h2>
        {[...treatments, undefined].map((t) => (
          <form key={t?.id ?? "novo"} action={saveTreatment} className={`grid sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end pb-3 border-b border-contorno ${t ? "" : "bg-gelo p-3 rounded-lg"}`}>
            {t && <input type="hidden" name="id" value={t.id} />}
            <div className="lg:col-span-2"><label className="text-sm" htmlFor={`tn-${t?.id}`}>Nome</label><input id={`tn-${t?.id}`} name="name" defaultValue={t?.name} required className="campo min-h-10" /></div>
            <div className="lg:col-span-2"><label className="text-sm" htmlFor={`td-${t?.id}`}>Descrição</label><input id={`td-${t?.id}`} name="description" defaultValue={t?.description ?? ""} className="campo min-h-10" /></div>
            <div><label className="text-sm" htmlFor={`tp-${t?.id}`}>Preço (R$)</label><input id={`tp-${t?.id}`} name="price" defaultValue={centsToInput(t?.priceCents)} required className="campo min-h-10" /></div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={t?.active ?? true} className="w-5 h-5 accent-marca" /> Ativo</label>
              <button className="btn btn-secundario btn-pequeno">{t ? "Salvar" : "Adicionar"}</button>
            </div>
          </form>
        ))}
      </section>
    </>
  );
}
