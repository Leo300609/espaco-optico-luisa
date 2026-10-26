import { describe, expect, it } from "vitest";
import { lensSupports, parseDiopter, rxDataSchema, rxWarnings } from "@/lib/optics";

const eye = (o: Partial<Record<string, number | string | null>> = {}) => ({
  sphere: null, cylinder: null, axis: null, addition: null, dnp: null, height: null, prism: null, prismBase: null, ...o,
});

describe("valores da receita", () => {
  it("lê grau com vírgula, ponto e sinal", () => {
    expect(parseDiopter("-2,25")).toBe(-2.25);
    expect(parseDiopter("+1.5")).toBe(1.5);
    expect(parseDiopter("")).toBeNull();
    expect(Number.isNaN(parseDiopter("x"))).toBe(true);
  });

  it("aceita receita válida", () => {
    const r = rxDataSchema.safeParse({ od: eye({ sphere: -2.25, cylinder: -0.75, axis: 180, dnp: 31 }), oe: eye({ sphere: -2, dnp: 31.5 }), totalDp: null });
    expect(r.success).toBe(true);
  });

  it("exige passos de 0,25", () => {
    const r = rxDataSchema.safeParse({ od: eye({ sphere: -2.3 }), oe: eye(), totalDp: null });
    expect(r.success).toBe(false);
  });

  it("exige eixo quando há cilíndrico", () => {
    const r = rxDataSchema.safeParse({ od: eye({ sphere: -1, cylinder: -1 }), oe: eye(), totalDp: null });
    expect(r.success).toBe(false);
  });

  it("rejeita eixo fora de 0 a 180", () => {
    const r = rxDataSchema.safeParse({ od: eye({ cylinder: -1, axis: 200 }), oe: eye(), totalDp: null });
    expect(r.success).toBe(false);
  });

  it("alerta valores incomuns sem alterar nada", () => {
    const rx = rxDataSchema.parse({ od: eye({ sphere: -11 }), oe: eye({ sphere: -2, dnp: 45 }), totalDp: null });
    const w = rxWarnings(rx);
    expect(w.some((x) => x.includes("10 graus"))).toBe(true);
    expect(w.some((x) => x.includes("DNP"))).toBe(true);
    expect(w.some((x) => x.includes("trocados"))).toBe(true);
    expect(rx.od.sphere).toBe(-11);
  });

  it("verifica se a lente atende o grau", () => {
    const lens = { minSphere: -6, maxSphere: 4, maxCylinder: 2 };
    const ok = rxDataSchema.parse({ od: eye({ sphere: -5 }), oe: eye({ sphere: -4 }), totalDp: null });
    const bad = rxDataSchema.parse({ od: eye({ sphere: -7 }), oe: eye(), totalDp: null });
    expect(lensSupports(lens, ok)).toBe(true);
    expect(lensSupports(lens, bad)).toBe(false);
  });
});
