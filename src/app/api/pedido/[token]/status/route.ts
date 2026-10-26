import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireStaleOrders } from "@/lib/orders";

/** Consulta leve do status, usada pela página do pedido para atualizar sozinha após o Pix. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.json({ error: "inválido" }, { status: 400 });
  await expireStaleOrders();
  const order = await db.order.findUnique({ where: { publicToken: token }, select: { status: true, paidAt: true } });
  if (!order) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(
    { status: order.status, paid: order.paidAt != null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
