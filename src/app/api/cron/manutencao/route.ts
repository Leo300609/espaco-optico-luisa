import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { expireStaleOrders } from "@/lib/orders";
import { deletePrivateFile } from "@/lib/storage";

/**
 * Rotina diária (Vercel Cron): expira Pix vencidos, elimina receitas após o prazo de retenção (LGPD),
 * limpa sessões, carrinhos e contadores antigos. Protegida por CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const now = new Date();
  const expired = await expireStaleOrders();

  const oldRx = await db.prescription.findMany({ where: { deleteAfter: { lt: now } }, select: { id: true, fileKeys: true }, take: 200 });
  for (const rx of oldRx) {
    for (const k of rx.fileKeys) await deletePrivateFile(k);
    await db.prescription.update({
      where: { id: rx.id },
      data: { fileKeys: [], dataEnc: null, doctorName: null, doctorReg: null, customerNotes: null },
    });
  }

  const [sessions, carts, limits] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.cart.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }),
  ]);

  return NextResponse.json({
    pedidosExpirados: expired,
    receitasEliminadas: oldRx.length,
    sessoes: sessions.count,
    carrinhos: carts.count,
    limites: limits.count,
  });
}
