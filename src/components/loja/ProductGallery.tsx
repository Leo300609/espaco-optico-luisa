"use client";

import { useState } from "react";

/** Galeria acessível: miniaturas são botões, setas do teclado trocam a foto, zoom ao clicar. */
export function ProductGallery({ images }: { images: { url: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = images[index];
  if (!current) return <div className="aspect-square bg-gelo rounded-[14px] grid place-items-center text-suave">Sem foto</div>;

  const go = (i: number) => setIndex((i + images.length) % images.length);

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <button
        type="button"
        onClick={() => setZoom((z) => !z)}
        className="relative block w-full aspect-square bg-gelo rounded-[14px] overflow-hidden cursor-zoom-in"
        aria-label={zoom ? "Diminuir zoom da foto" : "Ampliar foto"}
      >
        <img
          src={current.url}
          alt={current.alt}
          className={`w-full h-full object-contain p-6 transition-transform duration-200 ${zoom ? "scale-[1.8]" : ""}`}
        />
      </button>
      <p className="sr-only" aria-live="polite">
        Foto {index + 1} de {images.length}: {current.alt}
      </p>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Fotos do produto">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setZoom(false);
                }}
                aria-current={i === index}
                aria-label={`Ver foto ${i + 1}`}
                className={`w-20 h-20 rounded-lg bg-gelo border-2 overflow-hidden ${i === index ? "border-marca" : "border-transparent"}`}
              >
                <img src={img.url} alt="" className="w-full h-full object-contain p-1.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
