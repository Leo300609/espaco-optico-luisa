import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { AuthShell } from "../AuthShell";
import { TwoFactorForm } from "./TwoFactorForm";

export const metadata: Metadata = { title: "Painel — verificação", robots: { index: false, follow: false } };

export default async function TwoFactorPage() {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  if (!s.user.totpEnabled) redirect("/admin/2fa/configurar");
  if (s.mfaVerified) redirect("/admin");
  return (
    <AuthShell title="Verificação em duas etapas">
      <p className="text-suave mt-1">Digite o código de 6 números do aplicativo autenticador no seu celular.</p>
      <TwoFactorForm />
    </AuthShell>
  );
}
