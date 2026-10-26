import { describe, expect, it } from "vitest";
import { formatCep, isValidCpf, isValidPhone, slugify } from "@/lib/format";
import { can } from "@/lib/permissions";

describe("documentos e contatos", () => {
  it("valida CPF pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("valida telefone com DDD", () => {
    expect(isValidPhone("(11) 95050-5009")).toBe(true);
    expect(isValidPhone("(11) 4759-3608")).toBe(true);
    expect(isValidPhone("95050")).toBe(false);
  });
  it("formata CEP e gera endereços legíveis", () => {
    expect(formatCep("08600000")).toBe("08600-000");
    expect(slugify("Óculos de Sol Aviador Dourado")).toBe("oculos-de-sol-aviador-dourado");
  });
});

describe("permissões do painel", () => {
  it("segue a matriz da documentação", () => {
    expect(can("PROPRIETARIO", "usuarios.gerir")).toBe(true);
    expect(can("GERENTE", "usuarios.gerir")).toBe(false);
    expect(can("GERENTE", "pedidos.reembolsar")).toBe(false);
    expect(can("ATENDENTE", "precos.editar")).toBe(false);
    expect(can("ATENDENTE", "receitas.ver")).toBe(false);
    expect(can("OPTICO", "receitas.revisar")).toBe(true);
    expect(can("OPTICO", "produtos.editar")).toBe(false);
    expect(can("CLIENTE", "dashboard")).toBe(false);
  });
});
