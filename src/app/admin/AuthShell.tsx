import Image from "next/image";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="conteudo" className="min-h-screen bg-gelo grid place-items-center p-4">
      <div className="cartao w-full max-w-md p-7">
        <div className="flex items-center gap-3 mb-5">
          <Image src="/logo.png" alt="" width={52} height={52} className="rounded-full" />
          <p className="leading-tight">
            <span className="block font-serif text-lg text-marca-escuro">Espaço Óptico Luísa</span>
            <span className="block text-sm text-suave">Painel administrativo</span>
          </p>
        </div>
        <h1 className="text-3xl">{title}</h1>
        {children}
      </div>
    </main>
  );
}
