import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="conteudo py-20 text-center">
      <p className="font-script text-5xl text-marca">Ops!</p>
      <h1 className="text-4xl mt-2">Página não encontrada</h1>
      <p className="mt-3 text-suave">O endereço pode ter mudado ou o produto saiu do catálogo.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="btn btn-primario">Ir para o início</Link>
        <Link href="/catalogo" className="btn btn-secundario">Ver catálogo</Link>
      </div>
    </main>
  );
}
