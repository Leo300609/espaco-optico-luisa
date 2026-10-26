import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomer, getClientIp } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ estatisticas: z.boolean(), marketing: z.boolean(), versao: z.string().max(20) });

/** Registra a escolha de cookies (prova de consentimento: data, versão e escolha). */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "origem inválida" }, { status: 403 });
  const ip = await getClientIp();
  if (!(await rateLimit(`cookies:${ip}`, 20, 3600))) return NextResponse.json({ ok: true });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });
  const user = await getCustomer();
  await db.consent.create({
    data: {
      userId: user?.id,
      type: "COOKIES",
      textVersion: parsed.data.versao,
      granted: parsed.data.estatisticas || parsed.data.marketing,
      channel: `site:estatisticas=${parsed.data.estatisticas};marketing=${parsed.data.marketing}`,
      ip,
    },
  });
  return NextResponse.json({ ok: true });
}
