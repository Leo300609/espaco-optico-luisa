import "server-only";
import { env } from "./env";
import { STORE } from "./site";

/**
 * E-mails transacionais via Resend (API HTTP). Sem chave configurada, o e-mail é
 * apenas registrado no console (útil em desenvolvimento). Nunca inclui dados de receita.
 */

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${cta.href}" style="background:#343A55;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1F2433;background:#F6F7FA;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:28px">
<p style="font-size:20px;color:#343A55;margin:0 0 18px"><strong>${escapeHtml(STORE.name)}</strong></p>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}
<hr style="border:none;border-top:1px solid #D9DDE7;margin:24px 0">
<p style="font-size:13px;color:#555">${escapeHtml(STORE.phone)} · WhatsApp ${escapeHtml(STORE.whatsapp)} · Suzano/SP</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, title: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    console.info(`[e-mail simulado] para=${to} assunto="${subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html: layout(title, paragraphs, cta) }),
    });
    if (!res.ok) console.error("Falha ao enviar e-mail", res.status);
  } catch (e) {
    console.error("Falha ao enviar e-mail", e instanceof Error ? e.message : e);
  }
}

export async function notifyStore(subject: string, lines: string[]) {
  const to = env().STORE_NOTIFY_EMAIL;
  if (to) await sendEmail(to, subject, subject, lines, { label: "Abrir painel", href: `${env().APP_URL}/admin` });
}
