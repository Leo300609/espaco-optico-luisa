/** Utilidades de dinheiro. Tudo em centavos para evitar erro de arredondamento. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte "1.234,56" ou "1234.56" ou "1234" em centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  const clean = input.trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  let normalized = clean;
  if (clean.includes(",")) normalized = clean.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function installmentText(totalCents: number, maxInstallments: number, minInstallmentCents = 3000): string | null {
  let n = Math.min(maxInstallments, Math.floor(totalCents / minInstallmentCents));
  if (n < 2) return null;
  n = Math.max(2, n);
  return `ou ${n}x de ${formatBRL(Math.ceil(totalCents / n))} sem juros`;
}

/** Preço vigente do produto, considerando promoção agendada. */
export function currentPrice(p: {
  priceCents: number;
  promoCents: number | null;
  promoStart: Date | null;
  promoEnd: Date | null;
}, now = new Date()): { price: number; original: number | null } {
  const promoActive =
    p.promoCents != null &&
    p.promoCents < p.priceCents &&
    (!p.promoStart || p.promoStart <= now) &&
    (!p.promoEnd || p.promoEnd >= now);
  return promoActive ? { price: p.promoCents!, original: p.priceCents } : { price: p.priceCents, original: null };
}
