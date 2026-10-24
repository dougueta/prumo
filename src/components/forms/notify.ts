import { toast } from "sonner";
import { TOAST_DURATION_MS, runOnline, showOfflineAction } from "./run-online";

/**
 * Avisos temporários (FR-043): anunciados ao leitor de tela pelo Toaster único do root layout,
 * duram ≥ 5 s; com "Desfazer", ficam até serem dispensados (FR-042).
 */
export const notify = {
  success(message: string) {
    toast.success(message, { duration: TOAST_DURATION_MS });
  },
  error(message: string) {
    toast.error(message, { duration: TOAST_DURATION_MS });
  },
  info(message: string) {
    toast.info(message, { duration: TOAST_DURATION_MS });
  },
  /** Ação reversível: "{Objeto} excluído." + "Desfazer" (bloqueado sem conexão). */
  undo(message: string, onUndo: () => unknown | Promise<unknown>) {
    toast.message(message, {
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: { label: "Desfazer", onClick: () => runOnline(onUndo) },
    });
  },
  /** "Sem conexão: nada foi salvo…" */
  offlineAction() {
    showOfflineAction();
  },
};
