import type { Category, Product } from "@prisma/client";
import { centsToInput } from "@/lib/money";
import { saveProduct } from "@/app/admin/(painel)/produtos/actions";

const ATTRS: { key: string; label: string; types: string[]; kind?: "simnao" }[] = [
  { key: "larguraLente", label: "Largura da lente (mm)", types: ["ARMACAO", "OCULOS_SOL"] },
  { key: "ponte", label: "Ponte (mm)", types: ["ARMACAO", "OCULOS_SOL"] },
  { key: "haste", label: "Haste (mm)", types: ["ARMACAO", "OCULOS_SOL"] },
  { key: "alturaLente", label: "Altura da lente (mm)", types: ["ARMACAO", "OCULOS_SOL"] },
  { key: "peso", label: "Peso (g)", types: ["ARMACAO", "OCULOS_SOL"] },
  { key: "protecaoUV", label: "Proteção UV", types: ["OCULOS_SOL"] },
  { key: "polarizado", label: "Polarizado", types: ["OCULOS_SOL"], kind: "simnao" },
  { key: "corLente", label: "Cor da lente", types: ["OCULOS_SOL", "LENTE_CONTATO"] },
  { key: "periodicidade", label: "Periodicidade de troca", types: ["LENTE_CONTATO"] },
  { key: "curvaBase", label: "Curva base", types: ["LENTE_CONTATO"] },
  { key: "diametro", label: "Diâmetro", types: ["LENTE_CONTATO"] },
  { key: "unidadesCaixa", label: "Unidades por caixa", types: ["LENTE_CONTATO"] },
  { key: "volume", label: "Volume / tamanho", types: ["ACESSORIO"] },
];

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  const sp = new Date(d.getTime() - 3 * 3600_000);
  return sp.toISOString().slice(0, 10);
}

