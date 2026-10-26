import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { fmtDateTime } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader } from "@/components/admin/ui";
import { toggleMessage } from "../config-actions";

export const metadata = { title: "Mensagens" };

export default async function MensagensPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; todas?: string }> }) {
  await requireStaff("mensagens.ver");
  const sp = await searchParams;
  const msgs = await db.contactMessage.findMany({ where: sp.todas ? {} : { handled: false }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Mensagens do Fale conosco" action={<a href={sp.todas ? "?" : "?todas=1"} className="btn btn-secundario btn-pequeno">{sp.todas ? "Só não respondidas" : "Ver todas"}</a>} />
      <Flash sp={sp} />
      {msgs.length === 0 ? <Empty>Nenhuma mensagem pendente.</Empty> : (
        <ul className="space-y-4">
          {msgs.map((m) => (
            <li key={m.id} className="cartao p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{m.subject} {m.handled ? <Badge tone="ok">respondida</Badge> : <Badge tone="alerta">pendente</Badge>}</p>
                <p className="text-sm text-suave">{fmtDateTime(m.createdAt)}</p>
              </div>
              <p className="text-sm mt-1">{m.name} · <a className="underline" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>{m.email}</a>{m.phone ? ` · ${m.phone}` : ""}</p>
              <p className="mt-3 whitespace-pre-line">{m.message}</p>
              <form action={toggleMessage} className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="handled" value={m.handled ? "0" : "1"} />
                <div><label htmlFor={`n-${m.id}`} className="text-sm">Anotação interna</label><input id={`n-${m.id}`} name="notes" defaultValue={m.notes ?? ""} className="campo min-h-10" /></div>
                <button className="btn btn-secundario btn-pequeno">{m.handled ? "Reabrir" : "Marcar como respondida"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
