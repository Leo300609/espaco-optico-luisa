import { describe, expect, it, vi } from "vitest";

// O módulo de pedidos usa recursos de servidor; aqui só testamos a regra de transições.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), notifyStore: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({ APP_URL: "http://localhost:3000" }) }));

const { allowedManualTransitions, TRANSITIONS } = await import("@/lib/orders");

describe("máquina de status do pedido", () => {
  it("não permite pular etapas nem voltar de estados finais", () => {
    expect(TRANSITIONS.AGUARDANDO_PAGAMENTO).not.toContain("ENTREGUE");
    expect(TRANSITIONS.CANCELADO).toEqual([]);
    expect(TRANSITIONS.REEMBOLSADO).toEqual([]);
  });

  it("pagamento confirmado só é aplicado pelo sistema", () => {
    const t = allowedManualTransitions({ status: "AGUARDANDO_PAGAMENTO", fulfillment: "RETIRADA", prescriptionId: null }, false);
    expect(t).not.toContain("PAGAMENTO_CONFIRMADO");
    expect(t).toContain("CANCELADO");
  });

  it("separa opções de retirada e entrega", () => {
    const retirada = allowedManualTransitions({ status: "SEPARANDO", fulfillment: "RETIRADA", prescriptionId: null }, false);
    const entrega = allowedManualTransitions({ status: "SEPARANDO", fulfillment: "ENTREGA", prescriptionId: null }, false);
    expect(retirada).toContain("PRONTO_RETIRADA");
    expect(retirada).not.toContain("EM_ROTA");
    expect(entrega).toContain("EM_ROTA");
    expect(entrega).not.toContain("PRONTO_RETIRADA");
  });

  it("receita não aprovada bloqueia a produção", () => {
    const sem = allowedManualTransitions({ status: "RECEITA_EM_ANALISE", fulfillment: "RETIRADA", prescriptionId: "rx1" }, false);
    const com = allowedManualTransitions({ status: "RECEITA_EM_ANALISE", fulfillment: "RETIRADA", prescriptionId: "rx1" }, true);
    expect(sem).not.toContain("EM_PRODUCAO");
    expect(com).toContain("EM_PRODUCAO");
  });
});
