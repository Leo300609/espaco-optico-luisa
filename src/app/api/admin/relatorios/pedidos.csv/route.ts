import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { audit } from "@/lib/audit";
import { ORDER_STATUS_LABEL } from "@/lib/format";

/** Exportação para planilha. Neutraliza fórmulas (proteção contra "CSV injection"). */
function cell(v: string | number | null | undefined) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  let user;
  try {
    user = await assertStaff("relatorios.ver");
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  const url = new URL(request.url);
  const de = url.searchParams.get("de") ?? "";
  const ate = url.searchParams.get("ate") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return NextResponse.json({ error: "datas inválidas" }, { status: 400 });
  const orders = await db.order.findMany({
    where: { createdAt: { gte: new Date(`${de}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59-03:00`) } },
    include: { items: true, coupon: true },
    orderBy: { number: "asc" },
  });
  const header = ["Pedido", "Data", "Status", "Cliente", "Recebimento", "Pagamento", "Itens", "Subtotal", "Desconto", "Frete", "Total", "Cupom"];
  const rows = orders.map((o) => [
    o.number,
    o.createdAt.toISOString(),
    ORDER_STATUS_LABEL[o.status],
    o.customerName,
    o.fulfillment === "RETIRADA" ? "Retirada" : "Entrega",
    o.paymentMethod === "PIX" ? "Pix" : "Cartão",
    o.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
    (o.subtotalCents / 100).toFixed(2).replace(".", ","),
    (o.discountCents / 100).toFixed(2).replace(".", ","),
    (o.shippingCents / 100).toFixed(2).replace(".", ","),
    (o.totalCents / 100).toFixed(2).replace(".", ","),
    o.coupon?.code ?? "",
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  await audit(user.id, "relatorio_exportado", "pedido", null, `${de} a ${ate}`);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${de}-a-${ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
