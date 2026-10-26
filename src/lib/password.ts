import "server-only";
import bcrypt from "bcryptjs";

const COMMON = new Set([
  "123456", "12345678", "123456789", "1234567890", "senha123", "password", "qwerty123",
  "11111111", "00000000", "abc12345", "senha1234", "otica123", "brasil123", "iloveyou",
  "admin123", "12341234", "minhasenha", "suzano123",
]);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

let dummy: Promise<string> | null = null;
/** Resumo descartável, para comparar senha mesmo quando a conta não existe (não revela contas pelo tempo de resposta). */
export function dummyHash(): Promise<string> {
  if (!dummy) dummy = bcrypt.hash("conta-inexistente", 12);
  return dummy as Promise<string>;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Retorna mensagem de erro ou null se a senha é aceitável. */
export function passwordProblem(password: string, isStaff: boolean): string | null {
  const min = isStaff ? 12 : 8;
  if (password.length < min) return `A senha precisa ter pelo menos ${min} caracteres.`;
  if (password.length > 128) return "A senha é longa demais.";
  if (COMMON.has(password.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  if (/^(.)\1+$/.test(password)) return "Evite repetir o mesmo caractere.";
  return null;
}
