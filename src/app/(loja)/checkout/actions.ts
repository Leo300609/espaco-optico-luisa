"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { evaluateCoupon, findShippingZone, getCart, priceCart, shippingFor, clearCartCookie } from "@/lib/cart";
import { getClientIp, getCustomer } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { encryptJSON, encryptString, randomToken, shortCode } from "@/lib/crypto";
import { isValidCpf, isValidPhone, onlyDigits } from "@/lib/format";
import { eyeFromForm, hasAnyValue, rxDataSchema } from "@/lib/optics";
import { savePrivateFile, deletePrivateFile } from "@/lib/storage";
import { createCardCheckout, createPixCharge } from "@/lib/payments";
import { env } from "@/lib/env";
import { POLICY_VERSION } from "@/lib/site";
import { sendEmail, notifyStore } from "@/lib/email";
import { formatBRL } from "@/lib/money";

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string>; warnings?: string[] } | null;

const base = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  phone: z.string().refine(isValidPhone, "Telefone com DDD, ex.: (11) 95050-5009"),
  cpf: z.string().refine(isValidCpf, "CPF inválido"),
  fulfillment: z.enum(["ENTREGA", "RETIRADA"], { message: "Escolha entrega ou retirada" }),
  payment: z.enum(["PIX", "CARTAO"], { message: "Escolha a forma de pagamento" }),
  notes: z.string().max(500).optional(),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade" }) }),
});

const addressSchema = z.object({
  cep: z.string().transform(onlyDigits).refine((s) => s.length === 8, "CEP com 8 números"),
  street: z.string().trim().min(2, "Informe a rua").max(160),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2, "Informe o bairro").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF com 2 letras").toUpperCase(),
  reference: z.string().trim().max(120).optional(),
});

