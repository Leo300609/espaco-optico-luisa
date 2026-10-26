"use client";

import { useEffect, useRef } from "react";

/**
 * Envia o formulário de filtros automaticamente quando um campo muda.
 * Sem JavaScript, o formulário continua funcionando pelo botão "Aplicar filtros".
 */
export function AutoSubmit({ formId }: { formId: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type === "number" || t.type === "search") return; // números e busca: só ao confirmar
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => form.requestSubmit(), 150);
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formId]);
  return null;
}
