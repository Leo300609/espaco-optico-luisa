import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { getAdminSession, getCustomer } from "./session";
import { can, type Permission } from "./permissions";

/** Exige usuário da equipe, com 2FA verificado e a permissão pedida. */
export async function requireStaff(permission: Permission): Promise<User> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.user.totpEnabled) redirect("/admin/2fa/configurar");
  if (!session.mfaVerified) redirect("/admin/2fa");
  if (!can(session.user.role, permission)) redirect("/admin?erro=sem-permissao");
  return session.user;
}

/** Variante para Server Actions e rotas de API: lança erro em vez de redirecionar. */
export async function assertStaff(permission: Permission): Promise<User> {
  const session = await getAdminSession();
  if (!session || !session.user.totpEnabled || !session.mfaVerified) throw new Error("Não autenticado.");
  if (!can(session.user.role, permission)) throw new Error("Sem permissão para esta ação.");
  return session.user;
}

export async function requireCustomer(next = "/conta"): Promise<User> {
  const user = await getCustomer();
  if (!user) redirect(`/conta/entrar?voltar=${encodeURIComponent(next)}`);
  return user;
}
