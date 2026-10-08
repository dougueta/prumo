"use client";

import { useEffect, useRef } from "react";

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
