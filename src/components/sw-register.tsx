"use client";

import { useEffect } from "react";

/** Registra o service worker (FR-020). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sem service worker o app funciona normalmente; só perde a página offline.
      });
    }
  }, []);
  return null;
}