function fieldErrors(issues: z.ZodIssue[], prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = prefix + i.path.join("_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const ip = await getClientIp();
  if (!(await rateLimit(`checkout:${ip}`, 12, 900))) return { error: "Muitas tentativas de compra. Aguarde alguns minutos." };

  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { error: "Seu carrinho está vazio." };
  const lines = await priceCart(cart);
  if (lines.some((l) => l.quantity > l.available)) return { error: "Algum item ficou sem estoque. Volte ao carrinho para ajustar." };

  const get = (k: string) => (form.get(k) as string | null) ?? undefined;
  const parsed = base.safeParse({
    name: get("name"), email: get("email"), phone: get("phone"), cpf: get("cpf"),
    fulfillment: get("fulfillment"), payment: get("payment"), notes: get("notes") || undefined, acceptTerms: get("acceptTerms"),
  });
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error.issues);

  let address: z.infer<typeof addressSchema> | null = null;
  if (get("fulfillment") === "ENTREGA") {
    const a = addressSchema.safeParse({
      cep: get("cep") ?? "", street: get("street"), number: get("number"), complement: get("complement") || undefined,
      district: get("district"), city: get("city"), state: get("state") ?? "", reference: get("reference") || undefined,
    });
    if (a.success) address = a.data;
    else Object.assign(errors, fieldErrors(a.error.issues));
  }

  // ---- Receita ----
  const needsRx = lines.some((l) => l.needsRx);
  const rxMode = needsRx ? get("rxMode") : undefined; // "digitar" | "foto" | "depois"
  const files = form.getAll("rxFiles").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 2);
  let rxData: z.infer<typeof rxDataSchema> | null = null;
  if (needsRx) {
    if (!rxMode || !["digitar", "foto", "depois"].includes(rxMode)) errors.rxMode = "Escolha como vai informar a receita";
    if (rxMode === "digitar") {
      const r = rxDataSchema.safeParse({
        od: eyeFromForm(form, "od"),
        oe: eyeFromForm(form, "oe"),
        totalDp: get("totalDp") ? Number(String(get("totalDp")).replace(",", ".")) : null,
        heightAtStore: get("heightAtStore") === "on",
      });
      if (!r.success) Object.assign(errors, fieldErrors(r.error.issues, "rx_"));
      else if (!hasAnyValue(r.data.od) && !hasAnyValue(r.data.oe)) errors.rx_od_sphere = "Preencha os valores da receita ou escolha outra opção";
      else rxData = r.data;
      const needsAdd = lines.some((l) => l.lens && ["MULTIFOCAL", "BIFOCAL", "OCUPACIONAL"].includes(l.lens.option.kind));
      if (rxData && needsAdd && (rxData.od.addition == null || rxData.oe.addition == null)) {
        errors.rx_od_addition = "Lentes multifocais, bifocais e ocupacionais exigem a adição dos dois olhos";
      }
    }
    if (rxMode === "foto" && files.length === 0) errors.rxFiles = "Anexe a foto ou o PDF da receita";
    if (rxMode !== "depois" && get("consentHealth") !== "on") {
      errors.consentHealth = "Para enviarmos a receita, precisamos do seu consentimento para o tratamento deste dado de saúde";
    }
  }

  // ---- Frete ----
  let zone: Awaited<ReturnType<typeof findShippingZone>> = null;
  if (address) {
    zone = await findShippingZone(address.cep);
    if (!zone) errors.cep = "Ainda não entregamos neste CEP. Escolha retirar na loja ou fale com a gente.";
  }

  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: errors };
  }
  const data = parsed.data;
  const customer = await getCustomer();

  // ---- Valores (sempre recalculados no servidor) ----
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  let discount = 0;
  let freeShipping = false;
  let couponId: string | null = null;
  if (cart.couponCode) {
    const c = await evaluateCoupon(cart.couponCode, lines, data.email);
    if (!c.ok) return { error: `Cupom: ${c.message} Remova-o no carrinho para continuar.` };
    discount = c.discountCents;
    freeShipping = c.freeShipping;
    couponId = c.coupon.id;
  }
  const shipping = data.fulfillment === "ENTREGA" && zone && !freeShipping ? shippingFor(zone, subtotal - discount) : 0;
  const total = subtotal - discount + shipping;
  if (total < 100) return { error: "Valor do pedido inválido." };

  // ---- Arquivos da receita (antes da transação) ----
  const savedKeys: string[] = [];
  try {
    for (const f of files) savedKeys.push((await savePrivateFile(f)).key);
  } catch (e) {
    for (const k of savedKeys) await deletePrivateFile(k);
    return { error: e instanceof Error ? e.message : "Não foi possível enviar o arquivo.", fieldErrors: { rxFiles: "Arquivo inválido" } };
  }

  const method = data.payment as PaymentMethod;
  const expiresAt = new Date(Date.now() + (method === "PIX" ? env().PIX_EXPIRATION_MINUTES * 60_000 : 24 * 3600_000));

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      // Reserva atômica: só reserva se ainda houver estoque livre
      for (const l of lines) {
        const reserved = await tx.$executeRaw`
          UPDATE "Variant" SET "reserved" = "reserved" + ${l.quantity}
          WHERE "id" = ${l.variantId} AND "active" = true AND "stock" - "reserved" >= ${l.quantity}`;
        if (reserved !== 1) throw new Error(`ESTOQUE:${l.productName}`);
      }

      const consentHealth =
        needsRx && rxMode !== "depois"
          ? await tx.consent.create({
              data: { userId: customer?.id, email: data.email, type: "DADO_SAUDE", textVersion: POLICY_VERSION, ip },
            })
          : null;
      await tx.consent.createMany({
        data: [
          { userId: customer?.id, email: data.email, type: "TERMOS", textVersion: POLICY_VERSION, ip },
          { userId: customer?.id, email: data.email, type: "PRIVACIDADE", textVersion: POLICY_VERSION, ip },
          ...(get("marketing") === "on"
            ? [{ userId: customer?.id, email: data.email, type: "COMUNICACOES" as const, textVersion: POLICY_VERSION, ip }]
            : []),
        ],
      });

      const prescription = needsRx
        ? await tx.prescription.create({
            data: {
              userId: customer?.id,
              dataEnc: rxData ? encryptJSON(rxData) : null,
              fileKeys: savedKeys,
              sendLater: rxMode === "depois",
              doctorName: get("doctorName")?.slice(0, 120) || null,
              doctorReg: get("doctorReg")?.slice(0, 40) || null,
              issuedAt: get("issuedAt") ? new Date(String(get("issuedAt"))) : null,
              customerNotes: get("rxNotes")?.slice(0, 500) || null,
              consentId: consentHealth?.id,
              deleteAfter: new Date(Date.now() + 365 * 86400000),
            },
          })
        : null;

      const order = await tx.order.create({
        data: {
          publicToken: randomToken(24),
          userId: customer?.id,
          customerName: data.name,
          customerEmail: data.email,
          customerPhone: onlyDigits(data.phone),
          customerCpfEnc: encryptString(onlyDigits(data.cpf)),
          fulfillment: data.fulfillment,
          address: address ?? undefined,
          shippingZoneId: zone?.id,
          subtotalCents: subtotal,
          discountCents: discount,
          shippingCents: shipping,
          totalCents: total,
          couponId,
          paymentMethod: method,
          pickupCode: data.fulfillment === "RETIRADA" ? shortCode() : null,
          prescriptionId: prescription?.id,
          customerNotes: data.notes,
          expiresAt,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.productName,
              variantName: l.variantName,
              unitCents: l.unitCents,
              quantity: l.quantity,
              needsRx: l.needsRx,
              lensConfig: l.lens
                ? {
                    lens: { id: l.lens.option.id, name: l.lens.option.name, kind: l.lens.option.kind, index: l.lens.option.refractiveIdx, cents: l.lens.option.priceCents },
                    treatments: l.lens.treatments.map((t) => ({ id: t.id, name: t.name, cents: t.priceCents })),
                    frameCents: l.baseCents,
                    productionDays: l.lens.productionDays,
                  }
                : undefined,
            })),
          },
          history: { create: { status: "AGUARDANDO_PAGAMENTO", note: "Pedido criado" } },
        },
      });
      for (const l of lines) {
        await tx.stockMovement.create({ data: { variantId: l.variantId, type: "RESERVA", quantity: l.quantity, orderId: order.id } });
      }
      if (customer && get("saveAddress") === "on" && address) {
        await tx.address.create({ data: { userId: customer.id, ...address, isDefault: true } });
      }
      return order.id;
    });
  } catch (e) {
    for (const k of savedKeys) await deletePrivateFile(k);
    if (e instanceof Error && e.message.startsWith("ESTOQUE:")) {
      return { error: `O item "${e.message.slice(8)}" acabou de esgotar. Volte ao carrinho para ajustar.` };
    }
    console.error("Erro ao criar pedido", e instanceof Error ? e.message : e);
    return { error: "Não foi possível concluir o pedido. Tente novamente." };
  }

  // ---- Cobrança no gateway ----
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  let target: string;
  try {
    if (method === "PIX") {
      const pix = await createPixCharge(order, onlyDigits(data.cpf));
      await db.payment.create({
        data: { orderId, provider: env().PAYMENT_PROVIDER, method, externalId: pix.externalId, amountCents: total, pixCode: pix.code, pixQrBase64: pix.qrBase64, expiresAt: pix.expiresAt },
      });
      target = `/pedido/${order.publicToken}`;
    } else {
      const card = await createCardCheckout(order, order.items);
      await db.payment.create({
        data: { orderId, provider: env().PAYMENT_PROVIDER, method, externalId: card.externalId, amountCents: total, checkoutUrl: card.url, expiresAt },
      });
      target = card.url;
    }
  } catch (e) {
    // Sem cobrança, o pedido não pode seguir: cancela e libera o estoque reservado.
    await db.order.update({ where: { id: orderId }, data: { expiresAt: new Date(0) } });
    const { expireStaleOrders } = await import("@/lib/orders");
    await expireStaleOrders();
    return { error: e instanceof Error ? e.message : "Falha ao iniciar o pagamento." };
  }

  await db.cart.delete({ where: { id: cart.id } }).catch(() => {});
  await clearCartCookie();
  await sendEmail(data.email, `Recebemos seu pedido #${order.number}`, "Pedido recebido!", [
    `Olá, ${data.name.split(" ")[0]}! Recebemos o pedido #${order.number}, no valor de ${formatBRL(total)}.`,
    method === "PIX"
      ? `Pague o Pix em até ${env().PIX_EXPIRATION_MINUTES} minutos para garantir os itens.`
      : "Assim que o pagamento for aprovado, avisaremos por e-mail.",
  ], { label: "Acompanhar pedido", href: `${env().APP_URL}/pedido/${order.publicToken}` });
  await notifyStore(`Novo pedido #${order.number} (aguardando pagamento)`, [`Total: ${formatBRL(total)}`]);

  redirect(target);
}
