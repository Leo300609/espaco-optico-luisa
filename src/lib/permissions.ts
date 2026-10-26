import type { Role } from "@prisma/client";

/**
 * Matriz de permissões do painel (capítulo 3.1 da documentação).
 * Verificada SEMPRE no servidor, em cada ação. Esconder botões é só conveniência.
 */
export type Permission =
  | "dashboard"
  | "produtos.ver"
  | "produtos.editar"
  | "precos.editar"
  | "estoque.ver"
  | "estoque.ajustar"
  | "pedidos.ver"
  | "pedidos.atualizar"
  | "pedidos.reembolsar"
  | "receitas.ver"
  | "receitas.revisar"
  | "cupons.editar"
  | "conteudo.editar"
  | "clientes.ver"
  | "clientes.lgpd"
  | "relatorios.ver"
  | "frete.editar"
  | "lentes.editar"
  | "mensagens.ver"
  | "usuarios.gerir"
  | "atividades.ver"
  | "config.editar";

const ALL: Permission[] = [
  "dashboard", "produtos.ver", "produtos.editar", "precos.editar", "estoque.ver", "estoque.ajustar",
  "pedidos.ver", "pedidos.atualizar", "pedidos.reembolsar", "receitas.ver", "receitas.revisar",
  "cupons.editar", "conteudo.editar", "clientes.ver", "clientes.lgpd", "relatorios.ver", "frete.editar",
  "lentes.editar", "mensagens.ver", "usuarios.gerir", "atividades.ver", "config.editar",
];

const MATRIX: Record<Role, Permission[]> = {
  PROPRIETARIO: ALL,
  GERENTE: [
    "dashboard", "produtos.ver", "produtos.editar", "precos.editar", "estoque.ver", "estoque.ajustar",
    "pedidos.ver", "pedidos.atualizar", "cupons.editar", "conteudo.editar", "clientes.ver",
    "relatorios.ver", "lentes.editar", "mensagens.ver", "atividades.ver",
  ],
  ATENDENTE: [
    "dashboard", "produtos.ver", "estoque.ver", "estoque.ajustar", "pedidos.ver", "pedidos.atualizar",
    "clientes.ver", "mensagens.ver",
  ],
  OPTICO: ["dashboard", "produtos.ver", "pedidos.ver", "receitas.ver", "receitas.revisar"],
  CLIENTE: [],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  PROPRIETARIO: "Proprietário",
  GERENTE: "Gerente",
  ATENDENTE: "Atendente",
  OPTICO: "Responsável óptico",
  CLIENTE: "Cliente",
};
