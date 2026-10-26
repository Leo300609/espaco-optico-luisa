"use client";

export function PrintButton({ label = "Imprimir ordem de serviço" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-secundario btn-pequeno print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
