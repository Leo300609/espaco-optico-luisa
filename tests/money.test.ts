import { describe, expect, it } from "vitest";
import { centsToInput, currentPrice, formatBRL, parseBRL } from "@/lib/money";

describe("dinheiro em centavos", () => {
  it("formata em reais", () => {
    expect(formatBRL(29900).replace(/\s/g, " ")).toBe("R$ 299,00");
  });
  it("lê valores digitados no padrão brasileiro e americano", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("299")).toBe(29900);
    expect(parseBRL("19.90")).toBe(1990);
    expect(parseBRL("R$ 49,90")).toBe(4990);
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("-5")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
  });
  it("converte para campo de formulário", () => {
    expect(centsToInput(4990)).toBe("49,90");
    expect(centsToInput(null)).toBe("");
  });
});

describe("promoção agendada", () => {
  const base = { priceCents: 10000, promoCents: 8000, promoStart: null, promoEnd: null };
  it("aplica promoção sem datas", () => {
    expect(currentPrice(base)).toEqual({ price: 8000, original: 10000 });
  });
  it("ignora promoção futura ou vencida", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(currentPrice({ ...base, promoStart: new Date("2026-11-01") }, now).price).toBe(10000);
    expect(currentPrice({ ...base, promoEnd: new Date("2026-10-01") }, now).price).toBe(10000);
  });
  it("ignora promoção maior que o preço", () => {
    expect(currentPrice({ ...base, promoCents: 12000 }).price).toBe(10000);
  });
});
