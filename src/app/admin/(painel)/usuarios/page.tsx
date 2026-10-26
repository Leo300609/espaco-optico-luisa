import { db } from "@/lib/db";
import { requireStaff } from "@/lib/guards";
import { ROLE_LABEL } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { Badge, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { createStaff, updateStaff } from "../team-actions";

export const metadata = { title: "Usuários" };

const ROLES = ["PROPRIETARIO", "GERENTE", "ATENDENTE", "OPTICO"] as const;

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const me = await requireStaff("usuarios.gerir");
  const staff = await db.user.findMany({
    where: { role: { in: [...ROLES] } },
    include: { sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Usuários da equipe" description="Cada pessoa tem login próprio, com 2FA obrigatório. Revise os acessos a cada 3 meses e desligue na hora quem sair da equipe." />
      <Flash sp={await searchParams} />
      <div className="space-y-4">
        {staff.map((u) => (
          <section key={u.id} className="cartao p-5" aria-label={u.name}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold text-lg">{u.name} {u.id === me.id && <Badge tone="marca">você</Badge>}</p>
              <p className="flex gap-2 flex-wrap">
                <Badge>{ROLE_LABEL[u.role]}</Badge>
                {u.status === "ATIVO" ? <Badge tone="ok">ativo</Badge> : <Badge tone="erro">{u.status.toLowerCase()}</Badge>}
                {u.totpEnabled ? <Badge tone="ok">2FA ativo</Badge> : <Badge tone="alerta">2FA pendente</Badge>}
                {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="erro">bloqueio temporário</Badge>}
              </p>
            </div>
            <p className="text-sm text-suave">{u.email} · último acesso {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "nunca"}{u.sessions[0]?.ip ? ` · IP ${u.sessions[0].ip}` : ""}</p>
            {u.id !== me.id ? (
              <div className="mt-3 flex flex-wrap gap-2 items-end">
                <form action={updateStaff} className="flex gap-2 items-end">
                  <input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="role" />
                  <div><label className="text-sm" htmlFor={`r-${u.id}`}>Perfil</label>
                    <select id={`r-${u.id}`} name="role" defaultValue={u.role} className="campo min-h-10">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
                  <button className="btn btn-secundario btn-pequeno">Alterar perfil</button>
                </form>
                <form action={updateStaff}><input type="hidden" name="id" value={u.id} />
                  <ConfirmButton className="btn btn-secundario btn-pequeno" name="op" value={u.status === "ATIVO" ? "block" : "unblock"} message={u.status === "ATIVO" ? "Bloquear este acesso agora?" : "Reativar este acesso?"}>{u.status === "ATIVO" ? "Bloquear acesso" : "Reativar"}</ConfirmButton>
                </form>
                <form action={updateStaff}><input type="hidden" name="id" value={u.id} />
                  <ConfirmButton className="btn btn-secundario btn-pequeno" name="op" value="reset2fa" message="Só redefina o 2FA depois de confirmar a identidade da pessoa pessoalmente ou por telefone. Continuar?">Redefinir 2FA</ConfirmButton>
                </form>
                <form action={updateStaff}><input type="hidden" name="id" value={u.id} />
                  <button name="op" value="sessions" className="btn btn-secundario btn-pequeno">Encerrar sessões</button>
                </form>
                <form action={updateStaff} className="flex gap-2 items-end">
                  <input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="password" />
                  <div><label className="text-sm" htmlFor={`p-${u.id}`}>Nova senha (mín. 12)</label><input id={`p-${u.id}`} name="password" type="password" autoComplete="new-password" className="campo min-h-10" /></div>
                  <button className="btn btn-secundario btn-pequeno">Redefinir senha</button>
                </form>
              </div>
            ) : (
              <form action={updateStaff} className="mt-3"><input type="hidden" name="id" value={u.id} />
                <button name="op" value="sessions" className="btn btn-secundario btn-pequeno">Encerrar todas as minhas sessões</button>
              </form>
            )}
          </section>
        ))}
      </div>

      <form action={createStaff} className="cartao p-5 mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-gelo">
        <p className="sm:col-span-2 lg:col-span-5 text-2xl font-serif text-marca-escuro">Novo usuário</p>
        <div><label htmlFor="nu-nome" className="rotulo">Nome</label><input id="nu-nome" name="name" required className="campo" /></div>
        <div><label htmlFor="nu-email" className="rotulo">E-mail</label><input id="nu-email" name="email" type="email" required className="campo" /></div>
        <div><label htmlFor="nu-perfil" className="rotulo">Perfil</label>
          <select id="nu-perfil" name="role" className="campo" defaultValue="ATENDENTE">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        <div><label htmlFor="nu-senha" className="rotulo">Senha inicial (mín. 12)</label><input id="nu-senha" name="password" type="password" required minLength={12} autoComplete="new-password" className="campo" /></div>
        <button className="btn btn-primario">Criar usuário</button>
      </form>
    </>
  );
}
