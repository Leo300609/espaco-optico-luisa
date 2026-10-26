import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente validadas na inicialização.
 * Nenhum segredo fica no código: tudo vem do painel da Vercel (ou do .env local).
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // 32 bytes em base64 — gere com: openssl rand -base64 32
  ENCRYPTION_KEY: z.string().min(40),
  // segredo para HMAC de tokens e códigos
  SESSION_SECRET: z.string().min(32),
  PAYMENT_PROVIDER: z.enum(["mercadopago", "mock"]).default("mock"),
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  PIX_EXPIRATION_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  MAX_INSTALLMENTS: z.coerce.number().int().min(1).max(12).default(6),
  STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).default("local"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Espaço Óptico Luísa <nao-responda@espacoopticoluisa.com.br>"),
  STORE_NOTIFY_EMAIL: z.string().email().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${missing}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.PAYMENT_PROVIDER === "mock" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    throw new Error("PAYMENT_PROVIDER=mock não é permitido em produção.");
  }
  cached = parsed.data;
  return cached;
}
