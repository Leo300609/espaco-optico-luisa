import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/session";
import { AuthForms } from "./AuthForms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ voltar?: string; cadastro?: string }> }) {
  if (await getCustomer()) redirect("/conta");
  const sp = await searchParams;
  return (
    <div className="conteudo py-10 max-w-4xl">
      <h1 className="text-4xl">{sp.cadastro ? "Criar conta" : "Entrar"}</h1>
      <p className="text-suave mt-1">
        Não é obrigatório ter conta para comprar. Com ela, você acompanha pedidos e receitas em um só lugar.{" "}
        <Link href="/checkout" className="underline">Comprar como visitante</Link>
      </p>
      <AuthForms voltar={sp.voltar ?? "/conta"} startWithSignUp={!!sp.cadastro} />
    </div>
  );
}
