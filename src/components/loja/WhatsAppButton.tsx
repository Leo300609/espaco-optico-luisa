import { whatsappLink } from "@/lib/site";
import { IconWhats } from "../icons";

export function WhatsAppButton({ message = "Olá! Vim pelo site e gostaria de tirar uma dúvida." }: { message?: string }) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-[#1f7a4d] text-white shadow-lg px-4 min-h-14 hover:bg-[#17603c]"
    >
      <IconWhats className="w-7 h-7" />
      <span className="font-semibold">WhatsApp</span>
      <span className="sr-only"> — falar com a ótica (abre em nova aba)</span>
    </a>
  );
}
