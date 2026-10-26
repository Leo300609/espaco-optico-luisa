import "server-only";
import { cookies, headers } from "next/headers";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";

/**
 * Sessões guardadas no banco. O cookie carrega um token aleatório; o banco guarda apenas o resumo (SHA-256).
 * Clientes: 14 dias. Painel: expira após 30 minutos sem uso e exige 2FA.
 */

export const CUSTOMER_COOKIE = "eol_sid";
export const ADMIN_COOKIE = "eol_asid";
const CUSTOMER_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ADMIN_IDLE_MS = 30 * 60 * 1000;
const ADMIN_MAX_MS = 12 * 60 * 60 * 1000;

const STAFF_ROLES: Role[] = ["PROPRIETARIO", "GERENTE", "ATENDENTE", "OPTICO"];
export const isStaff = (role: Role) => STAFF_ROLES.includes(role);

async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function getClientIp(): Promise<string> {
  return (await clientInfo()).ip ?? "desconhecido";
}

export async function createSession(userId: string, opts: { admin: boolean; mfaVerified: boolean }) {
  const token = randomToken();
  const { ip, userAgent } = await clientInfo();
  const ttl = opts.admin ? ADMIN_IDLE_MS : CUSTOMER_TTL_MS;
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      isAdmin: opts.admin,
      mfaVerified: opts.mfaVerified,
      expiresAt: new Date(Date.now() + ttl),
      ip,
      userAgent,
    },
  });
  const jar = await cookies();
  jar.set(opts.admin ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor((opts.admin ? ADMIN_MAX_MS : CUSTOMER_TTL_MS) / 1000),
  });
}

type SessionWithUser = { id: string; mfaVerified: boolean; isAdmin: boolean; user: User };

async function readSession(cookieName: string, admin: boolean): Promise<SessionWithUser | null> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.isAdmin !== admin) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || (admin && now - session.createdAt.getTime() > ADMIN_MAX_MS)) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== "ATIVO") return null;
  if (admin && !isStaff(session.user.role)) return null;
  // Renovação deslizante (no painel, a cada uso estende mais 30 minutos)
  if (admin || now - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(now + (admin ? ADMIN_IDLE_MS : CUSTOMER_TTL_MS)) },
      })
      .catch(() => {});
  }
  return { id: session.id, mfaVerified: session.mfaVerified, isAdmin: session.isAdmin, user: session.user };
}

export async function getCustomer(): Promise<User | null> {
  const s = await readSession(CUSTOMER_COOKIE, false);
  return s?.user ?? null;
}

/** Sessão do painel; `mfaVerified` precisa ser verdadeiro para qualquer tela além do 2FA. */
export async function getAdminSession(): Promise<SessionWithUser | null> {
  return readSession(ADMIN_COOKIE, true);
}

export async function markMfaVerified(sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { mfaVerified: true } });
}

export async function destroySession(admin: boolean) {
  const jar = await cookies();
  const name = admin ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = jar.get(name)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(name);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
