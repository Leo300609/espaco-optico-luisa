"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createSession, destroySession, getAdminSession, getClientIp, isStaff, markMfaVerified } from "@/lib/session";
import { dummyHash, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { newRecoveryCodes, newTotpSecret, totpUri, verifyTotp, verifyTotpPlain } from "@/lib/totp";
import { decryptString, encryptString, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";

export type AdminAuthState = { error?: string } | null;

const LOCK_AFTER = 5;

async function adminSignInImpl(_: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  const ip = await getClientIp();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!(await rateLimit(`admin-login:${ip}`, 15, 900))) return { error: "Muitas tentativas. Aguarde 15 minutos." };

  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Conta bloqueada temporariamente por tentativas erradas. Tente mais tarde." };
  }
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !isStaff(user.role) || user.status !== "ATIVO" || !valid) {
    if (user && isStaff(user.role)) {
      const fails = user.failedLogins + 1;
      const minutes = fails >= LOCK_AFTER ? Math.min(60, 2 ** (fails - LOCK_AFTER) * 5) : 0;
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: fails, lockedUntil: minutes ? new Date(Date.now() + minutes * 60_000) : null },
      });
      await audit(user.id, "login_falhou", "usuario", user.id, `Tentativa ${fails}`);
    }
    return { error: "E-mail ou senha incorretos." };
  }

  const newDevice = !(await db.session.findFirst({ where: { userId: user.id, ip } }));
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id, { admin: true, mfaVerified: false });
  await audit(user.id, "login_senha_ok", "usuario", user.id);
  if (newDevice) {
    await sendEmail(user.email, "Novo acesso ao painel", "Novo acesso ao painel da loja", [
      "Detectamos um login no painel a partir de um local ou aparelho novo.",
      "Se não foi você, troque a senha e avise o proprietário imediatamente.",
    ]);
  }
  redirect(user.totpEnabled ? "/admin/2fa" : "/admin/2fa/configurar");
}

async function verifySecondFactorImpl(_: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const user = session.user;
  if (!(await rateLimit(`2fa:${user.id}`, 6, 600))) return { error: "Muitas tentativas. Aguarde 10 minutos." };
  const code = String(form.get("code") ?? "").trim().toUpperCase();

  let ok = false;
  if (/^\d{6}$/.test(code.replace(/\s/g, "")) && user.totpSecretEnc) ok = verifyTotp(code, user.totpSecretEnc);
  else if (/^[0-9A-F]{5}-[0-9A-F]{5}$/.test(code)) {
    const h = sha256(code);
    if (user.recoveryCodes.includes(h)) {
      ok = true;
      await db.user.update({ where: { id: user.id }, data: { recoveryCodes: user.recoveryCodes.filter((x) => x !== h) } });
      await audit(user.id, "codigo_recuperacao_usado", "usuario", user.id);
    }
  }
  if (!ok) {
    await audit(user.id, "2fa_falhou", "usuario", user.id);
    return { error: "Código inválido. Confira o horário do celular e tente novamente." };
  }
  await markMfaVerified(session.id);
  await audit(user.id, "login_completo", "usuario", user.id);
  redirect("/admin");
}

export type SetupData = { qr: string; secretMasked: string; secretEnc: string };

/** Gera um segredo novo para o usuário logado (ainda sem ativar). */
export async function startTotpSetup(): Promise<SetupData> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.user.totpEnabled) redirect("/admin/2fa");
  const { secret, secretEnc } = newTotpSecret();
  const qr = await QRCode.toDataURL(totpUri(session.user.email, secret), { margin: 1, width: 240 });
  return { qr, secretMasked: secret.replace(/(.{4})/g, "$1 ").trim(), secretEnc };
}

export type ConfirmState = { error?: string; codes?: string[] } | null;

export async function confirmTotpSetup(_: ConfirmState, form: FormData): Promise<ConfirmState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.user.totpEnabled) redirect("/admin/2fa");
  if (!(await rateLimit(`2fa-setup:${session.user.id}`, 10, 600))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const secretEnc = String(form.get("secretEnc") ?? "");
  let secret: string;
  try {
    secret = decryptString(secretEnc);
  } catch {
    return { error: "Configuração expirada. Recarregue a página." };
  }
  if (!verifyTotpPlain(String(form.get("code") ?? ""), secret)) return { error: "Código inválido. Digite os 6 números que aparecem no aplicativo." };
  const { codes, hashes } = newRecoveryCodes();
  await db.user.update({
    where: { id: session.user.id },
    data: { totpSecretEnc: encryptString(secret), totpEnabled: true, recoveryCodes: hashes },
  });
  await markMfaVerified(session.id);
  await audit(session.user.id, "2fa_ativado", "usuario", session.user.id);
  return { codes };
}

export async function adminSignOut() {
  const s = await getAdminSession();
  if (s) await audit(s.user.id, "logout", "usuario", s.user.id);
  await destroySession(true);
  redirect("/admin/login");
}

/** Envolve o login para registrar falhas inesperadas nos logs (sem dados sensíveis). */
export async function adminSignIn(prev: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  try {
    return await adminSignInImpl(prev, form);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[login-painel] falha inesperada:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return { error: "Não foi possível entrar agora (erro interno). Tente novamente em instantes." };
  }
}

/** Envolve o login para registrar falhas inesperadas nos logs (sem dados sensíveis). */
export async function verifySecondFactor(prev: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  try {
    return await verifySecondFactorImpl(prev, form);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[2fa-painel] falha inesperada:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return { error: "Não foi possível entrar agora (erro interno). Tente novamente em instantes." };
  }
}
