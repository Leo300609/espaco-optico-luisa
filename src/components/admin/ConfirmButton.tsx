"use client";

/** Pede confirmação antes de enviar o formulário em ações irreversíveis (excluir, cancelar, reembolsar). */
export function ConfirmButton({
  children, message, className = "btn btn-perigo btn-pequeno", name, value,
}: { children: React.ReactNode; message: string; className?: string; name?: string; value?: string }) {
  return (
    <button
      className={className}
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
