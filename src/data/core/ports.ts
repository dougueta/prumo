import type {
  Account,
  AccountBalance,
  AccountInput,
  AccountPatch,
  Actor,
  AuditEntityType,
  AuditEntry,
  Category,
  CategoryNode,
  CategoryPatch,
  Cents,
  DeletedReason,
  ExportChunk,
  ImportBatch,
  IncomingTx,
  Institution,
  InstitutionPatch,
  IsoDate,
  LockableField,
  ManualTxInput,
  NewBatch,
  NewCategory,
  NewInstitution,
  OwnerId,
  Page,
  SystemCategoryKey,
  Transaction,
  TxPatch,
  TxQuery,
  UpsertResult,
  Uuid,
} from "@/domain/core/types";

/**
 * Porta de dados core (contracts/core-store.md). Duas implementações com comportamento idêntico,
 * provado pela bateria tests/contract/core-store.contract.ts: Supabase e memória (demo).
 * Toda operação é escopada ao dono definido na construção.
 */
export interface CoreStore {
  readonly ownerId: OwnerId;
  readonly mode: "supabase" | "memory";

  /** FR-029 — idempotente: copia a taxonomia padrão para o dono. */
  bootstrap(): Promise<{ createdCategories: number }>;

  institutions: {
    list(): Promise<Institution[]>;
    create(input: NewInstitution, actor: Actor): Promise<Institution>;
    update(id: Uuid, patch: InstitutionPatch, actor: Actor): Promise<Institution>;
  };

  accounts: {
    list(opts?: { includeArchived?: boolean }): Promise<Account[]>;
    get(id: Uuid): Promise<Account>;
    upsert(input: AccountInput, actor: Actor): Promise<Account>;
    update(id: Uuid, patch: AccountPatch, actor: Actor): Promise<Account>;
    setArchived(id: Uuid, archived: boolean, actor: Actor): Promise<Account>;
    setReportedBalance(id: Uuid, cents: Cents, on: IsoDate, actor: Actor): Promise<Account>;
    balances(asOf: IsoDate): Promise<AccountBalance[]>;
  };

  transactions: {
    list(q: TxQuery): Promise<Page<Transaction>>;
    get(id: Uuid, opts?: { includeDeleted?: boolean }): Promise<Transaction>;
    upsertMany(batchId: Uuid, rows: IncomingTx[], actor: Actor): Promise<UpsertResult>;
    createManual(input: ManualTxInput, actor: Actor): Promise<Transaction>;
    update(id: Uuid, patch: TxPatch, actor: Actor): Promise<Transaction>;
    unlockField(id: Uuid, field: LockableField, actor: Actor): Promise<Transaction>;
    softDelete(
      ids: Uuid[],
      reason: DeletedReason,
      actor: Actor,
      mergedInto?: Uuid,
    ): Promise<number>;
    restore(ids: Uuid[], actor: Actor): Promise<number>;
  };

  categories: {
    tree(opts?: { includeHidden?: boolean; includeDeleted?: boolean }): Promise<CategoryNode[]>;
    bySystemKey(key: SystemCategoryKey): Promise<Category>;
    create(input: NewCategory, actor: Actor): Promise<Category>;
    update(id: Uuid, patch: CategoryPatch, actor: Actor): Promise<Category>;
    remove(
      id: Uuid,
      opts: { targetId?: Uuid; children: "move" | "delete" },
      actor: Actor,
    ): Promise<{ reassigned: number }>;
    restore(id: Uuid, actor: Actor): Promise<Category>;
  };

  batches: {
    create(input: NewBatch, actor: Actor): Promise<ImportBatch>;
    findCompletedByFile(accountId: Uuid, sha256: string): Promise<ImportBatch | null>;
    finish(
      id: Uuid,
      status: "in_review" | "completed" | "failed",
      actor: Actor,
      errorSummary?: string,
    ): Promise<ImportBatch>;
    resume(id: Uuid, actor: Actor): Promise<ImportBatch>;
    undo(id: Uuid, actor: Actor): Promise<{ deleted: number; withManualEdits: number }>;
    list(opts?: { limit?: number; cursor?: string | null }): Promise<Page<ImportBatch>>;
    get(id: Uuid): Promise<ImportBatch>;
  };

  audit: {
    history(
      entityType: AuditEntityType,
      entityId: Uuid,
      opts?: { limit?: number; cursor?: string | null },
    ): Promise<Page<AuditEntry>>;
  };

  /** FR-044 — tudo do dono, inclusive excluídos e auditoria, em blocos de até 500 linhas. */
  exportAll(): AsyncIterable<ExportChunk>;
}
