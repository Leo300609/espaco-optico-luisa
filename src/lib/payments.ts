import "server-only";
import { createHmac } from "node:crypto";
import QRCode from "qrcode";
import type { Order, OrderItem } from "@prisma/client";
import { env } from "./env";
import { randomToken, safeEqual } from "./crypto";

/**
 * Integração de pagamentos (capítulo 6).
 * - Pix: cobrança dinâmica via API de pagamentos do Mercado Pago (QR Code + copia e cola).
 * - Cartão: Checkout Pro (o cliente digita o cartão no ambiente do Mercado Pago; nosso servidor nunca vê o cartão).
 * - "mock": provedor simulado para desenvolvimento, bloqueado em produção.
 */

export type PixCharge = { externalId: string; code: string; qrBase64: string; expiresAt: Date };
export type CardCheckout = { externalId: string; url: string };
export type RemotePayment = {
  status: "PENDENTE" | "APROVADO" | "RECUSADO" | "EXPIRADO" | "ESTORNADO";
  orderId: string | null;
  amountCents: number;
  installments?: number;
  cardBrand?: string;
  cardLast4?: string;
};

const MP = "https://api.mercadopago.com";

function mpHeaders(idempotencyKey?: string) {
  const token = env().MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
  };
}

function mapMpStatus(s: string): RemotePayment["status"] {
  switch (s) {
    case "approved":
      return "APROVADO";
    case "rejected":
      return "RECUSADO";
    case "cancelled":
    case "expired":
      return "EXPIRADO";
    case "refunded":
    case "charged_back":
      return "ESTORNADO";
    default:
      return "PENDENTE";
  }
}

const notificationUrl = () => `${env().APP_URL}/api/webhooks/mercadopago`;

export async function createPixCharge(order: Order, cpf: string | null): Promise<PixCharge> {
  const expiresAt = new Date(Date.now() + env().PIX_EXPIRATION_MINUTES * 60_000);
  if (env().PAYMENT_PROVIDER === "mock") {
    const code = `00020126580014BR.GOV.BCB.PIX0136TESTE-${order.id}5204000053039865406${(order.totalCents / 100).toFixed(2)}5802BR5925ESPACO OPTICO LUISA TESTE6006SUZANO62070503***6304ABCD`;
    const qr = await QRCode.toDataURL(code, { margin: 1, width: 280 });
    return { externalId: `mock_${randomToken(8)}`, code, qrBase64: qr.split(",")[1]!, expiresAt };
  }
  const [first, ...rest] = order.customerName.trim().split(/\s+/);
  const res = await fetch(`${MP}/v1/payments`, {
    method: "POST",
    headers: mpHeaders(`pix-${order.id}-${order.updatedAt.getTime()}`),
    body: JSON.stringify({
      transaction_amount: order.totalCents / 100,
      description: `Pedido #${order.number} - Espaço Óptico Luísa`,
      payment_method_id: "pix",
      external_reference: order.id,
      notification_url: notificationUrl(),
      date_of_expiration: expiresAt.toISOString().replace("Z", "-00:00"),
      payer: {
        email: order.customerEmail,
        first_name: first,
        last_name: rest.join(" ") || first,
        ...(cpf ? { identification: { type: "CPF", number: cpf } } : {}),
      },
    }),
  });
  if (!res.ok) {
    console.error("Mercado Pago Pix falhou", res.status, await res.text().catch(() => ""));
    throw new Error("Não foi possível gerar o Pix agora. Tente novamente em instantes.");
  }
  const data = (await res.json()) as {
    id: number;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  };
  const td = data.point_of_interaction?.transaction_data;
  if (!td?.qr_code || !td.qr_code_base64) throw new Error("Resposta do Pix incompleta.");
  return { externalId: String(data.id), code: td.qr_code, qrBase64: td.qr_code_base64, expiresAt };
}

export async function createCardCheckout(order: Order, items: OrderItem[]): Promise<CardCheckout> {
  const back = `${env().APP_URL}/pedido/${order.publicToken}`;
  if (env().PAYMENT_PROVIDER === "mock") {
    return { externalId: `mockcard_${randomToken(8)}`, url: `${back}?simular=cartao` };
  }
  const res = await fetch(`${MP}/checkout/preferences`, {
    method: "POST",
    headers: mpHeaders(`pref-${order.id}`),
    body: JSON.stringify({
      external_reference: order.id,
      notification_url: notificationUrl(),
      items: [
        {
          id: order.id,
          title: `Pedido #${order.number} - Espaço Óptico Luísa (${items.length} ${items.length === 1 ? "item" : "itens"})`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: order.totalCents / 100,
        },
      ],
      payer: { email: order.customerEmail, name: order.customerName },
      payment_methods: {
        installments: env().MAX_INSTALLMENTS,
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
      },
      back_urls: { success: back, pending: back, failure: `${back}?falha=1` },
      auto_return: "approved",
      statement_descriptor: "OPTICO LUISA",
      expires: true,
      expiration_date_to: new Date(Date.now() + 24 * 3600_000).toISOString().replace("Z", "-00:00"),
    }),
  });
  if (!res.ok) {
    console.error("Mercado Pago preferência falhou", res.status, await res.text().catch(() => ""));
    throw new Error("Não foi possível iniciar o pagamento com cartão agora.");
  }
  const data = (await res.json()) as { id: string; init_point: string };
  return { externalId: data.id, url: data.init_point };
}

/** Consulta o pagamento diretamente no gateway: a fonte da verdade, nunca o aviso recebido. */
export async function fetchRemotePayment(paymentId: string): Promise<RemotePayment | null> {
  const res = await fetch(`${MP}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: mpHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const p = (await res.json()) as {
    status: string;
    external_reference: string | null;
    transaction_amount: number;
    installments?: number;
    payment_method_id?: string;
    card?: { last_four_digits?: string };
  };
  return {
    status: mapMpStatus(p.status),
    orderId: p.external_reference,
    amountCents: Math.round(p.transaction_amount * 100),
    installments: p.installments,
    cardBrand: p.payment_method_id !== "pix" ? p.payment_method_id : undefined,
    cardLast4: p.card?.last_four_digits,
  };
}

/**
 * Valida a assinatura do aviso (x-signature) do Mercado Pago.
 * Manifesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 */
export function verifyMpSignature(signature: string | null, requestId: string | null, dataId: string): boolean {
  const secret = env().MP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((kv) => {
      const [k, v] = kv.split("=").map((s) => s.trim());
      return [k, v];
    }),
  ) as Record<string, string | undefined>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // Rejeita avisos com mais de 10 minutos (proteção contra reenvio)
  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60_000) return false;
  let manifest = `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, v1);
}
