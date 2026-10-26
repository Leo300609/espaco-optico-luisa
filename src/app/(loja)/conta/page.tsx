import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/guards";
import { ORDER_STATUS_LABEL, RX_STATUS_LABEL, fmtDate } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { signOut } from "./actions";
import { AccountForms } from "./AccountForms";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function ContaPage() {
  const user = await requireCustomer("/conta");
  const [orders, prescriptions] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.prescription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="conteudo py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Minha conta</h1>
          <p className="text-suave">Olá, {user.name.split(" ")[0]}!</p>
        </div>
        <form action={signOut}><button className="btn btn-secundario btn-pequeno">Sair</button></form>
      </div>

      <section className="mt-8" aria-labelledby="t-pedidos">
        <h2 id="t-pedidos" className="text-3xl">Meus pedidos</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-suave">Você ainda não fez pedidos. <Link href="/catalogo" className="underline">Ver produtos</Link></p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="tabela">
              <thead><tr><th scope="col">Pedido</th><th scope="col">Data</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.number}</td>
                    <td>{fmtDate(o.createdAt)}</td>
                    <td>{ORDER_STATUS_LABEL[o.status]}</td>
                    <td>{formatBRL(o.totalCents)}</td>
                    <td><Link href={`/pedido/${o.publicToken}`} className="underline">Acompanhar<span className="sr-only"> pedido {o.number}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="t-receitas">
        <h2 id="t-receitas" className="text-3xl">Minhas receitas</h2>
        {prescriptions.length === 0 ? (
          <p className="mt-3 text-suave">Nenhuma receita enviada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prescriptions.map((p) => (
              <li key={p.id} className="cartao p-4 flex flex-wrap justify-between gap-2">
                <span>Enviada em {fmtDate(p.createdAt)}{p.issuedAt ? ` · emitida em ${fmtDate(p.issuedAt)}` : ""}</span>
                <span><strong>{RX_STATUS_LABEL[p.status]}</strong>{p.reason ? ` — ${p.reason}` : ""}</span>
                <span className="text-sm text-suave w-full">Guardada criptografada até {fmtDate(p.deleteAfter)}.</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AccountForms name={user.name} phone={user.phone ?? ""} marketing={user.marketingOptIn} />
    </div>
  );
}
