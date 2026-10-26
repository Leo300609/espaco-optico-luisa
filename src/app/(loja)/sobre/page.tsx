import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { STORE, fullAddress, whatsappLink } from "@/lib/site";
import { IconClock, IconPhone, IconPin, IconWhats } from "@/components/icons";
import { appUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Ótica em Suzano — conheça a loja",
  description: `Visite o ${STORE.name}, ótica em Suzano/SP. Endereço, horário de funcionamento, telefone, WhatsApp e serviços.`,
  alternates: { canonical: "/sobre" },
};

export default async function SobrePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const siteUrl = appUrl();
  const a = STORE.address;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Optician",
    name: STORE.name,
    image: `${siteUrl}/logo.jpg`,
    url: siteUrl,
    telephone: "+55-11-4759-3608",
    address: { "@type": "PostalAddress", streetAddress: a.street, addressLocality: a.city, addressRegion: a.state, postalCode: a.cep, addressCountry: "BR" },
    areaServed: ["Suzano", "Poá", "Ferraz de Vasconcelos", "Itaquaquecetuba", "Mogi das Cruzes"],
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
    ],
  };

  return (
    <div className="conteudo py-10">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid md:grid-cols-[1fr_320px] gap-10 items-start">
        <div>
          <p className="font-script text-4xl text-marca">Nossa história</p>
          <h1 className="text-4xl md:text-5xl mt-1">Uma ótica de família, no coração de Suzano</h1>
          <div className="texto-longo mt-5 text-lg">
            <p>
              O Espaço Óptico Luísa nasceu do desejo de cuidar da visão das pessoas com atenção de verdade: ouvir, explicar
              com calma e só indicar o que faz sentido para cada cliente. {/* Texto provisório: substituir pela história real da ótica. */}
            </p>
            <p>
              Aqui você encontra armações para todas as idades, óculos de sol com proteção UV, lentes de contato e lentes de
              grau das principais tecnologias, com montagem cuidadosa e ajustes feitos na hora.
            </p>
            <p>
              Agora, além da loja física, você também pode comprar pelo site e retirar aqui, sem custo, ou receber em casa
              em Suzano e região.
            </p>
            <h2>O que você encontra na loja</h2>
            <ul>
              <li>Ajuste e limpeza de óculos</li>
              <li>Montagem de lentes de grau com conferência da receita</li>
              <li>Atendimento para escolher a armação ideal para o seu rosto</li>
              <li>Orientação sobre lentes de contato e cuidados</li>
            </ul>
            <p className="font-script text-4xl text-marca">{STORE.motto}</p>
          </div>
        </div>

        <aside className="cartao p-6 space-y-4" aria-label="Contato e endereço">
          <Image src="/logo.jpg" alt={`Logo ${STORE.name}`} width={200} height={200} className="rounded-full mx-auto" />
          <p className="flex gap-2"><IconPin className="w-5 h-5 mt-1 shrink-0" />{fullAddress()}</p>
          <p className="flex gap-2"><IconPhone className="w-5 h-5 mt-1 shrink-0" /><a href={STORE.phoneHref} className="underline">{STORE.phone}</a></p>
          <ul className="space-y-1">
            {STORE.hours.map((h) => (
              <li key={h.days} className="flex gap-2"><IconClock className="w-5 h-5 mt-0.5 shrink-0" />{h.days}: {h.time}</li>
            ))}
          </ul>
          <a href={whatsappLink("Olá! Gostaria de visitar a loja.")} target="_blank" rel="noopener noreferrer" className="btn btn-primario w-full">
            <IconWhats className="w-5 h-5" /> Chamar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${STORE.name} ${fullAddress()}`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secundario w-full">
            Como chegar (Google Maps)<span className="sr-only"> (abre em nova aba)</span>
          </a>
        </aside>
      </div>
    </div>
  );
}
