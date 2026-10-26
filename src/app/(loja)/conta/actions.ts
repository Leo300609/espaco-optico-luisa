"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroyAllSessions, destroySession, getClientIp, getCustomer } from "@/lib/session";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { isValidPhone } from "@/lib/format";
import { POLICY_VERSION } from "@/lib/site";
import { notifyStore } from "@/lib/email";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string } | null;

const safeNext = (n: FormDataEntryValue | null) => {
  const s = String(n ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/admin") ? s : "/conta";
};

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!(await rateLimit(`login:${ip}`, 20, 900)) || !(await rateLimit(`login-email:${email}`, 8, 900))) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || user.role !== "CLIENTE" || user.status !== "ATIVO" || !valid) {
    return { error: "E-mail ou senha incorretos." };
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, { admin: false, mfaVerified: false });
  redirect(safeNext(form.get("voltar")));
}

const signUpSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  phone: z.string().refine((s) => !s || isValidPhone(s), "Telefone com DDD").optional(),
  password: z.string(),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade" }) }),
});

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (!(await rateLimit(`cadastro:${ip}`, 5, 3600))) return { error: "Muitos cadastros a partir desta conexão. Tente mais tarde." };
  const parsed = signUpSchema.safeParse({
    name: form.get("name"), email: form.get("email"), phone: form.get("phone") || undefined, password: form.get("password"), acceptTerms: form.get("acceptTerms"),
  });
  const fe: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
  const pw = String(form.get("password") ?? "");
  const pwErr = passwordProblem(pw, false);
  if (pwErr) fe.password = pwErr;
  if (pw !== String(form.get("password2") ?? "")) fe.password2 = "As senhas não conferem";
  if (Object.keys(fe).length || !parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fe };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha pela loja." };

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      passwordHash: await hashPassword(pw),
      marketingOptIn: form.get("marketing") === "on",
      marketingOptInAt: form.get("marketing") === "on" ? new Date() : null,
      consents: {
        create: [
          { type: "TERMOS", textVersion: POLICY_VERSION, ip, email: parsed.data.email },
          { type: "PRIVACIDADE", textVersion: POLICY_VERSION, ip, email: parsed.data.email },
          ...(form.get("marketing") === "on" ? [{ type: "COMUNICACOES" as const, textVersion: POLICY_VERSION, ip, email: parsed.data.email }] : []),
        ],
      },
    },
  });
  // Pedidos feitos como visitante NÃO são vinculados por e-mail: o cadastro não comprova a posse do e-mail,
  // e isso exporia pedidos de terceiros. O visitante acompanha pelo link seguro recebido por e-mail.
  await createSession(user.id, { admin: false, mfaVerified: false });
  redirect(safeNext(form.get("voltar")));
}

export async function signOut() {
  await destroySession(false);
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCustomer();
  if (!user) redirect("/conta/entrar");
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (name.length < 3) return { error: "Informe seu nome completo." };
  if (phone && !isValidPhone(phone)) return { error: "Telefone com DDD." };
  const marketing = form.get("marketing") === "on";
  await db.user.update({
    where: { id: user.id },
    data: { name, phone: phone || null, marketingOptIn: marketing, marketingOptInAt: marketing && !user.marketingOptIn ? new Date() : user.marketingOptInAt },
  });
  if (user.marketingOptIn && !marketing) {
    await db.consent.updateMany({ where: { userId: user.id, type: "COMUNICACOES", revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return { ok: true, message: "Dados atualizados." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCustomer();
  if (!user) redirect("/conta/entrar");
  if (!(await rateLimit(`senha:${user.id}`, 5, 900))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  if (!(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) return { error: "Senha atual incorreta." };
  const pw = String(form.get("password") ?? "");
  const problem = passwordProblem(pw, false);
  if (problem) return { error: problem };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw) } });
  await destroyAllSessions(user.id);
  await createSession(user.id, { admin: false, mfaVerified: false });
  return { ok: true, message: "Senha alterada. Outras sessões foram encerradas." };
}

/** Pedido de exclusão/anonimização (direito do titular). A equipe atende pelo painel em até 15 dias. */
export async function requestDeletion(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCustomer();
  if (!user) redirect("/conta/entrar");
  if (form.get("confirm") !== "on") return { error: "Confirme que deseja solicitar a exclusão." };
  const open = await db.dataRequest.findFirst({ where: { userId: user.id, type: "EXCLUSAO", status: "ABERTA" } });
  if (!open) {
    await db.dataRequest.create({ data: { userId: user.id, type: "EXCLUSAO", details: String(form.get("details") ?? "").slice(0, 500) || null } });
    await notifyStore("Pedido de exclusão de dados (LGPD)", ["Um cliente pediu a exclusão dos dados. Prazo de resposta: 15 dias."]);
  }
  return { ok: true, message: "Pedido registrado. Responderemos em até 15 dias por e-mail." };
}
