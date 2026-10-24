/**
 * Tipos do modelo de dados core (feature 004 — dona). Contrato:
 * specs/004-modelo-dados-core/contracts/core-store.md §Tipos e data-model.md §6.
 * Espelham as colunas do banco em camelCase.
 */
import type { CoreErrorCode } from "./errors";

/** Centavos inteiros com sinal (Number.isSafeInteger). Negativo = saída da conta. */
export type Cents = number;
/** "YYYY-MM-DD" de calendário real, 1900-01-01..2100-12-31 (America/Sao_Paulo). */
export type IsoDate = string;
/** UUID do dono (auth.users.id). */
export type OwnerId = string;
export type Uuid = string;

export const SOURCES = ["pluggy", "csv", "ofx", "pdf", "sheets", "manual"] as const;
export type Source = (typeof SOURCES)[number];
export const ACCOUNT_TYPES = [
  "checking",
  "digital_wallet",
  "credit_card",
  "savings",
  "investment",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const INSTITUTION_KINDS = [
  "bank",
  "digital_wallet",
  "card_issuer",
  "broker",
  "other",
] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];
export const TX_STATUSES = ["pending", "posted"] as const;
export type TxStatus = (typeof TX_STATUSES)[number];
export const TX_NATURES = ["regular", "internal_transfer", "card_payment", "refund"] as const;
export type TxNature = (typeof TX_NATURES)[number];
export const CATEGORY_SOURCES = ["manual", "rule", "ai", "source"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];
export const CATEGORY_KINDS = ["expense", "income", "neutral"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export type CategoryOrigin = "system" | "default" | "custom";
export const SYSTEM_CATEGORY_KEYS = [
  "uncategorized",
  "internal_transfer",
  "card_payment",
  "salary",
  "bank_fees",
] as const;
export type SystemCategoryKey = (typeof SYSTEM_CATEGORY_KEYS)[number];
export const DELETED_REASONS = ["user", "merged", "batch_undone", "canceled_at_source"] as const;
export type DeletedReason = (typeof DELETED_REASONS)[number];
export const BATCH_STATUSES = ["processing", "in_review", "completed", "failed", "undone"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export const BATCH_INITIATORS = ["user", "schedule", "webhook", "system"] as const;
export type BatchInitiator = (typeof BATCH_INITIATORS)[number];
export const LOCKABLE_FIELDS = [
  "description",
  "merchant",
  "categoryId",
  "nature",
  "relatedTransactionId",
  "notes",
  "amountCents",
  "bookedOn",
  "status",
] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];
export type AuditEntityType =
  "institution" | "account" | "transaction" | "category" | "import_batch";
export type AuditAction =
  | "create"
  | "update"
  | "soft_delete"
  | "restore"
  | "merge"
  | "archive"
  | "unarchive"
  | "undo_batch"
  | "reassign"
  | "lock"
  | "unlock";

export const ACTOR_TYPES = ["user", "sync", "import", "ai", "rule", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
export type Actor = { type: ActorType; ref?: string; batchId?: Uuid };

export type Page<T> = { items: T[]; nextCursor: string | null };

export type Institution = {
  id: Uuid;
  ownerId: OwnerId | null;
  name: string;
  kind: InstitutionKind;
  bankCode: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Account = {
  id: Uuid;
  ownerId: OwnerId;
  institutionId: Uuid;
  name: string;
  nickname: string | null;
  type: AccountType;
  currency: "BRL";
  source: "pluggy" | "manual";
  externalId: string | null;
  last4: string | null;
  creditLimitCents: Cents | null;
  closingDay: number | null;
  dueDay: number | null;
  openingBalanceCents: Cents;
  openingBalanceOn: IsoDate | null;
  reportedBalanceCents: Cents | null;
  reportedBalanceOn: IsoDate | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Installment = { number: number; total: number; group: string };
export type OriginalAmount = { currency: string; amountMinor: number };

export type Transaction = {
  id: Uuid;
  ownerId: OwnerId;
  accountId: Uuid;
  batchId: Uuid | null;
  source: Source;
  externalId: string | null;
  identityKey: string;
  amountCents: Cents;
  bookedOn: IsoDate;
  occurredAt: string | null;
  descriptionOriginal: string;
  description: string | null;
  merchant: string | null;
  status: TxStatus;
  nature: TxNature;
  relatedTransactionId: Uuid | null;
  /** null ⇔ "sem categoria" (única representação). */
  categoryId: Uuid | null;
  categorySource: CategorySource | null;
  categoryConfidence: number | null;
  notes: string | null;
  installment: Installment | null;
  original: OriginalAmount | null;
  lockedFields: LockableField[];
  deletedAt: string | null;
  deletedReason: DeletedReason | null;
  mergedIntoId: Uuid | null;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: Uuid;
  ownerId: OwnerId;
  parentId: Uuid | null;
  name: string;
  kind: CategoryKind;
  origin: CategoryOrigin;
  systemKey: SystemCategoryKey | null;
  templateKey: string | null;
  hidden: boolean;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CategoryNode = Category & { children: Category[] };

export type BatchCounts = {
  read: number;
  created: number;
  updated: number;
  restored: number;
  duplicate: number;
  protected: number;
  rejected: number;
};

export type ImportBatch = {
  id: Uuid;
  ownerId: OwnerId;
  source: Source;
  accountId: Uuid | null;
  initiatedBy: BatchInitiator;
  fileName: string | null;
  fileSha256: string | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  status: BatchStatus;
  counts: BatchCounts;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AccountBalance = {
  accountId: Uuid;
  reportedCents: Cents | null;
  reportedOn: IsoDate | null;
  computedCents: Cents;
  computedAtReportedCents: Cents | null;
  divergenceCents: Cents | null;
};

export type AuditEntry = {
  id: number;
  entityType: AuditEntityType;
  entityId: Uuid;
  action: AuditAction;
  actor: Actor;
  reason: string | null;
  changes: Record<string, { old: unknown; new: unknown }>;
  occurredAt: string;
};

export type ExportChunk =
  | { entity: "institutions"; rows: Institution[] }
  | { entity: "accounts"; rows: Account[] }
  | { entity: "categories"; rows: Category[] }
  | { entity: "import_batches"; rows: ImportBatch[] }
  | { entity: "transactions"; rows: Transaction[] }
  | { entity: "audit_log"; rows: AuditEntry[] };

// ---- Entradas -------------------------------------------------------------------------------

export type NewInstitution = {
  name: string;
  kind: InstitutionKind;
  bankCode?: string;
  externalRef?: string;
};
export type InstitutionPatch = Partial<Pick<NewInstitution, "name" | "kind" | "bankCode">>;

export type AccountInput = {
  institutionId: Uuid;
  name: string;
  type: AccountType;
  nickname?: string;
  source: "manual" | "pluggy";
  externalId?: string;
  last4?: string;
  creditLimitCents?: Cents;
  closingDay?: number;
  dueDay?: number;
  openingBalanceCents?: Cents;
  openingBalanceOn?: IsoDate;
};
export type AccountPatch = Partial<
  Pick<
    AccountInput,
    | "nickname"
    | "closingDay"
    | "dueDay"
    | "openingBalanceCents"
    | "openingBalanceOn"
    | "name"
    | "type"
    | "institutionId"
    | "last4"
    | "creditLimitCents"
  >
>;

export type IncomingTx = {
  accountId: Uuid;
  source: Exclude<Source, "manual">;
  externalId?: string;
  amountCents: Cents;
  bookedOn: IsoDate;
  occurredAt?: string;
  descriptionOriginal: string;
  merchant?: string;
  status: TxStatus;
  nature?: TxNature;
  category?: { id: Uuid; source: "rule" | "ai" | "source"; confidence?: number };
  installment?: Installment;
  original?: OriginalAmount;
};

export type ManualTxInput = {
  accountId: Uuid;
  amountCents: Cents;
  bookedOn: IsoDate;
  description: string;
  occurredAt?: string;
  merchant?: string;
  status?: TxStatus;
  nature?: TxNature;
  relatedTransactionId?: Uuid;
  categoryId?: Uuid | null;
  notes?: string;
  installment?: Installment;
  original?: OriginalAmount;
};

export type TxPatch = {
  description?: string | null;
  merchant?: string | null;
  notes?: string | null;
  nature?: TxNature;
  relatedTransactionId?: Uuid | null;
  category?: { id: Uuid | null; confidence?: number };
  amountCents?: Cents;
  bookedOn?: IsoDate;
  accountId?: Uuid;
  status?: TxStatus;
  occurredAt?: string | null;
  installment?: Installment | null;
  original?: OriginalAmount | null;
};

export type NewCategory = { name: string; parentId?: Uuid; kind?: CategoryKind };
export type CategoryPatch = {
  name?: string;
  hidden?: boolean;
  parentId?: Uuid | null;
  kind?: CategoryKind;
  sortOrder?: number;
};

export type NewBatch = {
  source: Source;
  initiatedBy: BatchInitiator;
  accountId?: Uuid;
  fileName?: string;
  fileSha256?: string;
  periodStart?: IsoDate;
  periodEnd?: IsoDate;
};

export type TxQuery = {
  accountIds?: Uuid[];
  from?: IsoDate;
  to?: IsoDate;
  includeDeleted?: boolean;
  status?: TxStatus;
  limit?: number;
  cursor?: string | null;
};

export type UpsertOutcome = "created" | "updated" | "restored" | "duplicate" | "rejected";

export type UpsertResult = {
  created: number;
  updated: number;
  restored: number;
  duplicate: number;
  protected: number;
  rejected: number;
  results: {
    index: number;
    outcome: UpsertOutcome;
    id?: Uuid;
    protectedFields?: LockableField[];
    error?: { code: CoreErrorCode; field?: string };
  }[];
};
