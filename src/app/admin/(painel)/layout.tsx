import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { requireStaff } from "@/lib/guards";
import { can, ROLE_LABEL, type Permission } from "@/lib/permissions";
import { adminSignOut } from "../auth-actions";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Óptico Luísa" }, robots: { index: false, follow: false } };

const MENU: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Início", perm: "dashboard" },
  { href: "/admin/pedidos", label: "Pedidos", perm: "pedidos.ver" },
  { href: "/admin/receitas", label: "Fila de receitas", perm: "receitas.ver" },
  { href: "/admin/produtos", label: "Produtos", perm: "produtos.ver" },
  { href: "/admin/estoque", label: "Estoque", perm: "estoque.ver" },
  { href: "/admin/lentes", label: "Lentes e tratamentos", perm: "lentes.editar" },
  { href: "/admin/cupons", label: "Cupons", perm: "cupons.editar" },
  { href: "/admin/banners", label: "Banners e páginas", perm: "conteudo.editar" },
  { href: "/admin/frete", label: "Frete e retirada", perm: "frete.editar" },
  { href: "/admin/mensagens", label: "Mensagens", perm: "mensagens.ver" },
  { href: "/admin/clientes", label: "Clientes e LGPD", perm: "clientes.ver" },
  { href: "/admin/relatorios", label: "Relatórios", perm: "relatorios.ver" },
  { href: "/admin/usuarios", label: "Usuários", perm: "usuarios.gerir" },
  { href: "/admin/atividades", label: "Registro de atividades", perm: "atividades.ver" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("dashboard");
  const items = MENU.filter((m) => can(user.role, m.perm));

  return (
    <div className="min-h-screen bg-gelo md:grid md:grid-cols-[250px_1fr]">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <aside className="bg-marca text-white sobre-escuro md:min-h-screen">
        <div className="p-4 flex items-center gap-3 border-b border-white/15">
          <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full" />
          <p className="leading-tight">
            <span className="block font-serif">Óptico Luísa</span>
            <span className="block text-xs text-white/75">Painel</span>
          </p>
        </div>
        <details open>
          <summary className="md:hidden p-4 cursor-pointer font-semibold">Menu</summary>
          <nav aria-label="Painel">
            <ul className="p-2 space-y-0.5">
              {items.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="block px-3 py-2.5 rounded-lg hover:bg-white/10">{m.label}</Link>
                </li>
              ))}
              <li><Link href="/" className="block px-3 py-2.5 rounded-lg hover:bg-white/10" target="_blank">Ver a loja ↗</Link></li>
            </ul>
          </nav>
        </details>
        <div className="p-4 border-t border-white/15 text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-white/75">{ROLE_LABEL[user.role]}</p>
          <form action={adminSignOut} className="mt-2"><button className="underline">Sair</button></form>
        </div>
      </aside>
      <main id="conteudo" tabIndex={-1} className="p-4 md:p-8 outline-none min-w-0">{children}</main>
    </div>
  );
}
