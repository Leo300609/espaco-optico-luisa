import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomer } from "@/lib/session";
import { decryptJSON, decryptString } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

/** Portabilidade/acesso (LGPD art. 18): exporta os dados do próprio titular em JSON. */
export async function GET() {
  const user = await getCustomer();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await rateLimit(`exportar:${user.id}`, 5, 3600))) return NextResponse.json({ error: "tente mais tarde" }, { status: 429 });

  const [addresses, orders, prescriptions, consents] = await Promise.all([
    db.address.findMany({ where: { userId: user.id } }),
    db.order.findMany({ where: { userId: user.id }, include: { items: true } }),
    db.prescription.findMany({ where: { userId: user.id } }),
    db.consent.findMany({ where: { userId: user.id } }),
  ]);

  const data = {
    geradoEm: new Date().toISOString(),
    titular: {
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      cpf: user.cpfEnc ? decryptString(user.cpfEnc) : null,
      cadastradoEm: user.createdAt,
      aceitaComunicacoes: user.marketingOptIn,
    },
    enderecos: addresses.map(({ userId: _u, ...a }) => a),
    pedidos: orders.map((o) => ({
      numero: o.number,
      data: o.createdAt,
      status: o.status,
      totalCentavos: o.totalCents,
      recebimento: o.fulfillment,
      endereco: o.address,
      itens: o.items.map((i) => ({ nome: i.name, opcao: i.variantName, quantidade: i.quantity, unitarioCentavos: i.unitCents, lentes: i.lensConfig })),
    })),
    receitas: prescriptions.map((p) => ({
      enviadaEm: p.createdAt,
      status: p.status,
      valores: p.dataEnc ? decryptJSON(p.dataEnc) : null,
      arquivos: p.fileKeys.length,
      eliminacaoPrevistaEm: p.deleteAfter,
    })),
    consentimentos: consents.map((c) => ({ tipo: c.type, versao: c.textVersion, concedido: c.granted, em: c.createdAt, revogadoEm: c.revokedAt })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-espaco-optico-luisa.json"`,
      "Cache-Control": "no-store",
    },
  });
}
