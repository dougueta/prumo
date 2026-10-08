import { randomUUID } from "node:crypto";
import {
  deriveAction,
  deriveReason,
  diffRows,
  flatAccount,
  flatBatch,
  flatCategory,
  flatInstitution,
  flatTransaction,
  type FlatRow,
} from "@/domain/core/audit";
import { computeBalances } from "@/domain/core/balances";
import { decodeCursor, encodeCursor } from "@/domain/core/cursor";
import { CATALOG_INSTITUTIONS, DEFAULT_CATEGORIES } from "@/domain/core/default-categories";
import { CoreError, forbidden, notFound, validation } from "@/domain/core/errors";
import { fingerprintBase, fpIdentity, manualIdentity } from "@/domain/core/identity";
import {
  applyPatch,
  guardTransactionInsert,
  guardTransactionUpdate,
  type GuardContext,
  type TxLookups,
} from "@/domain/core/locks";
import { isIsoDate } from "@/domain/core/dates";
import { assertCents } from "@/domain/core/money";
import {
  accountInputSchema,
  accountPatchSchema,
  categoryPatchSchema,
  incomingTxSchema,
  institutionPatchSchema,
  manualTxInputSchema,
  newBatchSchema,
  newCategorySchema,
  newInstitutionSchema,
  pageOptionsSchema,
  parseInput,
  txPatchSchema,
  txQuerySchema,
} from "@/domain/core/schemas";
import { assertBatchTransition } from "@/domain/core/state";
import { nameKey } from "@/domain/core/text";
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
import { DELETED_REASONS, LOCKABLE_FIELDS } from "@/domain/core/types";
import type { CoreStore } from "../ports";

export type BatchRow = ImportBatch & { fpOccurrences: Record<string, number> };
type AuditRow = AuditEntry & { ownerId: OwnerId };

/** Contexto de uma gravação (equivale a `prumo.actor`/`prumo.action`/`prumo.reason`). */
export type OpContext = { actor: Actor; action?: string; reason?: string; forceUnlink?: boolean };

/**
 * "Banco" em memória compartilhado por várias lojas (uma por dono) — permite testar isolamento
 * entre donos como no Postgres. Objetos são imutáveis: toda alteração substitui a entrada.
 */
export class MemoryDb {
  institutions = new Map<Uuid, Institution>();
  accounts = new Map<Uuid, Account>();
  transactions = new Map<Uuid, Transaction>();
  categories = new Map<Uuid, Category>();
  batches = new Map<Uuid, BatchRow>();
  audit: AuditRow[] = [];
  private auditSeq = 0;
  private lastMs = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {
    const at = new Date(0).toISOString();
    for (const i of CATALOG_INSTITUTIONS) {
      this.institutions.set(i.id, {
        id: i.id,
        ownerId: null,
        name: i.name,
        kind: i.kind,
        bankCode: i.bankCode,
        externalRef: null,
        createdAt: at,
        updatedAt: at,
      });
    }
  }

  /** Instante ISO estritamente crescente (ordem estável entre gravações no mesmo ms). */
  now(): string {
    this.lastMs = Math.max(this.lastMs + 1, this.clock().getTime());
    return new Date(this.lastMs).toISOString();
  }

  nextAuditId(): number {
    return ++this.auditSeq;
  }

  /** Executa `fn` de forma atômica (como uma transação do banco): em erro, desfaz tudo. */
  atomic<T>(fn: () => T): T {
    const snapshot = {
      institutions: new Map(this.institutions),
      accounts: new Map(this.accounts),
      transactions: new Map(this.transactions),
      categories: new Map(this.categories),
      batches: new Map(this.batches),
      auditLength: this.audit.length,
      auditSeq: this.auditSeq,
    };
    try {
      return fn();
    } catch (error) {
      this.institutions = snapshot.institutions;
      this.accounts = snapshot.accounts;
      this.transactions = snapshot.transactions;
      this.categories = snapshot.categories;
      this.batches = snapshot.batches;
      this.audit.length = snapshot.auditLength;
      this.auditSeq = snapshot.auditSeq;
      throw error;
    }
  }
}

const ENTITY_FLAT: Record<AuditEntityType, (row: never) => FlatRow> = {
  institution: flatInstitution,
  account: flatAccount,
  transaction: flatTransaction,
  category: flatCategory,
  import_batch: flatBatch,
};

const byOrder = (a: Category, b: Category) =>
  a.sortOrder - b.sortOrder ||
  nameKey(a.name).localeCompare(nameKey(b.name)) ||
  a.id.localeCompare(b.id);

const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const EXPORT_CHUNK = 500;

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

const toBatch = (row: BatchRow): ImportBatch => omit(row, "fpOccurrences");

function* chunks<T>(rows: T[]): Generator<T[]> {
  for (let i = 0; i < rows.length; i += EXPORT_CHUNK) yield rows.slice(i, i + EXPORT_CHUNK);
}

const isTxCursor = (v: Record<string, unknown>): v is { b: string; i: string } =>
  typeof v.b === "string" && typeof v.i === "string";
const isBatchCursor = (v: Record<string, unknown>): v is { s: string; i: string } =>
  typeof v.s === "string" && typeof v.i === "string";
const isAuditCursor = (v: Record<string, unknown>): v is { a: number } => typeof v.a === "number";

/** Implementação em memória do CoreStore (modo demonstração e bateria de contrato). */
export class MemoryCoreStore implements CoreStore {
  readonly mode = "memory" as const;

  constructor(
    readonly db: MemoryDb,
    readonly ownerId: OwnerId,
  ) {}

  /** Operação assíncrona e atômica (como uma chamada a uma função core_*). */
  private run<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(this.db.atomic(fn));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // ---- auditoria (espelho de core_audit) ------------------------------------------------------

