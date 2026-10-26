import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/guards";
import { readPrivateFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

/**
 * Entrega o arquivo da receita, descriptografado no servidor, só para quem tem permissão.
 * Nunca é guardado em cache; cada abertura fica registrada.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  let user;
  try {
    user = await assertStaff("receitas.ver");
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  const { id, n } = await params;
  const rx = await db.prescription.findUnique({ where: { id }, include: { orders: { select: { status: true } } } });
  const key = rx?.fileKeys[Number(n)];
  if (!rx || !key) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const { data, type } = await readPrivateFile(key);
  await db.rxAccessLog.create({ data: { prescriptionId: rx.id, userId: user.id, action: `ver_arquivo_${n}` } });
  await audit(user.id, "receita_arquivo_visualizado", "receita", rx.id);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
