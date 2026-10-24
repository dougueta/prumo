import { expect } from "vitest";
import type {
  Account,
  AccountInput,
  Actor,
  CoreStore,
  ImportBatch,
  IncomingTx,
  NewBatch,
} from "@/data/core";

/** Utilitários da bateria de contrato (dados 100% sintéticos). */

export type StorePair = { store: CoreStore; other: CoreStore };

export const CATALOG_OTHER = "00000000-0000-4000-a000-000000000999";
export const MISSING_ID = "6f1c1f0e-0d51-4a43-9a0c-4c4a3a4b7d10";

export const USER: Actor = { type: "user" };
export const SYNC: Actor = { type: "sync", ref: "teste" };
export const IMPORT: Actor = { type: "import" };
export const AI: Actor = { type: "ai", ref: "modelo-ficticio" };
export const RULE: Actor = { type: "rule", ref: "regra-1" };

export function manualAccount(
  store: CoreStore,
  over: Partial<AccountInput> = {},
): Promise<Account> {
  return store.accounts.upsert(
    {
      institutionId: CATALOG_OTHER,
      name: "Conta Aurora (simulada)",
      type: "checking",
      source: "manual",
      ...over,
    } as AccountInput,
    USER,
  );
}

export function newBatch(
  store: CoreStore,
  source: NewBatch["source"] = "csv",
  over: Partial<NewBatch> = {},
): Promise<ImportBatch> {
  return store.batches.create({ source, initiatedBy: "user", ...over }, USER);
}

export function incoming(accountId: string, over: Partial<IncomingTx> = {}): IncomingTx {
  return {
    accountId,
    source: "csv",
    amountCents: -800,
    bookedOn: "2026-09-12",
    descriptionOriginal: "CAFE FICTICIO",
    status: "posted",
    ...over,
  } as IncomingTx;
}

export async function expectCoreError(
  promise: Promise<unknown>,
  code: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "CoreError", code, ...extra });
}

/** Grava `rows` num lote novo concluído e devolve o resultado do upsert. */
export async function importRows(
  store: CoreStore,
  rows: IncomingTx[],
  source: NewBatch["source"] = rows[0]?.source ?? "csv",
  actor: Actor = IMPORT,
) {
  const batch = await newBatch(store, source);
  const result = await store.transactions.upsertMany(batch.id, rows, actor);
  await store.batches.finish(batch.id, "completed", actor);
  return { batch, result };
}

export async function countActive(store: CoreStore): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  do {
    const page = await store.transactions.list({ limit: 200, cursor });
    total += page.items.length;
    cursor = page.nextCursor;
  } while (cursor);
  return total;
}
