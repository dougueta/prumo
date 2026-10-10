import { diffRows, flatTransaction, type Changes } from "./audit";
import { forbidden, validation } from "./errors";
import type { Actor, CategorySource, LockableField, Transaction, TxPatch, Uuid } from "./types";
import { LOCKABLE_FIELDS } from "./types";

/**
 * Regras de campo e travas de transação (data-model §2.6, R-07, R-08; FR-020, FR-024–FR-026).
 * Espelho exato do trigger `core_transactions_guard` — a bateria de contrato prova a equivalência.
 */

/** Consultas que o guarda precisa fazer ao "banco" (memória) — sempre do mesmo dono. */
export type TxLookups = {
  uncategorizedId?: Uuid | null;
  systemCategoryId?: (key: "internal_transfer" | "card_payment") => Uuid | null;
  isAccountArchived?: (accountId: Uuid) => boolean;
  isTransactionDeleted?: (id: Uuid) => boolean;
  batch?: (id: Uuid) => { status: string; source: string } | undefined;
};

export type GuardContext = TxLookups & {
  actor: Actor;
  /** `prumo.action`: "reassign" (exclusão de categoria) ou "unlock" (voltar ao automático). */
  action?: string;
  /** `prumo.force_unlink`: contrapartida excluída — o vínculo é desfeito mesmo travado. */
  forceUnlink?: boolean;
};

type TxKey = keyof Transaction;

const FACTS: TxKey[] = [
  "amountCents",
  "bookedOn",
  "descriptionOriginal",
  "occurredAt",
  "accountId",
  "installment",
  "original",
  "status",
];
const SOURCE_UPDATABLE_WHEN_PENDING: TxKey[] = [
  "amountCents",
  "bookedOn",
  "descriptionOriginal",
  "occurredAt",
  "status",
];
const IMMUTABLE: TxKey[] = [
  "id",
  "ownerId",
  "source",
  "externalId",
  "identityKey",
  "batchId",
  "createdAt",
];
const DELETION: TxKey[] = ["deletedAt", "deletedReason", "mergedIntoId", "updatedAt"];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function sameExcept(a: Transaction, b: Transaction, keys: TxKey[]): boolean {
  const strip = (t: Transaction) => {
    const copy: Record<string, unknown> = { ...t };
    for (const key of keys) delete copy[key];
    return copy;
  };
  return same(strip(a), strip(b));
}

/** Origem da categoria atribuída por cada tipo de ator. */
export function categorySourceFor(actor: Actor): CategorySource {
  switch (actor.type) {
    case "user":
      return "manual";
    case "ai":
      return "ai";
    case "sync":
    case "import":
      return "source";
    default:
      return "rule";
  }
}

function normalizeUncategorized(tx: Transaction, ctx: TxLookups): Transaction {
  if (tx.categoryId && ctx.uncategorizedId && tx.categoryId === ctx.uncategorizedId) {
    return { ...tx, categoryId: null, categorySource: null, categoryConfidence: null };
  }
  return tx;
}

/** Regras comuns a INSERT e UPDATE: vínculo ativo e categoria de sistema da natureza. */
function finalize(old: Transaction | null, tx: Transaction, ctx: GuardContext): Transaction {
  let next = tx;
  if (
    next.relatedTransactionId &&
    (old === null || next.relatedTransactionId !== old.relatedTransactionId) &&
    ctx.isTransactionDeleted?.(next.relatedTransactionId)
  ) {
    throw validation("relatedTransactionId");
  }
  if (
    (next.nature === "internal_transfer" || next.nature === "card_payment") &&
    next.categorySource !== "manual" &&
    !next.lockedFields.includes("categoryId")
  ) {
    const sys = ctx.systemCategoryId?.(next.nature) ?? null;
    if (sys && next.categoryId !== sys) {
      next = { ...next, categoryId: sys, categorySource: "rule", categoryConfidence: null };
    }
  }
  return next;
}

/** Guarda de INSERT (data-model §2.6, FR-013–FR-018). Lança CoreError ou devolve a linha final. */
export function guardTransactionInsert(row: Transaction, ctx: GuardContext): Transaction {
  let next = normalizeUncategorized(row, ctx);
  if (ctx.isAccountArchived?.(next.accountId)) throw validation("accountId");
  if (next.batchId) {
    const batch = ctx.batch?.(next.batchId);
    if (batch) {
      if (batch.source !== next.source) throw validation("batchId");
      if (batch.status !== "processing") throw forbidden("batch_closed");
    }
  }
  if (next.deletedAt || next.deletedReason || next.mergedIntoId) throw validation("deletedAt");
  if (next.source !== "manual") next = { ...next, lockedFields: [] };
  if (next.categorySource === "manual") {
    next = {
      ...next,
      categoryConfidence: null,
      lockedFields: next.lockedFields.includes("categoryId")
        ? next.lockedFields
        : [...next.lockedFields, "categoryId"],
    };
  }
  return finalize(null, next, ctx);
}

