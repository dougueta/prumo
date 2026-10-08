"use client";

import { useEffect, useRef, useState } from "react";

const MARK = "__prumoDialog";

/**
 * Gesto/botão de voltar fecha o diálogo (FR-024, research R-09): ao abrir, empilha uma entrada
 * no histórico; `popstate` fecha. Fechado por Esc/botão, remove a entrada empilhada.
 */
export function useBackToClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let closedByBack = false;
    window.history.pushState({ ...window.history.state, [MARK]: true }, "");
    const onPop = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByBack && window.history.state?.[MARK]) window.history.back();
    };
  }, [open]);
}

/**
 * Elemento que tinha o foco quando o diálogo abriu (lido na renderização da abertura, antes de o
 * Radix mover o foco para dentro). Diálogos controlados devolvem o foco a ele ao fechar (FR-024).
 */
export function useOpener(open: boolean): HTMLElement | null {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  // Ajuste de estado durante a renderização (padrão do React para "derivar da prop anterior").
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && typeof document !== "undefined") {
      const active = document.activeElement;
      setOpener(active instanceof HTMLElement ? active : null);
    }
  }
  return opener;
}
