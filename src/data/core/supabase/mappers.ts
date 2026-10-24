import "server-only";
import type {
  Account,
  AuditEntry,
  Category,
  ImportBatch,
  Institution,
  LockableField,
  Transaction,
} from "@/domain/core/types";

/** Linha do banco (snake_case) ⇄ domínio (camelCase); cursores opacos. */

type Row = Record<string, unknown>;

const LOCKABLE_TO_DB: Record<LockableField, string> = {
  description: "description",
  merchant: "merchant",
  categoryId: "category_id",
  nature: "nature",
  relatedTransactionId: "related_transaction_id",
  notes: "notes",
  amountCents: "amount_cents",
  bookedOn: "booked_on",
  status: "status",
};
const LOCKABLE_FROM_DB = Object.fromEntries(
  Object.entries(LOCKABLE_TO_DB).map(([camel, snake]) => [snake, camel]),
) as Record<string, LockableField>;

export const lockableToDb = (field: LockableField): string => LOCKABLE_TO_DB[field];
export const lockableFromDb = (field: string): LockableField => LOCKABLE_FROM_DB[field];

export const snakeToCamel = (value: string) =>
  value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) =>
  v === null || v === undefined ? null : new Date(String(v)).toISOString();

export function toInstitution(r: Row): Institution {
  return {
    id: String(r.id),
    ownerId: str(r.owner_id),
    name: String(r.name),
    kind: r.kind as Institution["kind"],
    bankCode: str(r.bank_code),
    externalRef: str(r.external_ref),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toAccount(r: Row): Account {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    institutionId: String(r.institution_id),
    name: String(r.name),
    nickname: str(r.nickname),
    type: r.type as Account["type"],
    currency: "BRL",
    source: r.source as Account["source"],
    externalId: str(r.external_id),
    last4: str(r.last4),
    creditLimitCents: num(r.credit_limit_cents),
    closingDay: num(r.closing_day),
    dueDay: num(r.due_day),
    openingBalanceCents: Number(r.opening_balance_cents),
    openingBalanceOn: str(r.opening_balance_on),
    reportedBalanceCents: num(r.reported_balance_cents),
    reportedBalanceOn: str(r.reported_balance_on),
    archivedAt: iso(r.archived_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toTransaction(r: Row): Transaction {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    accountId: String(r.account_id),
    batchId: str(r.batch_id),
    source: r.source as Transaction["source"],
    externalId: str(r.external_id),
    identityKey: String(r.identity_key),
    amountCents: Number(r.amount_cents),
    bookedOn: String(r.booked_on),
    occurredAt: iso(r.occurred_at),
    descriptionOriginal: String(r.description_original),
    description: str(r.description),
    merchant: str(r.merchant),
    status: r.status as Transaction["status"],
    nature: r.nature as Transaction["nature"],
    relatedTransactionId: str(r.related_transaction_id),
    categoryId: str(r.category_id),
    categorySource: (r.category_source ?? null) as Transaction["categorySource"],
    categoryConfidence: num(r.category_confidence),
    notes: str(r.notes),
    installment:
      r.installment_number === null || r.installment_number === undefined
        ? null
        : {
            number: Number(r.installment_number),
            total: Number(r.installment_total),
            group: String(r.installment_group ?? ""),
          },
    original:
      r.original_currency === null || r.original_currency === undefined
        ? null
        : { currency: String(r.original_currency), amountMinor: Number(r.original_amount_minor) },
    lockedFields: ((r.locked_fields as string[] | null) ?? []).map(lockableFromDb),
    deletedAt: iso(r.deleted_at),
    deletedReason: (r.deleted_reason ?? null) as Transaction["deletedReason"],
    mergedIntoId: str(r.merged_into_id),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toCategory(r: Row): Category {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    parentId: str(r.parent_id),
    name: String(r.name),
    kind: r.kind as Category["kind"],
    origin: r.origin as Category["origin"],
    systemKey: (r.system_key ?? null) as Category["systemKey"],
    templateKey: str(r.template_key),
    hidden: Boolean(r.hidden),
    sortOrder: Number(r.sort_order),
    deletedAt: iso(r.deleted_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toBatch(r: Row): ImportBatch {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    source: r.source as ImportBatch["source"],
    accountId: str(r.account_id),
    initiatedBy: r.initiated_by as ImportBatch["initiatedBy"],
    fileName: str(r.file_name),
    fileSha256: str(r.file_sha256),
    periodStart: str(r.period_start),
    periodEnd: str(r.period_end),
    status: r.status as ImportBatch["status"],
    counts: {
      read: Number(r.count_read),
      created: Number(r.count_created),
      updated: Number(r.count_updated),
      restored: Number(r.count_restored),
      duplicate: Number(r.count_duplicate),
      protected: Number(r.count_protected),
      rejected: Number(r.count_rejected),
    },
    errorSummary: str(r.error_summary),
    startedAt: iso(r.started_at)!,
    finishedAt: iso(r.finished_at),
  };
}

/** Auditoria: chaves de `changes` em camelCase; `locked_fields` com nomes do domínio. */
export function toAuditEntry(r: Row): AuditEntry {
  const raw = (r.changes ?? {}) as Record<string, { old: unknown; new: unknown }>;
  const changes: AuditEntry["changes"] = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapLocks = (v: unknown) =>
      key === "locked_fields" && Array.isArray(v) ? v.map((f) => lockableFromDb(String(f))) : v;
    changes[snakeToCamel(key)] = { old: mapLocks(value.old), new: mapLocks(value.new) };
  }
  return {
    id: Number(r.id),
    entityType: r.entity_type as AuditEntry["entityType"],
    entityId: String(r.entity_id),
    action: r.action as AuditEntry["action"],
    actor: {
      type: r.actor_type as AuditEntry["actor"]["type"],
      ...(r.actor_ref ? { ref: String(r.actor_ref) } : {}),
      ...(r.batch_id ? { batchId: String(r.batch_id) } : {}),
    },
    reason: str(r.reason),
    changes,
    occurredAt: iso(r.occurred_at)!,
  };
}
