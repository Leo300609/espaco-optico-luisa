import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Painel — entrar", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const s = await getAdminSession();
  if (s?.mfaVerified) redirect("/admin");
  return (
    <AuthShell title="Entrar no painel">
      <p className="text-suave mt-1">Acesso restrito à equipe da ótica. Cada pessoa usa o próprio login.</p>
      <LoginForm />
    </AuthShell>
  );
}
