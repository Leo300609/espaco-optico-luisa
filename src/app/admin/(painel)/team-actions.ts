"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblem } from "@/lib/password";
import { destroyAllSessions } from "@/lib/session";
import { deletePrivateFile } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";

function go(path: string, key: "ok" | "erro", msg: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);
}

const STAFF = z.enum(["PROPRIETARIO", "GERENTE", "ATENDENTE", "OPTICO"]);

export async function createStaff(f: FormData) {
  const owner = await assertStaff("usuarios.gerir");
  const path = "/admin/usuarios";
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const name = String(f.get("name") ?? "").trim();
  const role = STAFF.safeParse(f.get("role"));
  const pw = String(f.get("password") ?? "");
  if (!z.string().email().safeParse(email).success || name.length < 3 || !role.success) go(path, "erro", "Preencha nome, e-mail e perfil.");
  const problem = passwordProblem(pw, true);
  if (problem) go(path, "erro", problem);
  if (await db.user.findUnique({ where: { email } })) go(path, "erro", "Já existe um usuário com este e-mail.");
  const u = await db.user.create({ data: { name, email, role: role.data!, passwordHash: await hashPassword(pw) } });
  await audit(owner.id, "usuario_criado", "usuario", u.id, `${email} (${role.data})`);
  go(path, "ok", `Usuário criado. Na primeira entrada, ${name.split(" ")[0]} vai configurar o 2FA. Entregue a senha pessoalmente.`);
}

export async function updateStaff(f: FormData) {
  const owner = await assertStaff("usuarios.gerir");
  const path = "/admin/usuarios";
  const id = String(f.get("id"));
  const op = String(f.get("op"));
  if (id === owner.id && op !== "sessions") go(path, "erro", "Você não pode alterar o próprio acesso por aqui.");
  const target = await db.user.findUniqueOrThrow({ where: { id } });

  if (op === "role") {
    const role = STAFF.parse(f.get("role"));
    await db.user.update({ where: { id }, data: { role } });
    await destroyAllSessions(id);
    await audit(owner.id, "usuario_perfil", "usuario", id, `${target.role} → ${role}`);
  } else if (op === "block" || op === "unblock") {
    await db.user.update({ where: { id }, data: { status: op === "block" ? "BLOQUEADO" : "ATIVO", failedLogins: 0, lockedUntil: null } });
    if (op === "block") await destroyAllSessions(id);
    await audit(owner.id, `usuario_${op}`, "usuario", id);
  } else if (op === "reset2fa") {
    // Deve ser feito só após confirmar a identidade por outro canal (presencial ou telefone).
    await db.user.update({ where: { id }, data: { totpEnabled: false, totpSecretEnc: null, recoveryCodes: [] } });
    await destroyAllSessions(id);
    await audit(owner.id, "usuario_reset_2fa", "usuario", id);
  } else if (op === "sessions") {
    await destroyAllSessions(id);
    await audit(owner.id, "usuario_sessoes_encerradas", "usuario", id);
    if (id === owner.id) redirect("/admin/login");
  } else if (op === "password") {
    const pw = String(f.get("password") ?? "");
    const problem = passwordProblem(pw, true);
    if (problem) go(path, "erro", problem);
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } });
    await destroyAllSessions(id);
    await audit(owner.id, "usuario_senha_redefinida", "usuario", id);
  }
  go(path, "ok", "Usuário atualizado.");
}

/** Atende pedido de exclusão: anonimiza o cliente, apaga receitas e endereços. Pedidos ficam (obrigação legal/fiscal) sem dados pessoais diretos. */
export async function anonymizeCustomer(f: FormData) {
  const owner = await assertStaff("clientes.lgpd");
  const requestId = String(f.get("requestId"));
  const req = await db.dataRequest.findUniqueOrThrow({ where: { id: requestId }, include: { user: true } });
  const user = req.user;
  if (user.role !== "CLIENTE") go("/admin/clientes", "erro", "Somente contas de clientes.");

  const rxs = await db.prescription.findMany({ where: { userId: user.id } });
  for (const rx of rxs) for (const k of rx.fileKeys) await deletePrivateFile(k);
  const alias = `anonimo-${randomToken(6)}@removido.invalid`;
  await db.$transaction([
    db.prescription.updateMany({ where: { userId: user.id }, data: { fileKeys: [], dataEnc: null, doctorName: null, doctorReg: null, customerNotes: null } }),
    db.address.deleteMany({ where: { userId: user.id } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.favorite.deleteMany({ where: { userId: user.id } }),
    db.order.updateMany({
      where: { userId: user.id },
      data: { customerName: "Cliente anonimizado", customerEmail: alias, customerPhone: "00000000000", customerCpfEnc: null, address: Prisma.DbNull, customerNotes: null },
    }),
    db.user.update({
      where: { id: user.id },
      data: { name: "Cliente anonimizado", email: alias, phone: null, cpfEnc: null, birthDate: null, status: "ANONIMIZADO", marketingOptIn: false, passwordHash: await hashPassword(randomToken(24)) },
    }),
    db.dataRequest.update({ where: { id: requestId }, data: { status: "ATENDIDA", resolvedAt: new Date() } }),
  ]);
  await audit(owner.id, "lgpd_anonimizacao", "usuario", user.id);
  go("/admin/clientes", "ok", "Dados do cliente anonimizados e receitas eliminadas. Responda o titular por e-mail confirmando.");
}

export async function closeDataRequest(f: FormData) {
  const owner = await assertStaff("clientes.lgpd");
  const id = String(f.get("requestId"));
  await db.dataRequest.update({ where: { id }, data: { status: String(f.get("status")) === "RECUSADA" ? "RECUSADA" : "ATENDIDA", resolvedAt: new Date() } });
  await audit(owner.id, "lgpd_solicitacao_fechada", "solicitacao", id);
  go("/admin/clientes", "ok", "Solicitação encerrada.");
}