  private record<T>(entity: AuditEntityType, before: T | null, after: T, ctx: OpContext): boolean {
    const flat = ENTITY_FLAT[entity] as (row: T) => FlatRow;
    const oldRow = before === null ? null : flat(before);
    const newRow = flat(after);
    const changes = diffRows(oldRow, newRow);
    if (oldRow !== null && Object.keys(changes).length === 0) return false;
    const ownerId = newRow.ownerId as OwnerId | null;
    if (!ownerId) return true;
    const action = deriveAction(entity, oldRow, newRow, changes, ctx.action);
    this.db.audit.push({
      id: this.db.nextAuditId(),
      ownerId,
      entityType: entity,
      entityId: newRow.id as Uuid,
      action,
      actor: ctx.actor,
      reason: deriveReason(entity, action, newRow, ctx.reason),
      changes,
      occurredAt: this.db.now(),
    });
    return true;
  }

  // ---- leituras escopadas ao dono -------------------------------------------------------------

  private ownAccounts(): Account[] {
    return [...this.db.accounts.values()].filter((a) => a.ownerId === this.ownerId);
  }

  private ownAccount(id: Uuid, field?: string): Account {
    const account = this.db.accounts.get(id);
    if (!account || account.ownerId !== this.ownerId) throw notFound(field);
    return account;
  }

  private ownTransactions(): Transaction[] {
    return [...this.db.transactions.values()].filter((t) => t.ownerId === this.ownerId);
  }

  private ownTx(id: Uuid, field?: string): Transaction {
    const tx = this.db.transactions.get(id);
    if (!tx || tx.ownerId !== this.ownerId) throw notFound(field);
    return tx;
  }

  private ownCategories(): Category[] {
    return [...this.db.categories.values()].filter((c) => c.ownerId === this.ownerId);
  }

  private ownCategory(id: Uuid, field?: string): Category {
    const category = this.db.categories.get(id);
    if (!category || category.ownerId !== this.ownerId) throw notFound(field);
    return category;
  }

  private ownBatch(id: Uuid, field?: string): BatchRow {
    const batch = this.db.batches.get(id);
    if (!batch || batch.ownerId !== this.ownerId) throw notFound(field);
    return batch;
  }

  private systemCategory(key: SystemCategoryKey): Category | undefined {
    return this.ownCategories().find((c) => c.systemKey === key);
  }

  private lookups(): TxLookups {
    return {
      uncategorizedId: this.systemCategory("uncategorized")?.id ?? null,
      systemCategoryId: (key) => this.systemCategory(key)?.id ?? null,
      isAccountArchived: (id) => {
        const account = this.db.accounts.get(id);
        return Boolean(account && account.ownerId === this.ownerId && account.archivedAt);
      },
      isTransactionDeleted: (id) => {
        const tx = this.db.transactions.get(id);
        return Boolean(tx && tx.ownerId === this.ownerId && tx.deletedAt);
      },
      batch: (id) => {
        const batch = this.db.batches.get(id);
        return batch && batch.ownerId === this.ownerId ? batch : undefined;
      },
    };
  }

  // ---- gravações de transação (INSERT/UPDATE com guarda + auditoria) ---------------------------

  /** Referências (FKs compostas): tudo do mesmo dono, senão not_found. */
  private checkTxReferences(tx: Transaction): void {
    this.ownAccount(tx.accountId, "accountId");
    if (tx.batchId) this.ownBatch(tx.batchId, "batchId");
    if (tx.categoryId) this.ownCategory(tx.categoryId, "categoryId");
    if (tx.relatedTransactionId) this.ownTx(tx.relatedTransactionId, "relatedTransactionId");
  }

  private insertTx(row: Transaction, ctx: OpContext): Transaction {
    const guarded = guardTransactionInsert(row, { ...this.lookups(), ...ctx });
    this.checkTxReferences(guarded);
    const clash = this.ownTransactions().find(
      (t) =>
        t.accountId === guarded.accountId &&
        t.source === guarded.source &&
        t.identityKey === guarded.identityKey,
    );
    if (clash) throw new CoreError("conflict");
    this.db.transactions.set(guarded.id, guarded);
    this.record("transaction", null, guarded, ctx);
    return guarded;
  }

  /** UPDATE: aplica o guarda; sem mudança efetiva não grava nem audita. */
  private updateTx(old: Transaction, proposed: Transaction, ctx: OpContext): Transaction {
    const guardCtx: GuardContext = { ...this.lookups(), ...ctx };
    const next = guardTransactionUpdate(old, proposed, guardCtx);
    return this.saveTx(old, next, ctx);
  }

  private saveTx(old: Transaction, next: Transaction, ctx: OpContext): Transaction {
    if (same({ ...next, updatedAt: null }, { ...old, updatedAt: null })) return old;
    if (next.accountId !== old.accountId) this.ownAccount(next.accountId, "accountId");
    if (next.categoryId && next.categoryId !== old.categoryId) {
      this.ownCategory(next.categoryId, "categoryId");
    }
    if (next.relatedTransactionId && next.relatedTransactionId !== old.relatedTransactionId) {
      this.ownTx(next.relatedTransactionId, "relatedTransactionId");
    }
    const saved = { ...next, updatedAt: this.db.now() };
    this.db.transactions.set(saved.id, saved);
    this.record("transaction", old, saved, ctx);
    return saved;
  }

  private newTx(
    fields: Partial<Transaction> & Pick<Transaction, "accountId" | "source">,
  ): Transaction {
    const at = this.db.now();
    return {
      id: randomUUID(),
      ownerId: this.ownerId,
      batchId: null,
      externalId: null,
      identityKey: "",
      amountCents: 0,
      bookedOn: "1900-01-01",
      occurredAt: null,
      descriptionOriginal: "",
      description: null,
      merchant: null,
      status: "posted",
      nature: "regular",
      relatedTransactionId: null,
      categoryId: null,
      categorySource: null,
      categoryConfidence: null,
      notes: null,
      installment: null,
      original: null,
      lockedFields: [],
      deletedAt: null,
      deletedReason: null,
      mergedIntoId: null,
      createdAt: at,
      updatedAt: at,
      ...fields,
    };
  }

  // ---- bootstrap (FR-029) --------------------------------------------------------------------

  bootstrap = (): Promise<{ createdCategories: number }> => this.run(() => this.bootstrapSync());

