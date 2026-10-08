"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { todayInSaoPaulo } from "@/lib/format";

/**
 * "Hoje" (`YYYY-MM-DD`, fuso de São Paulo) compartilhado por datas relativas (FR-029, R-08).
 * O valor inicial vem do servidor (sem divergência de hidratação); ao voltar à aba, recalcula,
 * para um app aberto de madrugada não mostrar "Hoje" errado. `fixed` desliga o recálculo
 * (catálogo: data-model §8).
 */
const TodayContext = createContext<string | null>(null);

export function TodayProvider({
  today,
  fixed = false,
  children,
}: {
  today: string;
  fixed?: boolean;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(today);

  useEffect(() => {
    if (fixed) return;
    const refresh = () => {
      if (document.visibilityState === "visible") setCurrent(todayInSaoPaulo());
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [fixed]);

  return <TodayContext.Provider value={fixed ? today : current}>{children}</TodayContext.Provider>;
}

/** Data de hoje no fuso de São Paulo, vinda do `TodayProvider` mais próximo. */
export function useToday(): string {
  return useContext(TodayContext) ?? todayInSaoPaulo();
}
