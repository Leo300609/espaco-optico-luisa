import type { Metadata } from "next";
import { STORE, fullAddress, whatsappLink } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Fale conosco",
  description: `Fale com o ${STORE.name} em Suzano: telefone ${STORE.phone}, WhatsApp ${STORE.whatsapp} ou formulário.`,
  alternates: { canonical: "/contato" },
};

export default function ContatoPage() {
  return (
    <div className="conteudo py-10 grid md:grid-cols-[1fr_340px] gap-10 items-start">
      <div>
        <h1 className="text-4xl md:text-5xl">Fale conosco</h1>
        <p className="mt-2 text-suave">Respondemos em até 1 dia útil. Para assuntos urgentes, chame no WhatsApp.</p>
        <ContactForm />
      </div>
      <aside className="cartao p-6 space-y-3" aria-label="Outros canais">
        <h2 className="text-2xl">Outros canais</h2>
        <p>Telefone: <a href={STORE.phoneHref} className="underline">{STORE.phone}</a></p>
        <p>WhatsApp: <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="underline">{STORE.whatsapp}<span className="sr-only"> (abre em nova aba)</span></a></p>
        <p>Endereço: {fullAddress()}</p>
        <ul>{STORE.hours.map((h) => <li key={h.days}>{h.days}: {h.time}</li>)}</ul>
      </aside>
    </div>
  );
}
