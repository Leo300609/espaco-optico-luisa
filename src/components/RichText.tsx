/**
 * Renderiza o texto das páginas institucionais (editadas no painel) SEM interpretar HTML:
 * linhas começando com "## " viram subtítulos, com "- " viram listas, o resto vira parágrafo.
 * Isso evita injeção de scripts por quem edita o conteúdo.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const b = block.trim();
        if (!b) return null;
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{l}</span>)}</p>;
      })}
    </div>
  );
}
