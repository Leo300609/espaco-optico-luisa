import type { Metadata } from "next";
import { AuthShell } from "../../AuthShell";
import { startTotpSetup } from "../../auth-actions";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Painel — ativar 2FA", robots: { index: false, follow: false } };

export default async function SetupTwoFactorPage() {
  const data = await startTotpSetup();
  return (
    <AuthShell title="Ative a verificação em duas etapas">
      <p className="text-suave mt-1">
        Obrigatória para todos da equipe. Instale um aplicativo autenticador (Google Authenticator, Microsoft
        Authenticator ou similar) e leia o QR Code.
      </p>
      <SetupForm {...data} />
    </AuthShell>
  );
}
