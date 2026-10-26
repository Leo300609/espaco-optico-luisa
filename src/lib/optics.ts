import { z } from "zod";

/**
 * Dados da receita (capítulo 1.3). O site NÃO diagnostica nem sugere grau:
 * apenas registra o que consta na receita e alerta para valores incomuns.
 */

const quarterStep = (v: number) => Math.abs(Math.round(v * 4) - v * 4) < 1e-9;

const diopter = (min: number, max: number) =>
  z
    .number()
    .min(min, `Valor mínimo ${min}`)
    .max(max, `Valor máximo ${max}`)
    .refine(quarterStep, "Use passos de 0,25");

export const eyeSchema = z
  .object({
    sphere: diopter(-30, 30).nullable(),
    cylinder: diopter(-10, 10).nullable(),
    axis: z.number().int().min(0, "Eixo entre 0 e 180").max(180, "Eixo entre 0 e 180").nullable(),
    addition: diopter(0, 4).nullable(),
    dnp: z.number().min(20, "DNP muito baixa").max(45, "DNP muito alta").nullable(),
    height: z.number().min(10).max(40).nullable(),
    prism: z.number().min(0).max(20).nullable(),
    prismBase: z.string().max(20).nullable(),
  })
  .superRefine((eye, ctx) => {
    if (eye.cylinder != null && eye.cylinder !== 0 && eye.axis == null) {
      ctx.addIssue({ code: "custom", path: ["axis"], message: "Informe o eixo quando houver cilíndrico" });
    }
  });

export const rxDataSchema = z.object({
  od: eyeSchema,
  oe: eyeSchema,
  totalDp: z.number().min(40).max(80).nullable(),
  heightAtStore: z.boolean().default(false),
});

export type RxData = z.infer<typeof rxDataSchema>;
export type EyeData = z.infer<typeof eyeSchema>;

/** Converte texto digitado ("-2,25", "+1.5", "") em número ou null. */
export function parseDiopter(input: FormDataEntryValue | null): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(",", ".").replace(/\s/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function eyeFromForm(form: FormData, prefix: "od" | "oe"): Record<string, unknown> {
  const num = (k: string) => parseDiopter(form.get(`${prefix}_${k}`));
  const axis = num("axis");
  return {
    sphere: num("sphere"),
    cylinder: num("cylinder"),
    axis: axis == null ? null : Math.round(axis),
    addition: num("addition"),
    dnp: num("dnp"),
    height: num("height"),
    prism: num("prism"),
    prismBase: (form.get(`${prefix}_prismBase`) as string | null)?.trim() || null,
  };
}

export function hasAnyValue(eye: EyeData): boolean {
  return [eye.sphere, eye.cylinder, eye.addition, eye.dnp].some((v) => v != null);
}

/** Alertas para o cliente revisar (nunca altera o que foi digitado). */
export function rxWarnings(rx: RxData): string[] {
  const w: string[] = [];
  for (const [label, eye] of [["direito", rx.od], ["esquerdo", rx.oe]] as const) {
    if (eye.sphere != null && Math.abs(eye.sphere) > 10) w.push(`Esférico do olho ${label} acima de 10 graus — confira na receita.`);
    if (eye.cylinder != null && Math.abs(eye.cylinder) > 4) w.push(`Cilíndrico do olho ${label} acima de 4 graus — confira na receita.`);
    if (eye.dnp != null && (eye.dnp < 26 || eye.dnp > 38)) w.push(`DNP do olho ${label} fora da faixa mais comum (26 a 38 mm) — confira.`);
  }
  if (rx.od.sphere != null && rx.oe.sphere != null && Math.abs(rx.od.sphere - rx.oe.sphere) > 3) {
    w.push("Diferença grande de grau entre os olhos — confira se os valores não foram trocados.");
  }
  return w;
}

export function formatDiopter(v: number | null): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}`;
}

/** Verifica se uma lente atende o grau informado. */
export function lensSupports(
  lens: { minSphere: number; maxSphere: number; maxCylinder: number },
  rx: RxData | null,
): boolean {
  if (!rx) return true;
  return [rx.od, rx.oe].every(
    (e) =>
      (e.sphere == null || (e.sphere >= lens.minSphere && e.sphere <= lens.maxSphere)) &&
      (e.cylinder == null || Math.abs(e.cylinder) <= lens.maxCylinder),
  );
}