/** Guarda de UPDATE (data-model §2.6, R-07/R-08). Lança CoreError ou devolve a linha final. */
export function guardTransactionUpdate(
  old: Transaction,
  proposed: Transaction,
  ctx: GuardContext,
): Transaction {
  let next: Transaction = normalizeUncategorized({ ...proposed }, ctx);
  const draft = next as Record<TxKey, unknown>;
  const prev = old as Record<TxKey, unknown>;

  for (const key of IMMUTABLE) {
    if (!same(draft[key], prev[key])) throw forbidden("imported_fact");
  }

  if (old.deletedAt) {
    if (!next.deletedAt) {
      if (
        old.deletedReason === "merged" &&
        old.mergedIntoId &&
        ctx.isTransactionDeleted?.(old.mergedIntoId)
      ) {
        throw forbidden("merged_survivor_deleted");
      }
      next = { ...next, deletedReason: null, mergedIntoId: null };
    }
    if (
      !sameExcept(next, old, DELETION) ||
      (next.deletedAt &&
        (next.deletedAt !== old.deletedAt ||
          next.deletedReason !== old.deletedReason ||
          next.mergedIntoId !== old.mergedIntoId))
    ) {
      throw forbidden("deleted");
    }
    return next;
  }
  if (next.deletedAt) {
    if (!sameExcept(next, old, DELETION)) throw forbidden("deleted");
    return next;
  }

  if (old.status === "posted" && next.status === "pending") throw forbidden("status_regression");

  const user = ctx.actor.type === "user";
  const feeder = ctx.actor.type === "sync" || ctx.actor.type === "import";
  const manual = old.source === "manual";
  let locked: LockableField[] = old.lockedFields;
  if (!same(next.lockedFields, old.lockedFields) && (user || ctx.action === "unlock")) {
    locked = next.lockedFields;
  }

  for (const key of FACTS) {
    if (same(draft[key], prev[key])) continue;
    if (manual) {
      if (key === "descriptionOriginal" || !user) {
        if (user) throw forbidden("imported_fact");
        draft[key] = prev[key];
      }
    } else if (
      feeder &&
      ((old.status === "pending" && SOURCE_UPDATABLE_WHEN_PENDING.includes(key)) ||
        (key === "occurredAt" && old.occurredAt === null))
    ) {
      // a própria fonte atualiza a pendente (US7)
    } else if (user) {
      throw forbidden("imported_fact");
    } else {
      draft[key] = prev[key];
    }
  }

  for (const field of LOCKABLE_FIELDS) {
    if (same(draft[field], prev[field])) continue;
    if (field === "categoryId" && ctx.action === "reassign") continue;
    if ((field === "relatedTransactionId" || field === "nature") && ctx.forceUnlink) continue;
    if (user) {
      if (!locked.includes(field)) locked = [...locked, field];
    } else if (locked.includes(field)) {
      draft[field] = prev[field];
      if (field === "categoryId") {
        draft.categorySource = old.categorySource;
        draft.categoryConfidence = old.categoryConfidence;
      }
    }
  }
  next = { ...next, lockedFields: locked };

  if (user && ctx.action !== "reassign" && next.categoryId !== old.categoryId) {
    next = { ...next, categorySource: next.categoryId ? "manual" : null, categoryConfidence: null };
  } else if (next.categoryId === null) {
    next = { ...next, categorySource: null, categoryConfidence: null };
  }

  if (next.accountId !== old.accountId && ctx.isAccountArchived?.(next.accountId)) {
    throw validation("accountId");
  }
  return finalize(old, next, ctx);
}

export type PatchResult = {
  next: Transaction;
  changes: Changes;
  protectedFields: LockableField[];
};

/** Constrói a proposta a partir do patch (como core_update_transaction) e aplica o guarda. */
export function applyPatch(
  existing: Transaction,
  patch: TxPatch,
  actor: Actor,
  lookups: TxLookups = {},
): PatchResult {
  if (existing.deletedAt) throw forbidden("deleted");
  const proposed: Transaction = { ...existing };
  const assign = <K extends keyof TxPatch & keyof Transaction>(key: K) => {
    if (key in patch) (proposed as Record<string, unknown>)[key] = patch[key] ?? null;
  };
  for (const key of [
    "description",
    "merchant",
    "notes",
    "nature",
    "relatedTransactionId",
    "amountCents",
    "bookedOn",
    "accountId",
    "status",
    "occurredAt",
    "installment",
    "original",
  ] as const) {
    assign(key);
  }
  if (patch.category) {
    const source = categorySourceFor(actor);
    const id = patch.category.id;
    proposed.categoryId = id;
    proposed.categorySource = id ? source : null;
    proposed.categoryConfidence =
      !id || source === "manual" ? null : (patch.category.confidence ?? null);
    if (actor.type === "user" && !proposed.lockedFields.includes("categoryId")) {
      proposed.lockedFields = [...proposed.lockedFields, "categoryId"];
    }
  }

  const next = guardTransactionUpdate(existing, proposed, { ...lookups, actor });
  const protectedFields =
    actor.type === "user"
      ? []
      : existing.lockedFields.filter(
          (field) => !same(proposed[field], existing[field]) && same(next[field], existing[field]),
        );
  return {
    next,
    changes: diffRows(flatTransaction(existing), flatTransaction(next)),
    protectedFields,
  };
}
