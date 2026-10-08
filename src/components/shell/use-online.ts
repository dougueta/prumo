"use client";

import { useSyncExternalStore } from "react";

/**
 * Conexão do aparelho (`navigator.onLine` + eventos online/offline) — research R-09.
 * No servidor assume online (o aviso só aparece depois da hidratação).
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
