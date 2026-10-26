import "server-only";
import { db } from "./db";
import { getClientIp } from "./session";

/** Registro de atividades da equipe. Nunca grava dados pessoais sensíveis no resumo. */
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  summary?: string,
) {
  try {
    await db.auditLog.create({
      data: { userId, action, entity, entityId: entityId ?? null, summary: summary?.slice(0, 500), ip: await getClientIp() },
    });
  } catch (e) {
    console.error("Falha ao gravar auditoria", e instanceof Error ? e.message : e);
  }
}
