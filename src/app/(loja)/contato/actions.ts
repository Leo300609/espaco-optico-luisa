"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/session";
import { notifyStore } from "@/lib/email";
import { env } from "@/lib/env";

export type ContactState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(160),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(2, "Informe o assunto").max(120),
  message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres").max(3000),
  consent: z.literal("on", { errorMap: () => ({ message: "Autorize o uso dos dados para respondermos" }) }),
});

async function verifyTurnstile(token: string | null, ip: string) {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true; // proteção opcional; limite de envios continua ativo
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as { success?: boolean } | null;
  return data?.success === true;
}

export async function sendContact(_: ContactState, form: FormData): Promise<ContactState> {
  const ip = await getClientIp();
  if (String(form.get("website") ?? "") !== "") return { ok: true }; // armadilha para robôs
  if (!(await rateLimit(`contato:${ip}`, 5, 3600))) return { error: "Você enviou muitas mensagens. Tente mais tarde ou chame no WhatsApp." };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) return { error: "Não foi possível verificar o envio. Tente novamente." };

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Revise os campos destacados.", fieldErrors: fe };
  }
  const d = parsed.data;
  await db.contactMessage.create({ data: { name: d.name, email: d.email.toLowerCase(), phone: d.phone || null, subject: d.subject, message: d.message, consent: true } });
  await notifyStore(`Nova mensagem do site: ${d.subject}`, [`De: ${d.name}`, "Veja a mensagem completa no painel."]);
  return { ok: true };
}
