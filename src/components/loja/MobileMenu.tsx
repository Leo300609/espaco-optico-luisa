"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconMenu } from "../icons";

/** Menu recolhido para celular, com foco preso enquanto aberto e Esc para fechar. */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === "Tab" && panel) {
        const els = panel.querySelectorAll<HTMLElement>("a,button");
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="p-2 rounded-lg hover:bg-gelo min-h-11 min-w-11 grid place-items-center"
        aria-expanded={open}
        aria-controls="menu-movel"
        onClick={() => setOpen(true)}
      >
        <IconMenu className="w-6 h-6" />
        <span className="sr-only">Abrir menu</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div ref={panelRef} id="menu-movel" className="absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white p-5 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-serif text-xl text-marca">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gelo min-h-11 min-w-11 grid place-items-center">
                <IconClose className="w-6 h-6" />
                <span className="sr-only">Fechar menu</span>
              </button>
            </div>
            <ul className="space-y-1">
              {[...items, { href: "/sobre", label: "A loja em Suzano" }, { href: "/contato", label: "Fale conosco" }, { href: "/conta", label: "Minha conta" }].map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} className="block px-3 py-3 rounded-lg hover:bg-gelo text-lg">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
