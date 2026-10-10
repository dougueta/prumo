import { createHash } from "node:crypto";
import { normalizeDescription } from "./text";
import type { Cents, IsoDate, Uuid } from "./types";

/**
 * Identidade determinística da transação (R-06, FR-021/FR-022). TS normaliza e calcula a base;
 * a ocorrência é contada no lote inteiro (banco: import_batches.fp_occurrences; memória: idem).
 */

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function fingerprintBase(row: {
  accountId: Uuid;
  bookedOn: IsoDate;
  amountCents: Cents;
  descriptionOriginal: string;
}): string {
  return sha256(
    [
      row.accountId,
      row.bookedOn,
      String(row.amountCents),
      normalizeDescription(row.descriptionOriginal),
    ].join("|"),
  );
}

/** Igual a `core_fp_identity(base, k)` em SQL. */
export function fpIdentity(base: string, occurrence: number): string {
  return `fp:${sha256(`${base}|${occurrence}`)}`;
}

export const extIdentity = (externalId: string) => `ext:${externalId}`;
export const manualIdentity = (id: Uuid) => `man:${id}`;

/** Contador de ocorrências por base no lote (continua entre chamadas a partir do snapshot). */
export class OccurrenceCounter {
  private readonly counts: Record<string, number>;

  constructor(initial: Record<string, number> = {}) {
    this.counts = { ...initial };
  }

  next(base: string): number {
    const k = (this.counts[base] ?? 0) + 1;
    this.counts[base] = k;
    return k;
  }

  snapshot(): Record<string, number> {
    return { ...this.counts };
  }
}
