import { forbidden } from "./errors";
import type { BatchStatus, TxStatus } from "./types";

/** Máquinas de estado (data-model §2.4 e §2.6) — espelho dos triggers do banco. */

const BATCH_TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  processing: ["in_review", "completed", "failed"],
  in_review: ["processing", "failed"],
  completed: ["undone"],
  failed: ["undone"],
  undone: [],
};

export function canTransitionBatch(from: BatchStatus, to: BatchStatus): boolean {
  return BATCH_TRANSITIONS[from].includes(to);
}

export function assertBatchTransition(from: BatchStatus, to: BatchStatus): void {
  if (!canTransitionBatch(from, to)) throw forbidden("batch_state");
}

/** Transações só são gravadas com o lote em processing (FR-033). */
export function assertBatchWritable(status: BatchStatus): void {
  if (status !== "processing") throw forbidden("batch_closed");
}

/** pending → posted permitido; posted → pending proibido. */
export function assertTxStatusTransition(from: TxStatus, to: TxStatus): void {
  if (from === "posted" && to === "pending") throw forbidden("status_regression");
}
