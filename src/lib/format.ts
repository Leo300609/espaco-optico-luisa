import type { OrderStatus, RxStatus, ProductType } from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
  AGUARDANDO_RECEITA: "Aguardando receita",
  RECEITA_EM_ANALISE: "Receita em análise",
  RECEITA_PENDENTE: "Receita pendente de correção",
  EM_PRODUCAO: "Em produção",
  SEPARANDO: "Separando",
  PRONTO_RETIRADA: "Pronto para retirada",
  EM_ROTA: "Em rota de entrega",
  ENTREGUE: "Entregue",
  RETIRADO: "Retirado",
  CANCELADO: "Cancelado",
  REEMBOLSADO: "Reembolsado",
};

export const RX_STATUS_LABEL: Record<RxStatus, string> = {
  RECEBIDA: "Recebida",
  EM_ANALISE: "Em análise",
  APROVADA: "Aprovada",
  PENDENTE_CORRECAO: "Pendente de correção",
  RECUSADA: "Recusada",
};

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  ARMACAO: "Armação",
  OCULOS_SOL: "Óculos de sol",
  LENTE_CONTATO: "Lente de contato",
  LENTE_GRAU: "Lente de grau",
  ACESSORIO: "Acessório",
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export const fmtDate = (d: Date) => dateFmt.format(d);
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export function formatCep(s: string): string {
  const d = onlyDigits(s);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : s;
}

/** Validação de CPF pelos dígitos verificadores. */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidPhone(input: string): boolean {
  const d = onlyDigits(input);
  return d.length === 10 || d.length === 11;
}
