"use client";

import { useEffect, useState } from "react";
import { readChoice, saveChoice } from "@/components/loja/CookieBanner";

export function CookiePreferences() {
  const [stats, setStats] = useState(false);
  const [mkt, setMkt] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const c = readChoice();
    if (c) {
      setStats(c.estatisticas);
      setMkt(c.marketing);
    }
  }, []);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        saveChoice(stats, mkt);
        setSaved(true);
      }}
    >
      <div className="cartao p-4">
        <p className="font-semibold">Essenciais (sempre ativos)</p>
        <p className="text-suave">Carrinho, login, segurança e esta própria escolha. Sem eles o site não funciona.</p>
      </div>
      <label className="cartao p-4 flex gap-3 items-start cursor-pointer">
        <input type="checkbox" checked={stats} onChange={(e) => setStats(e.target.checked)} className="w-5 h-5 mt-1 accent-marca" />
        <span><span className="font-semibold block">Estatísticas</span><span className="text-suave">Contagem anônima de visitas para melhorar o site.</span></span>
      </label>
      <label className="cartao p-4 flex gap-3 items-start cursor-pointer">
        <input type="checkbox" checked={mkt} onChange={(e) => setMkt(e.target.checked)} className="w-5 h-5 mt-1 accent-marca" />
        <span><span className="font-semibold block">Marketing</span><span className="text-suave">Anúncios e campanhas mais relevantes. Hoje não usamos, mas guardamos sua escolha.</span></span>
      </label>
      <button className="btn btn-primario">Salvar preferências</button>
      <p role="status" className="text-sucesso">{saved ? "Preferências salvas." : ""}</p>
    </form>
  );
}
