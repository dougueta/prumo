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
import { CATALOG_INSTITUTIONS, DEFAULT_CATEGORIES } from "@/domain/core/default-categories";
import { CoreError, notFound } from "@/domain/core/errors";
import { nameKey } from "@/domain/core/text";
import type {
  Account,
  Actor,
  AuditEntityType,
  AuditEntry,
  Category,
  CategoryNode,
  ImportBatch,
  Institution,
  OwnerId,
  SystemCategoryKey,
  Transaction,
  Uuid,
} from "@/domain/core/types";
import type { CoreStore } from "../ports";

const todo = (): never => {
  throw new CoreError("unavailable");
};

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

  /** Executa `fn` de forma atômica: em erro, desfaz tudo o que ela gravou. */
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

/** Implementação em memória do CoreStore (modo demonstração e bateria de contrato). */
export class MemoryCoreStore implements CoreStore {
  readonly mode = "memory" as const;

  constructor(
    readonly db: MemoryDb,
    readonly ownerId: OwnerId,
  ) {}

  // ---- infraestrutura ------------------------------------------------------------------------

  /** Registra auditoria (mesma regra do trigger core_audit). Devolve false se nada mudou. */
  protected record<T>(
    entity: AuditEntityType,
    before: T | null,
    after: T,
    ctx: OpContext,
  ): boolean {
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

  protected ownCategories(): Category[] {
    return [...this.db.categories.values()].filter((c) => c.ownerId === this.ownerId);
  }

  protected ownCategory(id: Uuid): Category {
    const category = this.db.categories.get(id);
    if (!category || category.ownerId !== this.ownerId) throw notFound();
    return category;
  }

  protected systemCategory(key: SystemCategoryKey): Category | undefined {
    return this.ownCategories().find((c) => c.systemKey === key);
  }

  // ---- bootstrap (FR-029) --------------------------------------------------------------------

  bootstrap = async (): Promise<{ createdCategories: number }> =>
    this.db.atomic(() => this.bootstrapSync());

  protected bootstrapSync(): { createdCategories: number } {
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

  protected ensureBootstrapped(): void {
    if (this.ownCategories().length === 0) this.bootstrapSync();
  }

  protected categoriesTree(opts: { includeHidden?: boolean; includeDeleted?: boolean } = {}) {
    this.ensureBootstrapped();
    const visible = (c: Category) =>
      (opts.includeHidden || !c.hidden) && (opts.includeDeleted || !c.deletedAt);
    const all = this.ownCategories().filter(visible);
    return all
      .filter((c) => c.parentId === null)
      .sort(byOrder)
      .map((root): CategoryNode => ({
        ...root,
        children: all.filter((c) => c.parentId === root.id).sort(byOrder),
      }));
  }

  // ---- superfície do contrato ----------------------------------------------------------------

  institutions = { list: todo, create: todo, update: todo };
  accounts = {
    list: todo,
    get: todo,
    upsert: todo,
    update: todo,
    setArchived: todo,
    setReportedBalance: todo,
    balances: todo,
  };
  transactions = {
    list: todo,
    get: todo,
    upsertMany: todo,
    createManual: todo,
    update: todo,
    unlockField: todo,
    softDelete: todo,
    restore: todo,
  };
  categories = {
    tree: async (opts?: { includeHidden?: boolean; includeDeleted?: boolean }) =>
      this.db.atomic(() => this.categoriesTree(opts)),
    bySystemKey: async (key: SystemCategoryKey): Promise<Category> =>
      this.db.atomic(() => {
        this.ensureBootstrapped();
        const category = this.systemCategory(key);
        if (!category) throw notFound();
        return category;
      }),
    create: todo,
    update: todo,
    remove: todo,
    restore: todo,
  };
  batches = {
    create: todo,
    findCompletedByFile: todo,
    finish: todo,
    resume: todo,
    undo: todo,
    list: todo,
    get: todo,
  };
  audit = { history: todo };
  exportAll = todo;
}
