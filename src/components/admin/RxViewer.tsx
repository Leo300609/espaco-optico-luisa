"use client";

import { useState } from "react";

/** Visualizador da receita com zoom e rotação (teclado e mouse). PDFs abrem em nova aba. */
export function RxViewer({ files }: { files: { url: string; isPdf: boolean }[] }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const f = files[i]!;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {files.length > 1 && files.map((_, n) => (
          <button key={n} type="button" className={`btn btn-pequeno ${n === i ? "btn-primario" : "btn-secundario"}`} onClick={() => { setI(n); setZoom(1); setRot(0); }}>
            Arquivo {n + 1}
          </button>
        ))}
        {!f.isPdf && (
          <>
            <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>Aproximar</button>
            <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>Afastar</button>
            <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setRot((r) => (r + 90) % 360)}>Girar 90°</button>
          </>
        )}
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-secundario btn-pequeno">Abrir em nova aba</a>
      </div>
      {f.isPdf ? (
        <p className="cartao bg-gelo p-6 text-center">Arquivo em PDF. Use &quot;Abrir em nova aba&quot; para ver.</p>
      ) : (
        <div className="overflow-auto max-h-[70vh] bg-gelo rounded-lg border border-contorno">
          <img
            src={f.url}
            alt={`Receita enviada pelo cliente, arquivo ${i + 1}`}
            style={{ transform: `rotate(${rot}deg) scale(${zoom})`, transformOrigin: "top left", width: zoom > 1 ? `${100 * zoom}%` : "100%" }}
            className="max-w-none"
          />
        </div>
      )}
      <p className="ajuda mt-2">O arquivo é descriptografado só para esta visualização e não fica salvo no computador.</p>
    </div>
  );
}
