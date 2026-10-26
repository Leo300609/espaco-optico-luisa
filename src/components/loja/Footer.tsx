import Link from "next/link";
import Image from "next/image";
import { STORE, fullAddress, whatsappLink } from "@/lib/site";
import { IconCard, IconClock, IconPhone, IconPin, IconPix, IconShield, IconWhats } from "../icons";

export function Footer() {
  return (
    <footer className="bg-marca text-white mt-16 sobre-escuro">
      <div className="conteudo py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="" width={64} height={64} className="rounded-full ring-1 ring-white/30" />
            <p className="leading-none">
              <span className="block font-serif text-lg">Espaço Óptico</span>
              <span className="block font-script text-4xl text-champanhe">Luísa</span>
            </p>
          </div>
          <p className="mt-4 text-white/85">{STORE.tagline}.</p>
          <p className="mt-3 font-script text-2xl text-champanhe">{STORE.motto}</p>
        </div>

        <div>
          <h2 className="font-serif text-xl text-white mb-3">Atendimento</h2>
          <ul className="space-y-2.5 text-white/90">
            <li className="flex gap-2">
              <IconPhone className="w-5 h-5 shrink-0 mt-0.5" />
              <a href={STORE.phoneHref} className="hover:underline">{STORE.phone}</a>
            </li>
            <li className="flex gap-2">
              <IconWhats className="w-5 h-5 shrink-0 mt-0.5" />
              <a href={whatsappLink("Olá! Vim pelo site da ótica.")} className="hover:underline" target="_blank" rel="noopener noreferrer">
                WhatsApp {STORE.whatsapp}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>
            <li className="flex gap-2">
              <IconPin className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{fullAddress()}</span>
            </li>
            {STORE.hours.map((h) => (
              <li key={h.days} className="flex gap-2">
                <IconClock className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{h.days}: {h.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Institucional">
          <h2 className="font-serif text-xl text-white mb-3">Informações</h2>
          <ul className="space-y-2 text-white/90">
            <li><Link className="hover:underline" href="/sobre">A loja em Suzano</Link></li>
            <li><Link className="hover:underline" href="/contato">Fale conosco</Link></li>
            <li><Link className="hover:underline" href="/paginas/entrega-e-retirada">Entrega e retirada</Link></li>
            <li><Link className="hover:underline" href="/paginas/trocas-e-devolucoes">Trocas e devoluções</Link></li>
            <li><Link className="hover:underline" href="/paginas/perguntas-frequentes">Perguntas frequentes</Link></li>
            <li><Link className="hover:underline" href="/paginas/como-ler-sua-receita">Como ler sua receita</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-serif text-xl text-white mb-3">Compra segura</h2>
          <ul className="space-y-2 text-white/90">
            <li className="flex gap-2"><IconPix className="w-5 h-5" /> Pix</li>
            <li className="flex gap-2"><IconCard className="w-5 h-5" /> Cartão de crédito em até 6x</li>
            <li className="flex gap-2"><IconShield className="w-5 h-5" /> Conexão segura e dados protegidos (LGPD)</li>
          </ul>
          <nav aria-label="Documentos legais" className="mt-5">
            <ul className="space-y-2 text-white/90 text-[0.95rem]">
              <li><Link className="hover:underline" href="/paginas/termos-de-uso">Termos de uso</Link></li>
              <li><Link className="hover:underline" href="/paginas/politica-de-privacidade">Política de privacidade</Link></li>
              <li><Link className="hover:underline" href="/paginas/politica-de-cookies">Política de cookies</Link></li>
              <li><Link className="hover:underline" href="/cookies">Preferências de cookies</Link></li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="conteudo py-5 text-sm text-white/80">
          © {new Date().getFullYear()} {STORE.name} · {STORE.legal.companyName} · CNPJ {STORE.legal.cnpj} · Suzano/SP
        </p>
      </div>
    </footer>
  );
}
