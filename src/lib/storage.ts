import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { decryptBuffer, encryptBuffer, randomToken } from "./crypto";

/**
 * Duas áreas de arquivos, com regras diferentes (capítulo 7.3):
 *  - pública: fotos de produto e banners (servidas por CDN);
 *  - privada: receitas, SEMPRE criptografadas antes de salvar e lidas só pelo servidor.
 * Driver "local" para desenvolvimento; "vercel-blob" em produção.
 */

const LOCAL_PUBLIC = path.join(process.cwd(), "public", "uploads");
const LOCAL_PRIVATE = path.join(process.cwd(), "storage", "private");

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RX_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** Confere a assinatura real do arquivo (não confia na extensão nem no tipo informado). */
export function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Remove metadados EXIF (como localização) de JPEG, mantendo a imagem. */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1]!;
    if (marker === 0xda) {
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    const isAppMeta = marker === 0xe1 || marker === 0xed || marker === 0xe2; // EXIF/XMP, IPTC, ICC
    if (!isAppMeta) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return buf;
}

export async function savePublicImage(file: File, folder: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error("Imagem maior que 5 MB.");
  const type = sniffType(buf);
  if (!type || !(IMAGE_TYPES as readonly string[]).includes(type)) throw new Error("Envie JPG, PNG ou WebP.");
  const clean = type === "image/jpeg" ? stripJpegMetadata(buf) : buf;
  const name = `${folder}/${randomToken(12)}.${EXT[type]}`;

  if (env().STORAGE_DRIVER === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const res = await put(`publico/${name}`, clean, { access: "public", contentType: type, addRandomSuffix: false });
    return res.url;
  }
  const full = path.join(LOCAL_PUBLIC, name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, clean);
  return `/uploads/${name}`;
}

/** Salva arquivo de receita criptografado. Retorna a chave interna (nunca uma URL pública). */
export async function savePrivateFile(file: File): Promise<{ key: string; type: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB.");
  const type = sniffType(buf);
  if (!type || !(RX_TYPES as readonly string[]).includes(type)) throw new Error("Envie foto (JPG, PNG, WebP) ou PDF.");
  const clean = type === "image/jpeg" ? stripJpegMetadata(buf) : buf;
  const key = `receitas/${randomToken(24)}.${EXT[type]}.enc`;
  const encrypted = encryptBuffer(clean);

  if (env().STORAGE_DRIVER === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    // O conteúdo já está criptografado; mesmo que a URL vazasse, o arquivo seria ilegível sem a chave.
    const res = await put(`privado/${key}`, encrypted, {
      access: "public",
      contentType: "application/octet-stream",
      addRandomSuffix: true,
    });
    return { key: `blob:${res.url}`, type };
  }
  const full = path.join(LOCAL_PRIVATE, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, encrypted);
  return { key, type };
}

export async function readPrivateFile(key: string): Promise<{ data: Buffer; type: string }> {
  let encrypted: Buffer;
  if (key.startsWith("blob:")) {
    const res = await fetch(key.slice(5), { cache: "no-store" });
    if (!res.ok) throw new Error("Arquivo não encontrado.");
    encrypted = Buffer.from(await res.arrayBuffer());
  } else {
    if (key.includes("..")) throw new Error("Chave inválida.");
    encrypted = await readFile(path.join(LOCAL_PRIVATE, key));
  }
  const data = decryptBuffer(encrypted);
  return { data, type: sniffType(data) ?? "application/octet-stream" };
}

export async function deletePrivateFile(key: string) {
  if (key.startsWith("blob:")) {
    const { del } = await import("@vercel/blob");
    await del(key.slice(5)).catch(() => {});
  } else if (!key.includes("..")) {
    await unlink(path.join(LOCAL_PRIVATE, key)).catch(() => {});
  }
}
