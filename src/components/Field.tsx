/** Campo de formulário acessível: rótulo visível, ajuda e erro ligados ao campo. */
export function Field({
  id, label, error, help, className = "", ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; help?: string }) {
  const describedBy = [help ? `${id}-ajuda` : null, error ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="rotulo">
        {label}
        {props.required && <span aria-hidden className="text-promo"> *</span>}
      </label>
      <input id={id} name={props.name ?? id} className="campo" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {help && <p id={`${id}-ajuda`} className="ajuda">{help}</p>}
      {error && <p id={`${id}-erro`} className="erro">{error}</p>}
    </div>
  );
}
