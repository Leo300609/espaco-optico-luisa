/** Dados públicos da loja. Os campos marcados como "a confirmar" dependem do dono (capítulo 10). */
export const STORE = {
  name: "Espaço Óptico Luísa",
  shortName: "Óptico Luísa",
  tagline: "Sua ótica de confiança em Suzano",
  phone: "(11) 4759-3608",
  phoneHref: "tel:+551147593608",
  whatsapp: "(11) 95050-5009",
  whatsappNumber: "5511950505009",
  email: "contato@espacoopticoluisa.com.br", // a confirmar
  address: {
    street: "Endereço da loja (a confirmar)",
    district: "Centro",
    city: "Suzano",
    state: "SP",
    cep: "08600-000",
  },
  hours: [
    { days: "Segunda a sexta", time: "9h às 18h" },
    { days: "Sábado", time: "9h às 13h" },
  ], // a confirmar
  motto: "Deus é Fiel!",
  instagram: "", // a confirmar
  pickupDays: 15,
  legal: {
    companyName: "Razão social (a confirmar)",
    cnpj: "00.000.000/0000-00",
    dpoName: "Proprietário(a) — Encarregado(a) de dados",
    dpoEmail: "privacidade@espacoopticoluisa.com.br",
  },
} as const;

export function whatsappLink(message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${STORE.whatsappNumber}${text}`;
}

export function fullAddress(): string {
  const a = STORE.address;
  return `${a.street}, ${a.district}, ${a.city}/${a.state}, CEP ${a.cep}`;
}

export const POLICY_VERSION = "2026-10-25";
