import { describe, expect, it } from "vitest";
import {
  assertBatchTransition,
  assertBatchWritable,
  assertTxStatusTransition,
  canTransitionBatch,
} from "@/domain/core/state";
import type { BatchStatus } from "@/domain/core/types";

// 004 · T021 — máquina de estados do lote (data-model §2.4; FR-033).
const ALL: BatchStatus[] = ["processing", "in_review", "completed", "failed", "undone"];
const ALLOWED = new Set([
  "processing>in_review",
  "processing>completed",
  "processing>failed",
  "in_review>processing",
  "in_review>failed",
  "completed>undone",
  "failed>undone",
]);

describe("transições de lote", () => {
  for (const from of ALL) {
    for (const to of ALL) {
      if (from === to) continue;
      const allowed = ALLOWED.has(`${from}>${to}`);
      it(`${from} → ${to} ${allowed ? "permitida" : "proibida"}`, () => {
        expect(canTransitionBatch(from, to)).toBe(allowed);
        if (allowed) expect(() => assertBatchTransition(from, to)).not.toThrow();
        else
          expect(() => assertBatchTransition(from, to)).toThrow(
            expect.objectContaining({ code: "forbidden_operation", reason: "batch_state" }),
          );
      });
    }
  }

  it("gravação de transações só em processing", () => {
    expect(() => assertBatchWritable("processing")).not.toThrow();
    for (const status of ["in_review", "completed", "failed", "undone"] as const) {
      expect(() => assertBatchWritable(status)).toThrow(
        expect.objectContaining({ reason: "batch_closed" }),
      );
    }
  });
});

describe("status da transação", () => {
  it("pending → posted permitido; posted → pending proibido", () => {
    expect(() => assertTxStatusTransition("pending", "posted")).not.toThrow();
    expect(() => assertTxStatusTransition("posted", "posted")).not.toThrow();
    expect(() => assertTxStatusTransition("posted", "pending")).toThrow(
      expect.objectContaining({ reason: "status_regression" }),
    );
  });
});
