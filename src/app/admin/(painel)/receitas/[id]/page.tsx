import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { decryptJSON } from "@/lib/crypto";
import { formatDiopter, rxWarnings, type RxData } from "@/lib/optics";
import { RX_STATUS_LABEL, fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { RxViewer } from "@/components/admin/RxViewer";
import { markInReview, reviewPrescription } from "../actions";

export const metadata = { title: "Conferir receita" };

const PRESETS = [
  "Foto ilegível ou cortada",
  "Valores digitados diferentes da receita",
  "Receita vencida",
  "Falta a adição para lente multifocal",
  "Falta a DNP",
  "Grau fora da faixa da lente escolhida",
];

export default async function ReceitaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireStaff("receitas.ver");
  const { id } = await params;
  const rx = await db.prescription.findUnique({
    where: { id },
    include: {
      orders: { include: { items: true } },
      reviewedBy: { select: { name: true } },
      views: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!rx) notFound();
  await db.rxAccessLog.create({ data: { prescriptionId: rx.id, userId: user.id, action: "ver_dados" } });
  await audit(user.id, "receita_visualizada", "receita", rx.id);

  const data = rx.dataEnc ? decryptJSON<RxData>(rx.dataEnc) : null;
  const warnings = data ? rxWarnings(data) : [];
  const lenses = rx.orders.flatMap((o) => o.items.map((i) => i.lensConfig as null | { lens: { name: string; kind: string; index: string } })).filter(Boolean);
  const staffNames = new Map((await db.user.findMany({ where: { id: { in: rx.views.map((v) => v.userId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const canReview = can(user.role, "receitas.revisar");

  return (
    <>
      <PageHeader title="Conferir receita" description={`Pedido(s): ${rx.orders.map((o) => `#${o.number} — ${o.customerName}`).join(", ")}`}
        action={<Link href="/admin/receitas" className="btn btn-secundario btn-pequeno">Voltar à fila</Link>} />
      <Flash sp={await searchParams} />
      <p className="mb-4">Status: <Badge tone={rx.status === "APROVADA" ? "ok" : rx.status === "RECUSADA" ? "erro" : "alerta"}>{RX_STATUS_LABEL[rx.status]}</Badge>
        {rx.reviewedBy && <span className="text-suave text-sm"> · decidido por {rx.reviewedBy.name} em {rx.reviewedAt ? fmtDateTime(rx.reviewedAt) : ""}</span>}
      </p>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <section className="cartao p-4" aria-labelledby="t-arquivos">
          <h2 id="t-arquivos" className="text-2xl mb-3">Arquivos enviados</h2>
          {rx.fileKeys.length === 0 ? <p className="text-suave">Nenhum arquivo enviado.</p> : (
            <RxViewer files={rx.fileKeys.map((k, i) => ({ url: `/api/admin/receitas/${rx.id}/arquivo/${i}`, isPdf: k.includes(".pdf") }))} />
          )}
        </section>

        <div className="space-y-6">
          <section className="cartao p-4" aria-labelledby="t-valores">
            <h2 id="t-valores" className="text-2xl">Valores digitados pelo cliente</h2>
            {!data ? <p className="text-suave mt-2">O cliente não digitou valores; confira apenas pela imagem.</p> : (
              <>
                <table className="tabela mt-3">
                  <thead><tr><th scope="col">Olho</th><th scope="col">Esférico</th><th scope="col">Cilíndrico</th><th scope="col">Eixo</th><th scope="col">Adição</th><th scope="col">DNP</th><th scope="col">Altura</th></tr></thead>
                  <tbody>
                    {([["OD (direito)", data.od], ["OE (esquerdo)", data.oe]] as const).map(([label, e]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        <td>{formatDiopter(e.sphere)}</td><td>{formatDiopter(e.cylinder)}</td><td>{e.axis ?? "—"}{e.axis != null ? "°" : ""}</td>
                        <td>{formatDiopter(e.addition)}</td><td>{e.dnp ?? "—"}</td><td>{e.height ?? (data.heightAtStore ? "medir na loja" : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.totalDp && <p className="mt-2">DP total: {data.totalDp} mm</p>}
                {warnings.length > 0 && (
                  <ul className="mt-3 space-y-1" aria-label="Alertas">
                    {warnings.map((w) => <li key={w}><Badge tone="alerta">Atenção</Badge> {w}</li>)}
                  </ul>
                )}
              </>
            )}
            <dl className="mt-4 text-[0.97rem] space-y-1">
              <div><dt className="inline font-semibold">Profissional: </dt><dd className="inline">{rx.doctorName ?? "—"} {rx.doctorReg ? `(${rx.doctorReg})` : ""}</dd></div>
              <div><dt className="inline font-semibold">Data da receita: </dt><dd className="inline">{rx.issuedAt ? fmtDate(rx.issuedAt) : "—"}</dd></div>
              {rx.issuedAt && Date.now() - rx.issuedAt.getTime() > 365 * 86400000 && <div><Badge tone="erro">Receita com mais de 12 meses</Badge></div>}
              {rx.customerNotes && <div><dt className="inline font-semibold">Obs. do cliente: </dt><dd className="inline">{rx.customerNotes}</dd></div>}
            </dl>
            {lenses.length > 0 && (
              <p className="mt-3"><strong>Lentes escolhidas:</strong> {lenses.map((l) => `${l!.lens.name} ${l!.lens.index}`).join(", ")}</p>
            )}
          </section>

          {canReview && rx.status !== "APROVADA" && (
            <section className="cartao p-4 border-2 border-marca" aria-labelledby="t-decisao">
              <h2 id="t-decisao" className="text-2xl">Decisão</h2>
              {rx.status === "RECEBIDA" && (
                <form action={markInReview} className="mt-2">
                  <input type="hidden" name="id" value={rx.id} />
                  <button className="btn btn-secundario btn-pequeno">Marcar como "em análise"</button>
                </form>
              )}
              <form action={reviewPrescription} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={rx.id} />
                <fieldset>
                  <legend className="rotulo">Resultado</legend>
                  {[["APROVADA", "Aprovar — tudo confere"], ["PENDENTE_CORRECAO", "Pedir correção ao cliente"], ["RECUSADA", "Recusar"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 py-1"><input type="radio" name="decision" value={v} required className="w-5 h-5 accent-marca" /> {l}</label>
                  ))}
                </fieldset>
                <div>
                  <label htmlFor="reasonPreset" className="rotulo">Motivo (para correção ou recusa)</label>
                  <select id="reasonPreset" name="reasonPreset" className="campo" defaultValue="">
                    <option value="">Selecione…</option>
                    {PRESETS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="reason" className="rotulo">Detalhes para o cliente</label>
                  <textarea id="reason" name="reason" maxLength={400} className="campo" />
                </div>
                <button className="btn btn-primario">Registrar decisão</button>
              </form>
            </section>
          )}

          <section className="cartao p-4" aria-labelledby="t-acessos">
            <h2 id="t-acessos" className="text-xl">Últimos acessos a esta receita</h2>
            <ul className="mt-2 text-sm space-y-1">
              {rx.views.map((v) => <li key={v.id}>{fmtDateTime(v.createdAt)} — {staffNames.get(v.userId) ?? "?"} — {v.action}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
