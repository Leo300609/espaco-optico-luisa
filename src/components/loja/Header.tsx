import Link from "next/link";
import Image from "next/image";
import { getCart } from "@/lib/cart";
import { getCustomer } from "@/lib/session";
import { IconBag, IconSearch, IconUser } from "../icons";
import { MobileMenu } from "./MobileMenu";
import { STORE } from "@/lib/site";

export const NAV = [
  { href: "/catalogo/armacoes", label: "Armações" },
  { href: "/catalogo/oculos-de-sol", label: "Óculos de sol" },
  { href: "/catalogo/lentes-de-contato", label: "Lentes de contato" },
  { href: "/catalogo/lentes-de-grau", label: "Lentes de grau" },
  { href: "/catalogo/acessorios", label: "Acessórios" },
  { href: "/catalogo?promo=1", label: "Promoções" },
];

export async function Header() {
  const [cart, customer] = await Promise.all([getCart(), getCustomer()]);
  const count = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-contorno">
      <div className="bg-marca text-white text-sm sobre-escuro">
        <p className="conteudo py-1.5 text-center">
          Retire grátis na loja em Suzano · Pix e cartão em até 6x ·{" "}
          <a className="underline underline-offset-2" href={STORE.phoneHref}>
            {STORE.phone}
          </a>
        </p>
      </div>
      <div className="conteudo flex items-center gap-3 py-3">
        <MobileMenu items={NAV} />
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label={`${STORE.name} — página inicial`}>
          <Image src="/logo.jpg" alt="" width={52} height={52} className="rounded-full" priority />
          <span className="hidden sm:flex flex-col leading-none">
            <span className="font-serif text-[0.95rem] tracking-wide text-suave">Espaço Óptico</span>
            <span className="font-script text-3xl text-marca -mt-0.5">Luísa</span>
          </span>
        </Link>

        <form action="/catalogo" role="search" className="hidden md:flex flex-1 max-w-xl mx-auto">
          <label htmlFor="busca-topo" className="sr-only">
            Buscar produtos
          </label>
          <input
            id="busca-topo"
            name="q"
            type="search"
            placeholder="Buscar armações, marcas, lentes…"
            className="campo rounded-r-none"
          />
          <button type="submit" className="btn btn-primario rounded-l-none px-4" aria-label="Buscar">
            <IconSearch className="w-5 h-5" />
          </button>
        </form>

        <nav aria-label="Conta e carrinho" className="ml-auto flex items-center gap-1">
          <Link href={customer ? "/conta" : "/conta/entrar"} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gelo min-h-11">
            <IconUser className="w-6 h-6" />
            <span className="hidden lg:inline">{customer ? `Olá, ${customer.name.split(" ")[0]}` : "Entrar"}</span>
          </Link>
          <Link href="/carrinho" className="relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gelo min-h-11">
            <IconBag className="w-6 h-6" />
            <span className="hidden lg:inline">Carrinho</span>
            <span className="sr-only">, {count} {count === 1 ? "item" : "itens"}</span>
            {count > 0 && (
              <span aria-hidden className="absolute -top-0.5 left-7 min-w-5 h-5 px-1 rounded-full bg-marca text-white text-xs grid place-items-center">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      <form action="/catalogo" role="search" className="md:hidden conteudo pb-3 flex">
        <label htmlFor="busca-movel" className="sr-only">
          Buscar produtos
        </label>
        <input id="busca-movel" name="q" type="search" placeholder="Buscar produtos" className="campo rounded-r-none" />
        <button type="submit" className="btn btn-primario rounded-l-none px-4" aria-label="Buscar">
          <IconSearch className="w-5 h-5" />
        </button>
      </form>

      <nav aria-label="Categorias" className="hidden md:block border-t border-contorno">
        <ul className="conteudo flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="block px-3 py-3 text-[0.97rem] hover:text-marca hover:underline underline-offset-4 whitespace-nowrap">
                {n.label}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link href="/sobre" className="block px-3 py-3 text-[0.97rem] hover:underline underline-offset-4 whitespace-nowrap">
              A loja em Suzano
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
