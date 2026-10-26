"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGlassesToCart } from "@/app/(loja)/carrinho/actions";
import { formatBRL } from "@/lib/money";

type Kind = "VISAO_SIMPLES" | "MULTIFOCAL" | "BIFOCAL" | "OCUPACIONAL";
type Lens = {
  id: string; kind: Kind; name: string; index: string; description: string | null; priceCents: number;
  productionDays: number; minSphere: number; maxSphere: number; maxCylinder: number;
};
type Treatment = { id: string; name: string; description: string | null; priceCents: number };

const KINDS: { kind: Kind; title: string; text: string }[] = [
  { kind: "VISAO_SIMPLES", title: "Visão simples", text: "Para enxergar bem de longe OU de perto. É o tipo mais comum." },
  { kind: "MULTIFOCAL", title: "Multifocal", text: "Longe, intermediário e perto na mesma lente, sem linha visível. Exige o valor de adição na receita." },
  { kind: "OCUPACIONAL", title: "Ocupacional", text: "Para quem passa o dia no computador: perto e meia distância com mais conforto." },
  { kind: "BIFOCAL", title: "Bifocal", text: "Duas áreas de visão (longe e perto) com uma linha divisória." },
];

const STEPS = ["Tipo de lente", "Material e espessura", "Tratamentos", "Resumo"];

