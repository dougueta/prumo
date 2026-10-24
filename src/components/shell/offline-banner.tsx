"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "./use-online";

/** Aviso de "offline" no shell; some sozinho ao reconectar (FR-014). */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p className="flex items-center gap-2 bg-warning-subtle px-4 py-2 text-sm text-warning">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          Você está offline. Algumas ações não vão funcionar até a conexão voltar.
        </p>
      )}
    </div>
  );
}