  private bootstrapSync(): { createdCategories: number } {
    const ctx: OpContext = { actor: { type: "system" } };
    const existing = new Map(
      this.ownCategories()
        .filter((c) => c.templateKey)
        .map((c) => [c.templateKey as string, c]),
    );
    let created = 0;
    for (const template of DEFAULT_CATEGORIES) {
      if (existing.has(template.key)) continue;
      const parent = template.parentKey ? existing.get(template.parentKey) : undefined;
      if (template.parentKey && (!parent || parent.deletedAt)) continue;
      const at = this.db.now();
      const category: Category = {
        id: randomUUID(),
        ownerId: this.ownerId,
        parentId: parent?.id ?? null,
        name: template.name,
        kind: parent?.kind ?? template.kind,
        origin: template.systemKey ? "system" : "default",
        systemKey: template.systemKey,
        templateKey: template.key,
        hidden: false,
        sortOrder: template.sortOrder,
        deletedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      this.db.categories.set(category.id, category);
      this.record("category", null, category, ctx);
      existing.set(template.key, category);
      created++;
    }
    return { createdCategories: created };
  }

  private ensureBootstrapped(): void {
    if (this.ownCategories().length === 0) this.bootstrapSync();
  }

  // ---- instituições ---------------------------------------------------------------------------

  private checkInstitutionUnique(candidate: Institution): void {
    for (const other of this.db.institutions.values()) {
      if (other.id === candidate.id || other.ownerId !== this.ownerId) continue;
      if (nameKey(other.name) === nameKey(candidate.name)) throw new CoreError("conflict");
      if (candidate.externalRef && other.externalRef === candidate.externalRef) {
        throw new CoreError("conflict");
      }
    }
  }

  institutions = {
    list: (): Promise<Institution[]> =>
      this.run(() =>
        [...this.db.institutions.values()]
          .filter((i) => i.ownerId === null || i.ownerId === this.ownerId)
          .sort(
            (a, b) =>
              Number(a.ownerId !== null) - Number(b.ownerId !== null) ||
              nameKey(a.name).localeCompare(nameKey(b.name)) ||
              a.id.localeCompare(b.id),
          ),
      ),
    create: (input: NewInstitution, actor: Actor): Promise<Institution> =>
      this.run(() => {
        const data = parseInput(newInstitutionSchema, input);
        const at = this.db.now();
        const institution: Institution = {
          id: randomUUID(),
          ownerId: this.ownerId,
          name: data.name,
          kind: data.kind,
          bankCode: data.bankCode ?? null,
          externalRef: data.externalRef ?? null,
          createdAt: at,
          updatedAt: at,
        };
        this.checkInstitutionUnique(institution);
        this.db.institutions.set(institution.id, institution);
        this.record("institution", null, institution, { actor });
        return institution;
      }),
    update: (id: Uuid, patch: InstitutionPatch, actor: Actor): Promise<Institution> =>
      this.run(() => {
        const data = parseInput(institutionPatchSchema, patch);
        const old = this.db.institutions.get(id);
        if (!old || old.ownerId !== this.ownerId) throw notFound();
        const next: Institution = { ...old, ...data };
        if (same(next, old)) return old;
        this.checkInstitutionUnique(next);
        const saved = { ...next, updatedAt: this.db.now() };
        this.db.institutions.set(id, saved);
        this.record("institution", old, saved, { actor });
        return saved;
      }),
  };

  // ---- contas ---------------------------------------------------------------------------------

  private checkInstitution(id: Uuid): void {
    const institution = this.db.institutions.get(id);
    if (!institution || (institution.ownerId !== null && institution.ownerId !== this.ownerId)) {
      throw notFound("institutionId");
    }
  }

  /** CHECKs da tabela accounts. */
  private checkAccount(account: Account): void {
    if (
      account.type !== "credit_card" &&
      (account.creditLimitCents !== null || account.closingDay !== null || account.dueDay !== null)
    ) {
      throw validation("cardFields");
    }
    if ((account.reportedBalanceCents === null) !== (account.reportedBalanceOn === null)) {
      throw validation("reportedBalance");
    }
  }

  /** Partição de campos dono × fonte (trigger accounts_guard, FR-024). */
  private guardAccount(old: Account, proposed: Account, actor: Actor): Account {
    const next = { ...proposed };
    for (const key of ["id", "ownerId", "source", "externalId", "currency", "createdAt"] as const) {
      if (!same(next[key], old[key])) throw forbidden("source_field");
    }
    if (next.institutionId !== old.institutionId) this.checkInstitution(next.institutionId);
    const sourceFields = ["name", "type", "institutionId", "last4", "creditLimitCents"] as const;
    if (actor.type === "user") {
      const changed = [...sourceFields, "reportedBalanceCents", "reportedBalanceOn"].some(
        (key) => !same(next[key as keyof Account], old[key as keyof Account]),
      );
      if (old.source === "pluggy" && changed) throw forbidden("source_field");
    } else {
      for (const key of [
        "nickname",
        "closingDay",
        "dueDay",
        "openingBalanceCents",
        "openingBalanceOn",
        "archivedAt",
      ] as const) {
        (next as Record<string, unknown>)[key] = old[key];
      }
      if (old.source === "manual") {
        for (const key of sourceFields) (next as Record<string, unknown>)[key] = old[key];
      }
    }
    this.checkAccount(next);
    return next;
  }

  private saveAccount(old: Account, proposed: Account, actor: Actor): Account {
    const next = this.guardAccount(old, proposed, actor);
    if (same({ ...next, updatedAt: null }, { ...old, updatedAt: null })) return old;
    const saved = { ...next, updatedAt: this.db.now() };
    this.db.accounts.set(saved.id, saved);
    this.record("account", old, saved, { actor });
    return saved;
  }

  accounts = {
    list: (opts: { includeArchived?: boolean } = {}): Promise<Account[]> =>
      this.run(() =>
        this.ownAccounts()
          .filter((a) => opts.includeArchived || !a.archivedAt)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
      ),
    get: (id: Uuid): Promise<Account> => this.run(() => this.ownAccount(id)),
    upsert: (input: AccountInput, actor: Actor): Promise<Account> =>
      this.run(() => {
        const data = parseInput(accountInputSchema, input);
        if (data.source === "pluggy") {
          const existing = this.ownAccounts().find(
            (a) => a.source === "pluggy" && a.externalId === data.externalId,
          );
          if (existing) {
            return this.saveAccount(
              existing,
              {
                ...existing,
                name: data.name,
                type: data.type,
                institutionId: data.institutionId,
                ...(data.last4 !== undefined ? { last4: data.last4 } : {}),
                ...(data.creditLimitCents !== undefined
                  ? { creditLimitCents: data.creditLimitCents }
                  : {}),
                ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
                ...(data.closingDay !== undefined ? { closingDay: data.closingDay } : {}),
                ...(data.dueDay !== undefined ? { dueDay: data.dueDay } : {}),
              },
              actor,
            );
          }
        }
        this.checkInstitution(data.institutionId);
        const at = this.db.now();
        const account: Account = {
          id: randomUUID(),
          ownerId: this.ownerId,
          institutionId: data.institutionId,
          name: data.name,
          nickname: data.nickname ?? null,
          type: data.type,
          currency: "BRL",
          source: data.source,
          externalId: data.externalId ?? null,
          last4: data.last4 ?? null,
          creditLimitCents: data.creditLimitCents ?? null,
          closingDay: data.closingDay ?? null,
          dueDay: data.dueDay ?? null,
          openingBalanceCents: data.openingBalanceCents ?? 0,
          openingBalanceOn: data.openingBalanceOn ?? null,
          reportedBalanceCents: null,
          reportedBalanceOn: null,
          archivedAt: null,
          createdAt: at,
          updatedAt: at,
        };
        this.checkAccount(account);
        this.db.accounts.set(account.id, account);
        this.record("account", null, account, { actor });
        return account;
      }),
    update: (id: Uuid, patch: AccountPatch, actor: Actor): Promise<Account> =>
      this.run(() => {
        const data = parseInput(accountPatchSchema, patch);
        const old = this.ownAccount(id);
        return this.saveAccount(old, { ...old, ...data }, actor);
      }),
    setArchived: (id: Uuid, archived: boolean, actor: Actor): Promise<Account> =>
      this.run(() => {
        const old = this.ownAccount(id);
        const archivedAt = archived ? (old.archivedAt ?? this.db.now()) : null;
        return this.saveAccount(old, { ...old, archivedAt }, actor);
      }),
    setReportedBalance: (id: Uuid, cents: Cents, on: IsoDate, actor: Actor): Promise<Account> =>
      this.run(() => {
        assertCents(cents, "reportedBalanceCents");
        if (!isIsoDate(on)) throw validation("reportedBalanceOn");
        const old = this.ownAccount(id);
        return this.saveAccount(
          old,
          { ...old, reportedBalanceCents: cents, reportedBalanceOn: on },
          actor,
        );
      }),
    balances: (asOf: IsoDate): Promise<AccountBalance[]> =>
      this.run(() => {
        if (!isIsoDate(asOf)) throw validation("asOf");
        const accounts = this.ownAccounts().sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
        return computeBalances(accounts, this.ownTransactions(), asOf);
      }),
  };

  // ---- transações -----------------------------------------------------------------------------

  private upsertRow(
    batch: BatchRow,
    row: IncomingTx,
    occurrences: Record<string, number>,
    ctx: OpContext,
  ): {
    outcome: UpsertResult["results"][number]["outcome"];
    id: Uuid;
    protectedFields: LockableField[];
    base?: string;
    k?: number;
  } {
    const account = this.ownAccount(row.accountId, "accountId");
    if (account.archivedAt) throw validation("accountId");
    let identityKey: string;
    let base: string | undefined;
    let k: number | undefined;
    if (row.externalId !== undefined) {
      identityKey = `ext:${row.externalId}`;
    } else {
      base = fingerprintBase(row);
      k = (occurrences[base] ?? 0) + 1;
      identityKey = fpIdentity(base, k);
    }
    const lookups = this.lookups();
    const categoryId = row.category?.id ?? null;
    const existing = this.ownTransactions().find(
      (t) =>
        t.accountId === row.accountId && t.source === batch.source && t.identityKey === identityKey,
    );

    if (!existing) {
      const tx = this.insertTx(
        this.newTx({
          accountId: row.accountId,
          batchId: batch.id,
          source: batch.source,
          externalId: row.externalId ?? null,
          identityKey,
          amountCents: row.amountCents,
          bookedOn: row.bookedOn,
          occurredAt: row.occurredAt ? new Date(row.occurredAt).toISOString() : null,
          descriptionOriginal: row.descriptionOriginal,
          merchant: row.merchant ?? null,
          status: row.status,
          nature: row.nature ?? "regular",
          categoryId,
          categorySource: categoryId ? row.category!.source : null,
          categoryConfidence: categoryId ? (row.category!.confidence ?? null) : null,
          installment: row.installment ?? null,
          original: row.original ?? null,
        }),
        ctx,
      );
      return { outcome: "created", id: tx.id, protectedFields: [], base, k };
    }

    const protectedFields: LockableField[] = [];
    const normalizedCategory =
      categoryId && categoryId === lookups.uncategorizedId ? null : categoryId;
    if (
      row.merchant !== undefined &&
      existing.lockedFields.includes("merchant") &&
      row.merchant !== existing.merchant
    ) {
      protectedFields.push("merchant");
    }
    if (
      categoryId &&
      existing.lockedFields.includes("categoryId") &&
      normalizedCategory !== existing.categoryId
    ) {
      protectedFields.push("categoryId");
    }
    if (
      row.nature !== undefined &&
      existing.lockedFields.includes("nature") &&
      row.nature !== existing.nature
    ) {
      protectedFields.push("nature");
    }

    let outcome: "restored" | "duplicate" | "updated";
    const occurredAt = row.occurredAt ? new Date(row.occurredAt).toISOString() : null;
    if (existing.deletedAt) {
      if (existing.deletedReason === "batch_undone") {
        this.updateTx(
          existing,
          { ...existing, deletedAt: null, deletedReason: null },
          { ...ctx, reason: "reimport" },
        );
        outcome = "restored";
      } else {
        outcome = "duplicate";
      }
    } else if (
      existing.status === "pending" &&
      (row.amountCents !== existing.amountCents ||
        row.bookedOn !== existing.bookedOn ||
        row.descriptionOriginal !== existing.descriptionOriginal ||
        row.status !== existing.status ||
        (row.occurredAt !== undefined && occurredAt !== existing.occurredAt))
    ) {
      this.updateTx(
        existing,
        {
          ...existing,
          amountCents: row.amountCents,
          bookedOn: row.bookedOn,
          descriptionOriginal: row.descriptionOriginal,
          status: row.status,
          occurredAt: occurredAt ?? existing.occurredAt,
          merchant: row.merchant !== undefined ? row.merchant : existing.merchant,
          nature: row.nature ?? existing.nature,
          ...(categoryId
            ? {
                categoryId,
                categorySource: row.category!.source,
                categoryConfidence: row.category!.confidence ?? null,
              }
            : {}),
        },
        ctx,
      );
      outcome = "updated";
    } else {
      const fill =
        (existing.merchant === null && row.merchant !== undefined) ||
        (existing.occurredAt === null && row.occurredAt !== undefined);
      if (fill) {
        this.updateTx(
          existing,
          {
            ...existing,
            merchant: existing.merchant ?? row.merchant ?? null,
            occurredAt: existing.occurredAt ?? occurredAt,
          },
          ctx,
        );
      }
      outcome = "duplicate";
    }
    return { outcome, id: existing.id, protectedFields, base, k };
  }

  private softDeleteSync(
    ids: Uuid[],
    reason: DeletedReason,
    actor: Actor,
    mergedInto?: Uuid,
  ): number {
    if (!DELETED_REASONS.includes(reason)) throw validation("reason");
    if (reason === "merged" && !mergedInto) throw validation("mergedInto");
    if (reason !== "merged" && mergedInto) throw validation("mergedInto");
    if (ids.length === 0) return 0;
    const unique = [...new Set(ids)];
    const rows = unique.map((id) => this.ownTx(id));
    if (reason === "merged") {
      if (unique.includes(mergedInto!)) throw validation("mergedInto");
      const survivor = this.db.transactions.get(mergedInto!);
      if (!survivor || survivor.ownerId !== this.ownerId || survivor.deletedAt) {
        throw notFound("mergedInto");
      }
    }
    const ctx: OpContext = { actor };
    const at = this.db.now();
    let count = 0;
    for (const tx of rows) {
      if (tx.deletedAt) continue;
      this.updateTx(
        tx,
        {
          ...tx,
          deletedAt: at,
          deletedReason: reason,
          mergedIntoId: reason === "merged" ? mergedInto! : null,
        },
        ctx,
      );
      count++;
    }
    for (const dependent of this.ownTransactions()) {
      if (!dependent.relatedTransactionId || dependent.deletedAt) continue;
      if (!unique.includes(dependent.relatedTransactionId)) continue;
      this.updateTx(
        dependent,
        {
          ...dependent,
          relatedTransactionId: null,
          nature: dependent.lockedFields.includes("nature") ? dependent.nature : "regular",
        },
        { ...ctx, forceUnlink: true },
      );
    }
    return count;
  }

  transactions = {
    list: (q: TxQuery): Promise<Page<Transaction>> =>
      this.run(() => {
        const query = parseInput(txQuerySchema, q ?? {});
        const limit = query.limit ?? 50;
        const after = query.cursor ? decodeCursor(query.cursor, isTxCursor) : null;
        const rows = this.ownTransactions()
          .filter(
            (t) =>
              (query.includeDeleted || !t.deletedAt) &&
              (!query.accountIds || query.accountIds.includes(t.accountId)) &&
              (!query.from || t.bookedOn >= query.from) &&
              (!query.to || t.bookedOn <= query.to) &&
              (!query.status || t.status === query.status) &&
              (!after || t.bookedOn < after.b || (t.bookedOn === after.b && t.id < after.i)),
          )
          .sort((a, b) => desc(a.bookedOn, b.bookedOn) || desc(a.id, b.id));
        const items = rows.slice(0, limit);
        const last = items[items.length - 1];
        return {
          items,
          nextCursor:
            rows.length > limit && last ? encodeCursor({ b: last.bookedOn, i: last.id }) : null,
        };
      }),
    get: (id: Uuid, opts: { includeDeleted?: boolean } = {}): Promise<Transaction> =>
      this.run(() => {
        const tx = this.ownTx(id);
        if (tx.deletedAt && !opts.includeDeleted) throw notFound();
        return tx;
      }),
    upsertMany: (batchId: Uuid, rows: IncomingTx[], actor: Actor): Promise<UpsertResult> =>
      this.run(() => {
        const batch = this.ownBatch(batchId, "batchId");
        const parsed = rows.map((row) => {
          const result = incomingTxSchema.safeParse(row);
          if (result.success) return { ok: true as const, row: result.data as IncomingTx };
          try {
            parseInput(incomingTxSchema, row);
          } catch (error) {
            return { ok: false as const, error: error as CoreError };
          }
          return { ok: false as const, error: validation() };
        });
        if (
          batch.status !== "processing" ||
          parsed.some((p) => p.ok && p.row.source !== batch.source)
        ) {
          throw forbidden("batch_closed");
        }
        const ctx: OpContext = { actor: { ...actor, batchId } };
        const occurrences = { ...batch.fpOccurrences };
        const result: UpsertResult = {
          created: 0,
          updated: 0,
          restored: 0,
          duplicate: 0,
          protected: 0,
          rejected: 0,
          results: [],
        };
        parsed.forEach((item, index) => {
          if (!item.ok) {
            result.rejected++;
            result.results.push({
              index,
              outcome: "rejected",
              error: {
                code: item.error.code,
                ...(item.error.field ? { field: item.error.field } : {}),
              },
            });
            return;
          }
          try {
            const done = this.db.atomic(() => this.upsertRow(batch, item.row, occurrences, ctx));
            if (done.base && done.k) occurrences[done.base] = done.k;
            result[done.outcome]++;
            if (done.protectedFields.length > 0) result.protected++;
            result.results.push({
              index,
              outcome: done.outcome,
              id: done.id,
              ...(done.protectedFields.length > 0 ? { protectedFields: done.protectedFields } : {}),
            });
          } catch (error) {
            if (!(error instanceof CoreError) || error.code === "unavailable") throw error;
            result.rejected++;
            result.results.push({
              index,
              outcome: "rejected",
              error: { code: error.code, ...(error.field ? { field: error.field } : {}) },
            });
          }
        });
        const current = this.ownBatch(batchId);
        this.saveBatch(
          current,
          {
            ...current,
            fpOccurrences: occurrences,
            counts: {
              read: current.counts.read + rows.length,
              created: current.counts.created + result.created,
              updated: current.counts.updated + result.updated,
              restored: current.counts.restored + result.restored,
              duplicate: current.counts.duplicate + result.duplicate,
              protected: current.counts.protected + result.protected,
              rejected: current.counts.rejected + result.rejected,
            },
          },
          ctx,
        );
        return result;
      }),
    createManual: (input: ManualTxInput, actor: Actor): Promise<Transaction> =>
      this.run(() => {
        const data = parseInput(manualTxInputSchema, input);
        const id = randomUUID();
        const categoryId = data.categoryId ?? null;
        return this.insertTx(
          this.newTx({
            id,
            accountId: data.accountId,
            source: "manual",
            identityKey: manualIdentity(id),
            amountCents: data.amountCents,
            bookedOn: data.bookedOn,
            occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
            descriptionOriginal: data.description,
            merchant: data.merchant ?? null,
            status: data.status ?? "posted",
            nature: data.nature ?? "regular",
            relatedTransactionId: data.relatedTransactionId ?? null,
            categoryId,
            categorySource: categoryId ? "manual" : null,
            notes: data.notes ?? null,
            installment: data.installment ?? null,
            original: data.original ?? null,
          }),
          { actor },
        );
      }),
    update: (id: Uuid, patch: TxPatch, actor: Actor): Promise<Transaction> =>
      this.run(() => {
        const data = parseInput(txPatchSchema, patch) as TxPatch;
        const existing = this.ownTx(id);
        if (existing.deletedAt) throw forbidden("deleted");
        const normalized: TxPatch = {
          ...data,
          ...(data.occurredAt ? { occurredAt: new Date(data.occurredAt).toISOString() } : {}),
        };
        if (normalized.category?.id) this.ownCategory(normalized.category.id, "categoryId");
        if (normalized.accountId) this.ownAccount(normalized.accountId, "accountId");
        if (normalized.relatedTransactionId) {
          this.ownTx(normalized.relatedTransactionId, "relatedTransactionId");
        }
        const { next } = applyPatch(existing, normalized, actor, this.lookups());
        return this.saveTx(existing, next, { actor });
      }),
    unlockField: (id: Uuid, field: LockableField, actor: Actor): Promise<Transaction> =>
      this.run(() => {
        if (!LOCKABLE_FIELDS.includes(field)) throw validation("field");
        const existing = this.ownTx(id);
        if (existing.deletedAt) throw forbidden("deleted");
        return this.updateTx(
          existing,
          { ...existing, lockedFields: existing.lockedFields.filter((f) => f !== field) },
          { actor, action: "unlock" },
        );
      }),
    softDelete: (
      ids: Uuid[],
      reason: DeletedReason,
      actor: Actor,
      mergedInto?: Uuid,
    ): Promise<number> => this.run(() => this.softDeleteSync(ids, reason, actor, mergedInto)),
    restore: (ids: Uuid[], actor: Actor): Promise<number> =>
      this.run(() => {
        if (ids.length === 0) return 0;
        const unique = [...new Set(ids)];
        unique.forEach((id) => this.ownTx(id));
        let count = 0;
        // sobreviventes antes das mescladas
        for (const pass of [false, true]) {
          for (const id of unique) {
            const tx = this.ownTx(id);
            if (!tx.deletedAt || (tx.deletedReason === "merged") !== pass) continue;
            this.updateTx(
              tx,
              { ...tx, deletedAt: null, deletedReason: null, mergedIntoId: null },
              { actor },
            );
            count++;
          }
        }
        return count;
      }),
  };

  // ---- categorias -----------------------------------------------------------------------------

  /** Trigger categories_guard (+ unicidade de nome entre irmãs, FR-032). */
  private guardCategory(old: Category | null, proposed: Category): Category {
    const next = { ...proposed };
    if (old) {
      for (const key of [
        "id",
        "ownerId",
        "origin",
        "systemKey",
        "templateKey",
        "createdAt",
      ] as const) {
        if (!same(next[key], old[key])) throw forbidden("system_category");
      }
      if (
        old.deletedAt &&
        next.deletedAt &&
        !same({ ...next, updatedAt: null }, { ...old, updatedAt: null })
      ) {
        throw forbidden("deleted");
      }
      if (old.systemKey && (next.parentId !== old.parentId || next.deletedAt)) {
        throw forbidden("system_category");
      }
      if (
        !old.deletedAt &&
        next.deletedAt &&
        this.ownCategories().some((c) => c.parentId === next.id && c.systemKey)
      ) {
        throw forbidden("system_child");
      }
    }
    if (next.parentId && !next.deletedAt) {
      const parent = this.ownCategory(next.parentId, "parentId");
      if (parent.deletedAt || parent.systemKey === "uncategorized") throw validation("parentId");
      if (parent.parentId) throw forbidden("depth");
      if (
        (old === null || next.parentId !== old.parentId) &&
        this.ownCategories().some((c) => c.parentId === next.id && !c.deletedAt)
      ) {
        throw forbidden("depth");
      }
      next.kind = parent.kind;
    }
    if (old?.systemKey && next.parentId === null && next.kind !== old.kind) {
      throw forbidden("system_category");
    }
    if (!next.deletedAt) {
      const clash = this.ownCategories().some(
        (c) =>
          c.id !== next.id &&
          !c.deletedAt &&
          c.parentId === next.parentId &&
          nameKey(c.name) === nameKey(next.name),
      );
      if (clash) throw new CoreError("conflict");
    }
    return next;
  }

  private saveCategory(old: Category, proposed: Category, ctx: OpContext): Category {
    const next = this.guardCategory(old, proposed);
    if (same({ ...next, updatedAt: null }, { ...old, updatedAt: null })) return old;
    const saved = { ...next, updatedAt: this.db.now() };
    this.db.categories.set(saved.id, saved);
    this.record("category", old, saved, ctx);
    // tipo do pai propaga aos filhos ativos (FR-028)
    if (saved.parentId === null && saved.kind !== old.kind) {
      for (const child of this.ownCategories()) {
        if (child.parentId === saved.id && !child.deletedAt && child.kind !== saved.kind) {
          this.saveCategory(child, { ...child, kind: saved.kind }, ctx);
        }
      }
    }
    return saved;
  }

  categories = {
    tree: (
      opts: { includeHidden?: boolean; includeDeleted?: boolean } = {},
    ): Promise<CategoryNode[]> =>
      this.run(() => {
        this.ensureBootstrapped();
        const visible = (c: Category) =>
          (opts.includeHidden || !c.hidden) && (opts.includeDeleted || !c.deletedAt);
        const all = this.ownCategories().filter(visible);
        return all
          .filter((c) => c.parentId === null)
          .sort(byOrder)
          .map((root) => ({
            ...root,
            children: all.filter((c) => c.parentId === root.id).sort(byOrder),
          }));
      }),
    bySystemKey: (key: SystemCategoryKey): Promise<Category> =>
      this.run(() => {
        this.ensureBootstrapped();
        const category = this.systemCategory(key);
        if (!category) throw notFound();
        return category;
      }),
    create: (input: NewCategory, actor: Actor): Promise<Category> =>
      this.run(() => {
        const data = parseInput(newCategorySchema, input);
        const at = this.db.now();
        const category = this.guardCategory(null, {
          id: randomUUID(),
          ownerId: this.ownerId,
          parentId: data.parentId ?? null,
          name: data.name,
          kind: data.kind ?? "expense",
          origin: "custom",
          systemKey: null,
          templateKey: null,
          hidden: false,
          sortOrder: 1000,
          deletedAt: null,
          createdAt: at,
          updatedAt: at,
        });
        this.db.categories.set(category.id, category);
        this.record("category", null, category, { actor });
        return category;
      }),
    update: (id: Uuid, patch: CategoryPatch, actor: Actor): Promise<Category> =>
      this.run(() => {
        const data = parseInput(categoryPatchSchema, patch);
        const old = this.ownCategory(id);
        if (old.deletedAt) throw forbidden("deleted");
        return this.saveCategory(old, { ...old, ...data }, { actor });
      }),
    remove: (
      id: Uuid,
      opts: { targetId?: Uuid; children: "move" | "delete" },
      actor: Actor,
    ): Promise<{ reassigned: number }> =>
      this.run(() => {
        if (opts.children !== "move" && opts.children !== "delete") throw validation("children");
        const category = this.ownCategory(id);
        if (category.deletedAt) throw notFound();
        if (category.systemKey) throw forbidden("system_category");
        if (this.ownCategories().some((c) => c.parentId === id && c.systemKey)) {
          throw forbidden("system_child");
        }
        let target: Category;
        if (opts.targetId === undefined) {
          this.ensureBootstrapped();
          target = this.systemCategory("uncategorized")!;
        } else {
          target = this.ownCategory(opts.targetId, "targetId");
          if (target.deletedAt) throw notFound("targetId");
          if (target.id === id || target.parentId === id) throw validation("targetId");
        }
        const targetId = target.systemKey === "uncategorized" ? null : target.id;
        const ctx: OpContext = { actor };
        const children = this.ownCategories().filter((c) => c.parentId === id && !c.deletedAt);
        let ids = [id];
        if (opts.children === "move") {
          for (const child of children) {
            const parentId = targetId && target.parentId === null ? targetId : null;
            this.saveCategory(child, { ...child, parentId }, ctx);
          }
        } else {
          ids = [...children.map((c) => c.id), id];
        }
        let reassigned = 0;
        for (const tx of this.ownTransactions()) {
          if (tx.deletedAt || !tx.categoryId || !ids.includes(tx.categoryId)) continue;
          this.updateTx(
            tx,
            {
              ...tx,
              categoryId: targetId,
              categorySource: targetId ? tx.categorySource : null,
              categoryConfidence: targetId ? tx.categoryConfidence : null,
            },
            { ...ctx, action: "reassign" },
          );
          reassigned++;
        }
        const at = this.db.now();
        for (const childId of ids.filter((c) => c !== id)) {
          const child = this.ownCategory(childId);
          this.saveCategory(child, { ...child, deletedAt: at }, ctx);
        }
        const current = this.ownCategory(id);
        this.saveCategory(current, { ...current, deletedAt: at }, ctx);
        return { reassigned };
      }),
    restore: (id: Uuid, actor: Actor): Promise<Category> =>
      this.run(() => {
        const old = this.ownCategory(id);
        if (!old.deletedAt) return old;
        return this.saveCategory(old, { ...old, deletedAt: null }, { actor });
      }),
  };

  // ---- lotes ----------------------------------------------------------------------------------

  /** Trigger import_batches_state_guard + auditoria. */
  private saveBatch(old: BatchRow, proposed: BatchRow, ctx: OpContext): BatchRow {
    const next = { ...proposed };
    if (old.status === "undone") throw forbidden("batch_state");
    if (next.status !== old.status) {
      assertBatchTransition(old.status, next.status);
      if (next.status === "completed" || next.status === "failed") next.finishedAt = this.db.now();
      if (next.status === "processing" || next.status === "in_review") next.finishedAt = null;
    } else if (
      old.status !== "processing" &&
      (!same(next.fpOccurrences, old.fpOccurrences) || !same(next.counts, old.counts))
    ) {
      throw forbidden("batch_closed");
    }
    this.db.batches.set(next.id, next);
    this.record("import_batch", toBatch(old), toBatch(next), ctx);
    return next;
  }

  batches = {
    create: (input: NewBatch, actor: Actor): Promise<ImportBatch> =>
      this.run(() => {
        const data = parseInput(newBatchSchema, input);
        if (data.accountId) this.ownAccount(data.accountId, "accountId");
        const batch: BatchRow = {
          id: randomUUID(),
          ownerId: this.ownerId,
          source: data.source,
          accountId: data.accountId ?? null,
          initiatedBy: data.initiatedBy,
          fileName: data.fileName ?? null,
          fileSha256: data.fileSha256 ?? null,
          periodStart: data.periodStart ?? null,
          periodEnd: data.periodEnd ?? null,
          status: "processing",
          counts: {
            read: 0,
            created: 0,
            updated: 0,
            restored: 0,
            duplicate: 0,
            protected: 0,
            rejected: 0,
          },
          errorSummary: null,
          startedAt: this.db.now(),
          finishedAt: null,
          fpOccurrences: {},
        };
        this.db.batches.set(batch.id, batch);
        this.record("import_batch", null, toBatch(batch), { actor });
        return toBatch(batch);
      }),
    findCompletedByFile: (accountId: Uuid, sha256: string): Promise<ImportBatch | null> =>
      this.run(() => {
        const found = [...this.db.batches.values()]
          .filter(
            (b) =>
              b.ownerId === this.ownerId &&
              b.accountId === accountId &&
              b.fileSha256 === sha256 &&
              b.status === "completed",
          )
          .sort((a, b) => desc(a.startedAt, b.startedAt) || desc(a.id, b.id))[0];
        return found ? toBatch(found) : null;
      }),
    finish: (
      id: Uuid,
      status: "in_review" | "completed" | "failed",
      actor: Actor,
      errorSummary?: string,
    ): Promise<ImportBatch> =>
      this.run(() => {
        if (!["in_review", "completed", "failed"].includes(status)) throw validation("status");
        const old = this.ownBatch(id);
        if (!(old.status === "processing" || (old.status === "in_review" && status === "failed"))) {
          throw forbidden("batch_state");
        }
        return toBatch(
          this.saveBatch(
            old,
            { ...old, status, errorSummary: errorSummary?.slice(0, 500) ?? old.errorSummary },
            { actor },
          ),
        );
      }),
    resume: (id: Uuid, actor: Actor): Promise<ImportBatch> =>
      this.run(() => {
        const old = this.ownBatch(id);
        if (old.status !== "in_review") throw forbidden("batch_state");
        return toBatch(this.saveBatch(old, { ...old, status: "processing" }, { actor }));
      }),
    undo: (id: Uuid, actor: Actor): Promise<{ deleted: number; withManualEdits: number }> =>
      this.run(() => {
        const batch = this.ownBatch(id);
        if (batch.status !== "completed" && batch.status !== "failed")
          throw forbidden("batch_state");
        const targets = this.ownTransactions().filter((t) => t.batchId === id && !t.deletedAt);
        const withManualEdits = targets.filter((t) => t.lockedFields.length > 0).length;
        const deleted = this.softDeleteSync(
          targets.map((t) => t.id),
          "batch_undone",
          actor,
        );
        this.saveBatch(this.ownBatch(id), { ...this.ownBatch(id), status: "undone" }, { actor });
        return { deleted, withManualEdits };
      }),
    list: (opts: { limit?: number; cursor?: string | null } = {}): Promise<Page<ImportBatch>> =>
      this.run(() => {
        const page = parseInput(pageOptionsSchema(200), opts);
        const limit = page.limit ?? 50;
        const after = page.cursor ? decodeCursor(page.cursor, isBatchCursor) : null;
        const rows = [...this.db.batches.values()]
          .filter(
            (b) =>
              b.ownerId === this.ownerId &&
              (!after || b.startedAt < after.s || (b.startedAt === after.s && b.id < after.i)),
          )
          .sort((a, b) => desc(a.startedAt, b.startedAt) || desc(a.id, b.id));
        const items = rows.slice(0, limit).map(toBatch);
        const last = items[items.length - 1];
        return {
          items,
          nextCursor:
            rows.length > limit && last ? encodeCursor({ s: last.startedAt, i: last.id }) : null,
        };
      }),
    get: (id: Uuid): Promise<ImportBatch> => this.run(() => toBatch(this.ownBatch(id))),
  };

  // ---- auditoria e exportação -----------------------------------------------------------------

  audit = {
    history: (
      entityType: AuditEntityType,
      entityId: Uuid,
      opts: { limit?: number; cursor?: string | null } = {},
    ): Promise<Page<AuditEntry>> =>
      this.run(() => {
        const page = parseInput(pageOptionsSchema(500), opts);
        const limit = page.limit ?? 50;
        const after = page.cursor ? decodeCursor(page.cursor, isAuditCursor) : null;
        const rows = this.db.audit
          .filter(
            (a) =>
              a.ownerId === this.ownerId &&
              a.entityType === entityType &&
              a.entityId === entityId &&
              (!after || a.id < after.a),
          )
          .sort((a, b) => b.id - a.id);
        const items = rows.slice(0, limit).map((row) => omit(row, "ownerId"));
        const last = items[items.length - 1];
        return {
          items,
          nextCursor: rows.length > limit && last ? encodeCursor({ a: last.id }) : null,
        };
      }),
  };

  exportAll = (): AsyncIterable<ExportChunk> => {
    const owner = this.ownerId;
    const db = this.db;
    const byCreated = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    return (async function* () {
      const institutions = [...db.institutions.values()]
        .filter((i) => i.ownerId === owner)
        .sort(byCreated);
      for (const rows of chunks(institutions)) yield { entity: "institutions" as const, rows };
      const accounts = [...db.accounts.values()].filter((a) => a.ownerId === owner).sort(byCreated);
      for (const rows of chunks(accounts)) yield { entity: "accounts" as const, rows };
      const categories = [...db.categories.values()]
        .filter((c) => c.ownerId === owner)
        .sort(byCreated);
      for (const rows of chunks(categories)) yield { entity: "categories" as const, rows };
      const batches = [...db.batches.values()]
        .filter((b) => b.ownerId === owner)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))
        .map(toBatch);
      for (const rows of chunks(batches)) yield { entity: "import_batches" as const, rows };
      const transactions = [...db.transactions.values()]
        .filter((t) => t.ownerId === owner)
        .sort(byCreated);
      for (const rows of chunks(transactions)) yield { entity: "transactions" as const, rows };
      const audit = db.audit
        .filter((a) => a.ownerId === owner)
        .sort((a, b) => a.id - b.id)
        .map((row) => omit(row, "ownerId"));
      for (const rows of chunks(audit)) yield { entity: "audit_log" as const, rows };
    })();
  };
}