export function Configurator({ frame, lenses, treatments }: {
  frame: { variantId: string; name: string; variantLabel: string; image: string | null; priceCents: number };
  lenses: Lens[];
  treatments: Treatment[];
}) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [lensId, setLensId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const availableKinds = KINDS.filter((k) => lenses.some((l) => l.kind === k.kind));
  const lensOptions = lenses.filter((l) => l.kind === kind);
  const lens = lenses.find((l) => l.id === lensId) ?? null;
  const total = useMemo(
    () => frame.priceCents + (lens?.priceCents ?? 0) + treatments.filter((t) => chosen.includes(t.id)).reduce((s, t) => s + t.priceCents, 0),
    [frame.priceCents, lens, treatments, chosen],
  );

  const goto = (n: number) => {
    setStep(n);
    setError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    if (step === 0 && !kind) return setError("Escolha o tipo de lente.");
    if (step === 1 && !lensId) return setError("Escolha o material da lente.");
    goto(step + 1);
  };

  const finish = () =>
    start(async () => {
      if (!lensId) return;
      const res = await addGlassesToCart(frame.variantId, { lensOptionId: lensId, treatmentIds: chosen });
      if (res?.error) setError(res.error);
      else router.push("/carrinho");
    });

  return (
    <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
      <div>
        <ol className="flex flex-wrap gap-2 mb-6" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined}
              className={`selo py-1.5 px-3 ${i === step ? "bg-marca text-white" : i < step ? "bg-gelo text-marca border border-marca" : "bg-gelo text-suave"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        <section className="cartao p-5 md:p-7" aria-labelledby="titulo-etapa">
          <h2 id="titulo-etapa" ref={headingRef} tabIndex={-1} className="text-3xl outline-none">{STEPS[step]}</h2>

          {step === 0 && (
            <fieldset className="mt-4">
              <legend className="sr-only">Tipo de lente</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                {availableKinds.map((k) => (
                  <label key={k.kind} className={`cartao p-4 cursor-pointer border-2 ${kind === k.kind ? "border-marca bg-gelo" : ""}`}>
                    <input type="radio" name="kind" value={k.kind} checked={kind === k.kind}
                      onChange={() => { setKind(k.kind); setLensId(null); }} className="sr-only" />
                    <span className="block font-semibold text-lg">{k.title}</span>
                    <span className="block text-suave mt-1">{k.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset className="mt-4">
              <legend className="ajuda mb-3">
                Quanto maior o índice, mais fina e leve fica a lente. Para graus acima de 4, recomendamos índice 1.61 ou maior.
              </legend>
              <div className="grid gap-3">
                {lensOptions.map((l) => (
                  <label key={l.id} className={`cartao p-4 cursor-pointer border-2 flex justify-between gap-4 ${lensId === l.id ? "border-marca bg-gelo" : ""}`}>
                    <input type="radio" name="lens" value={l.id} checked={lensId === l.id} onChange={() => setLensId(l.id)} className="sr-only" />
                    <span>
                      <span className="block font-semibold">{l.name} — índice {l.index}</span>
                      {l.description && <span className="block text-suave">{l.description}</span>}
                      <span className="block text-sm text-suave mt-1">
                        Atende esférico de {l.minSphere} a +{l.maxSphere} e cilíndrico até {l.maxCylinder}. Produção em até {l.productionDays} dias úteis.
                      </span>
                    </span>
                    <span className="font-bold whitespace-nowrap">+ {formatBRL(l.priceCents)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="mt-4">
              <legend className="ajuda mb-3">Opcional. Escolha quantos quiser.</legend>
              <div className="grid gap-3">
                {treatments.map((t) => {
                  const on = chosen.includes(t.id);
                  return (
                    <label key={t.id} className={`cartao p-4 cursor-pointer border-2 flex items-start gap-3 ${on ? "border-marca bg-gelo" : ""}`}>
                      <input type="checkbox" checked={on} className="w-5 h-5 mt-1 accent-marca"
                        onChange={() => setChosen((c) => (on ? c.filter((x) => x !== t.id) : [...c, t.id]))} />
                      <span className="flex-1">
                        <span className="block font-semibold">{t.name}</span>
                        {t.description && <span className="block text-suave">{t.description}</span>}
                      </span>
                      <span className="font-bold whitespace-nowrap">+ {formatBRL(t.priceCents)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {step === 3 && lens && (
            <div className="mt-4 space-y-3">
              <p><strong>Armação:</strong> {frame.name}{frame.variantLabel ? ` (${frame.variantLabel})` : ""} — {formatBRL(frame.priceCents)}</p>
              <p><strong>Lentes:</strong> {KINDS.find((k) => k.kind === lens.kind)?.title}, {lens.name}, índice {lens.index} — {formatBRL(lens.priceCents)}</p>
              <p><strong>Tratamentos:</strong> {chosen.length === 0 ? "nenhum" : treatments.filter((t) => chosen.includes(t.id)).map((t) => `${t.name} (${formatBRL(t.priceCents)})`).join(", ")}</p>
              <p><strong>Prazo de produção:</strong> até {lens.productionDays} dias úteis depois da aprovação da receita.</p>
              <p className="cartao bg-gelo p-4">
                Na finalização da compra você informa a receita: pode digitar os valores e anexar a foto, só anexar a foto
                ou escolher enviar depois. Nada é produzido antes da conferência pela nossa equipe.
              </p>
            </div>
          )}

          <div aria-live="assertive" className="min-h-6 mt-3">{error && <p className="erro" role="alert">{error}</p>}</div>

          <div className="mt-4 flex flex-wrap gap-3">
            {step > 0 && <button type="button" className="btn btn-secundario" onClick={() => goto(step - 1)}>Voltar</button>}
            {step < 3 ? (
              <button type="button" className="btn btn-primario" onClick={next}>Continuar</button>
            ) : (
              <button type="button" className="btn btn-primario" onClick={finish} disabled={pending}>
                {pending ? "Adicionando…" : "Adicionar ao carrinho"}
              </button>
            )}
          </div>
        </section>
      </div>

      <aside className="cartao p-5 lg:sticky lg:top-40" aria-label="Resumo do óculos">
        {frame.image && <img src={frame.image} alt="" className="w-full aspect-[4/3] object-contain bg-gelo rounded-lg p-3" />}
        <p className="mt-3 font-semibold">{frame.name}</p>
        <dl className="mt-3 space-y-1 text-[0.97rem]">
          <div className="flex justify-between"><dt>Armação</dt><dd>{formatBRL(frame.priceCents)}</dd></div>
          {lens && <div className="flex justify-between"><dt>Lentes</dt><dd>{formatBRL(lens.priceCents)}</dd></div>}
          {treatments.filter((t) => chosen.includes(t.id)).map((t) => (
            <div key={t.id} className="flex justify-between"><dt>{t.name}</dt><dd>{formatBRL(t.priceCents)}</dd></div>
          ))}
        </dl>
        <p className="mt-3 pt-3 border-t border-contorno flex justify-between text-xl font-bold" aria-live="polite">
          <span>Total</span><span>{formatBRL(total)}</span>
        </p>
      </aside>
    </div>
  );
}
