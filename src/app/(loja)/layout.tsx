import { Header } from "@/components/loja/Header";
import { Footer } from "@/components/loja/Footer";
import { WhatsAppButton } from "@/components/loja/WhatsAppButton";
import { CookieBanner } from "@/components/loja/CookieBanner";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="pular-conteudo">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <WhatsAppButton />
      <CookieBanner />
    </>
  );
}
