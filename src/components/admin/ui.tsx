import Link from "next/link";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {description && <p className="text-suave mt-1 max-w-prose">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Mensagem de retorno lida da URL (?ok=… ou ?erro=…), anunciada para leitores de tela. */
export function Flash({ sp }: { sp: { ok?: string; erro?: string } }) {
  if (!sp.ok && !sp.erro) return null;
  const errorText = sp.erro === "sem-permissao" ? "Você não tem permissão para acessar essa área." : sp.erro;
  return (
    <p role={sp.erro ? "alert" : "status"} className={`cartao p-4 mb-5 font-semibold ${sp.erro ? "border-2 border-promo text-promo" : "border-2 border-sucesso text-sucesso"}`}>
      {sp.ok ?? errorText}
    </p>
  );
}

export function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <span className="block text-suave text-sm">{label}</span>
      <span className="block text-3xl font-bold text-marca-escuro mt-1">{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className="cartao p-5 block hover:border-marca">{body}</Link>
  ) : (
    <div className="cartao p-5">{body}</div>
  );
}

export function Badge({ children, tone = "neutro" }: { children: React.ReactNode; tone?: "neutro" | "ok" | "alerta" | "erro" | "marca" }) {
  const cls = {
    neutro: "bg-gelo text-texto border border-contorno",
    ok: "bg-[#e6f4ec] text-sucesso",
    alerta: "bg-[#fff3d6] text-alerta",
    erro: "bg-[#fbe9e7] text-promo",
    marca: "bg-marca text-white",
  }[tone];
  return <span className={`selo ${cls}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="cartao p-8 text-center text-suave">{children}</p>;
}

