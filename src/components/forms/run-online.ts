import { toast } from "sonner";

/** Texto padrão (guia de escrita) para ação que precisava de conexão (data-model §6). */
export const OFFLINE_ACTION_TEXT =
  "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar.";

export const TOAST_DURATION_MS = 6_000;

export function showOfflineAction(): void {
  toast.error(OFFLINE_ACTION_TEXT, { duration: TOAST_DURATION_MS });
}

function isNetworkError(error: unknown): boolean {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))
  );
}

/**
 * Executa uma ação que exige conexão (edge case "offline durante ação"): sem rede, não chama a
 * ação e avisa que nada foi salvo; se a ação falhar por rede, idem. Devolve `true` se concluiu.
 * Erros que não são de rede seguem para quem chamou.
 */
export async function runOnline(action: () => unknown | Promise<unknown>): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    showOfflineAction();
    return false;
  }
  try {
    await action();
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      showOfflineAction();
      return false;
    }
    throw error;
  }
}