export function ProductForm({ product, categories, canEditPrice }: { product?: Product; categories: Category[]; canEditPrice: boolean }) {
  const attrs = (product?.attributes ?? {}) as Record<string, string | boolean>;
  const attrValue = (k: string) => {
    const v = attrs[k];
    return typeof v === "boolean" ? (v ? "sim" : "nao") : (v ?? "");
  };

  return (
    <form action={saveProduct} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}

      <fieldset className="cartao p-5 grid sm:grid-cols-2 gap-4">
        <legend className="font-serif text-2xl text-marca-escuro px-1">Informações</legend>
        <div className="sm:col-span-2">
          <label htmlFor="name" className="rotulo">Nome do produto *</label>
          <input id="name" name="name" required defaultValue={product?.name} className="campo" maxLength={140} />
        </div>
        <div>
          <label htmlFor="sku" className="rotulo">Código interno (SKU) *</label>
          <input id="sku" name="sku" required defaultValue={product?.sku} className="campo uppercase" maxLength={30} />
        </div>
        <div>
          <label htmlFor="brand" className="rotulo">Marca *</label>
          <input id="brand" name="brand" required defaultValue={product?.brand} className="campo" maxLength={60} />
        </div>
        <div>
          <label htmlFor="categoryId" className="rotulo">Categoria *</label>
          <select id="categoryId" name="categoryId" required defaultValue={product?.categoryId ?? ""} className="campo">
            <option value="" disabled>Escolha…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="rotulo">Tipo *</label>
          <select id="type" name="type" defaultValue={product?.type ?? "ARMACAO"} className="campo">
            <option value="ARMACAO">Armação</option><option value="OCULOS_SOL">Óculos de sol</option>
            <option value="LENTE_CONTATO">Lente de contato</option><option value="LENTE_GRAU">Lente de grau</option><option value="ACESSORIO">Acessório</option>
          </select>
        </div>
        <div>
          <label htmlFor="requiresRx" className="rotulo">Exige receita?</label>
          <select id="requiresRx" name="requiresRx" defaultValue={product?.requiresRx ?? "NAO"} className="campo">
            <option value="NAO">Não</option><option value="SIM">Sim</option><option value="OPCIONAL">Opcional</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end min-h-12">
          <input type="checkbox" name="acceptsLenses" defaultChecked={product?.acceptsLenses ?? false} className="w-5 h-5 accent-marca" />
          Aceita o configurador &quot;Monte seu óculos&quot; (armações e solares)
        </label>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="rotulo">Descrição *</label>
          <textarea id="description" name="description" required defaultValue={product?.description} className="campo min-h-40" maxLength={5000} />
          <p className="ajuda">Separe parágrafos com uma linha em branco.</p>
        </div>
        <div>
          <label htmlFor="gender" className="rotulo">Público</label>
          <input id="gender" name="gender" list="generos" defaultValue={product?.gender ?? ""} className="campo" />
          <datalist id="generos"><option value="Feminino" /><option value="Masculino" /><option value="Unissex" /><option value="Infantil" /></datalist>
        </div>
        <div>
          <label htmlFor="frameShape" className="rotulo">Formato</label>
          <input id="frameShape" name="frameShape" list="formatos" defaultValue={product?.frameShape ?? ""} className="campo" />
          <datalist id="formatos">{["Redondo", "Quadrado", "Retangular", "Gatinho", "Aviador", "Oval", "Hexagonal"].map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <div>
          <label htmlFor="material" className="rotulo">Material</label>
          <input id="material" name="material" list="materiais" defaultValue={product?.material ?? ""} className="campo" />
          <datalist id="materiais">{["Acetato", "Metal", "Titânio", "TR90", "Silicone hidrogel", "Microfibra"].map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <div>
          <label htmlFor="weightGrams" className="rotulo">Peso para frete (g)</label>
          <input id="weightGrams" name="weightGrams" type="number" min={1} defaultValue={product?.weightGrams ?? 200} className="campo" />
        </div>
      </fieldset>

      <fieldset className="cartao p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <legend className="font-serif text-2xl text-marca-escuro px-1">Preço</legend>
        {!canEditPrice && <p className="sm:col-span-4 ajuda">Seu perfil não pode alterar preços.</p>}
        <div>
          <label htmlFor="price" className="rotulo">Preço (R$) *</label>
          <input id="price" name="price" required inputMode="decimal" defaultValue={centsToInput(product?.priceCents)} readOnly={!canEditPrice} className="campo" />
        </div>
        <div>
          <label htmlFor="promo" className="rotulo">Preço promocional (R$)</label>
          <input id="promo" name="promo" inputMode="decimal" defaultValue={centsToInput(product?.promoCents)} readOnly={!canEditPrice} className="campo" />
        </div>
        <div>
          <label htmlFor="promoStart" className="rotulo">Promoção começa</label>
          <input id="promoStart" name="promoStart" type="date" defaultValue={toDateInput(product?.promoStart)} readOnly={!canEditPrice} className="campo" />
        </div>
        <div>
          <label htmlFor="promoEnd" className="rotulo">Promoção termina</label>
          <input id="promoEnd" name="promoEnd" type="date" defaultValue={toDateInput(product?.promoEnd)} readOnly={!canEditPrice} className="campo" />
        </div>
      </fieldset>

      <fieldset className="cartao p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <legend className="font-serif text-2xl text-marca-escuro px-1">Atributos ópticos</legend>
        <p className="sm:col-span-2 lg:col-span-4 ajuda">Preencha os que se aplicam ao tipo do produto. Aparecem na página do produto.</p>
        {ATTRS.map((a) => (
          <div key={a.key}>
            <label htmlFor={`attr_${a.key}`} className="rotulo">{a.label} <span className="text-sm font-normal text-suave">({a.types.map((t) => t.replace("_", " ").toLowerCase()).join(", ")})</span></label>
            {a.kind === "simnao" ? (
              <select id={`attr_${a.key}`} name={`attr_${a.key}`} defaultValue={String(attrValue(a.key))} className="campo">
                <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            ) : (
              <input id={`attr_${a.key}`} name={`attr_${a.key}`} defaultValue={String(attrValue(a.key))} className="campo" maxLength={60} />
            )}
          </div>
        ))}
      </fieldset>

      <fieldset className="cartao p-5 grid sm:grid-cols-2 gap-4">
        <legend className="font-serif text-2xl text-marca-escuro px-1">Publicação e Google</legend>
        <div>
          <label htmlFor="status" className="rotulo">Situação</label>
          <select id="status" name="status" defaultValue={product?.status ?? "RASCUNHO"} className="campo">
            <option value="RASCUNHO">Rascunho (não aparece na loja)</option>
            <option value="ATIVO">Ativo (publicado)</option>
            <option value="OCULTO">Oculto</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end min-h-12">
          <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} className="w-5 h-5 accent-marca" /> Mostrar nos destaques da página inicial
        </label>
        <div>
          <label htmlFor="seoTitle" className="rotulo">Título no Google (até 70)</label>
          <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={product?.seoTitle ?? ""} className="campo" placeholder="Ex.: Armação redonda Ray-Ban em Suzano" />
        </div>
        <div>
          <label htmlFor="seoDesc" className="rotulo">Descrição no Google (até 160)</label>
          <input id="seoDesc" name="seoDesc" maxLength={160} defaultValue={product?.seoDesc ?? ""} className="campo" />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button className="btn btn-primario">Salvar produto</button>
      </div>
    </form>
  );
}
