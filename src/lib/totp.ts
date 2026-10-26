import "server-only";
import { authenticator } from "otplib";
import { randomBytes } from "node:crypto";
import { decryptString, encryptString, sha256 } from "./crypto";

authenticator.options = { window: 1, step: 30, digits: 6 };

export function newTotpSecret() {
  const secret = authenticator.generateSecret();
  return { secret, secretEnc: encryptString(secret) };
}

export function totpUri(email: string, secret: string) {
  return authenticator.keyuri(email, "Espaço Óptico Luísa (Painel)", secret);
}

export function verifyTotp(code: string, secretEnc: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    return authenticator.check(clean, decryptString(secretEnc));
  } catch {
    return false;
  }
}

export function verifyTotpPlain(code: string, secret: string): boolean {
  const clean = code.replace(/\s/g, "");
  return /^\d{6}$/.test(clean) && authenticator.check(clean, secret);
}

/** Gera 8 códigos de recuperação. Retorna os códigos (mostrados uma única vez) e os resumos para guardar. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 8 }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}
