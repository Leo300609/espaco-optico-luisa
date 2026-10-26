import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Criptografia de campos e arquivos sensíveis (receitas, CPF, segredo do 2FA).
 * AES-256-GCM: confidencialidade + integridade. Formato: v1.<iv>.<tag>.<dados> (base64url).
 */

function key(): Buffer {
  const k = Buffer.from(env().ENCRYPTION_KEY, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64.");
  return k;
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("EOL1"), iv, tag, data]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  if (payload.subarray(0, 4).toString() !== "EOL1") throw new Error("Formato de arquivo criptografado desconhecido.");
  const iv = payload.subarray(4, 16);
  const tag = payload.subarray(16, 32);
  const data = payload.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptString(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Formato criptografado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJSON(value: unknown): string {
  return encryptString(JSON.stringify(value));
}

export function decryptJSON<T>(payload: string): T {
  return JSON.parse(decryptString(payload)) as T;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmac(input: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Código curto legível (sem caracteres ambíguos), para retirada na loja. */
export function shortCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-**` : "***";
}
