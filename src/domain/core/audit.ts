import type {
  Account,
  AuditAction,
  AuditEntityType,
  Category,
  ImportBatch,
  Institution,
  Transaction,
} from "./types";

/**
 * Auditoria em TS (espelho de `core_audit()` — data-model §2.7) usada pela implementação em
 * memória. Linhas "achatadas" com as colunas do banco em camelCase; `changes` só com as colunas
 * alteradas (exceto técnicas). Mesmo formato que o repositório Supabase devolve.
 */

export type FlatRow = Record<string, unknown>;
export type Changes = Record<string, { old: unknown; new: unknown }>;

const SKIP = new Set(["updatedAt", "nameKey", "fpOccurrences", "createdAt"]);
const SKIP_ON_CREATE = new Set([...SKIP, "id", "ownerId"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffRows(oldRow: FlatRow | null, newRow: FlatRow): Changes {
  const changes: Changes = {};
  for (const [key, value] of Object.entries(newRow)) {
    if (oldRow === null) {
      if (SKIP_ON_CREATE.has(key) || value === null || value === undefined) continue;
      changes[key] = { old: null, new: value };
    } else if (!SKIP.has(key) && !same(oldRow[key] ?? null, value ?? null)) {
      changes[key] = { old: oldRow[key] ?? null, new: value ?? null };
    }
  }
  return changes;
}

/** Ação derivada das colunas de estado (mesma precedência do trigger). */
export function deriveAction(
  entity: AuditEntityType,
  oldRow: FlatRow | null,
  newRow: FlatRow,
  changes: Changes,
  hint?: string,
): AuditAction {
  if (oldRow === null) return "create";
  if ("deletedAt" in changes) {
    if (oldRow.deletedAt === null || oldRow.deletedAt === undefined) {
      return newRow.deletedReason === "merged" ? "merge" : "soft_delete";
    }
    return "restore";
  }
  if ("archivedAt" in changes) return oldRow.archivedAt == null ? "archive" : "unarchive";
  if (entity === "import_batch" && newRow.status === "undone") return "undo_batch";
  if (hint === "reassign" || hint === "unlock" || hint === "lock") return hint;
  return "update";
}

export function deriveReason(
  entity: AuditEntityType,
  action: AuditAction,
  newRow: FlatRow,
  explicit?: string,
): string | null {
  if (explicit) return explicit;
  if (action === "soft_delete" || action === "merge") {
    return entity === "transaction" ? ((newRow.deletedReason as string | null) ?? null) : "user";
  }
  return null;
}

// ---- Achatamento por entidade (colunas do banco em camelCase) -------------------------------

export function flatTransaction(tx: Transaction): FlatRow {
  const { installment, original, ...rest } = tx;
  return {
    ...rest,
    installmentNumber: installment?.number ?? null,
    installmentTotal: installment?.total ?? null,
    installmentGroup: installment?.group ?? null,
    originalAmountMinor: original?.amountMinor ?? null,
    originalCurrency: original?.currency ?? null,
  };
}

export function flatBatch(batch: ImportBatch): FlatRow {
  const { counts, ...rest } = batch;
  return {
    ...rest,
    countRead: counts.read,
    countCreated: counts.created,
    countUpdated: counts.updated,
    countRestored: counts.restored,
    countDuplicate: counts.duplicate,
    countProtected: counts.protected,
    countRejected: counts.rejected,
  };
}

export const flatAccount = (account: Account): FlatRow => ({ ...account });
export const flatCategory = (category: Category): FlatRow => ({ ...category });
export const flatInstitution = (institution: Institution): FlatRow => ({ ...institution });
