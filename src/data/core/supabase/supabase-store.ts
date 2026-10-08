import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeCursor, encodeCursor } from "@/domain/core/cursor";
import { isIsoDate } from "@/domain/core/dates";
import { CoreError, mapDbError, notFound, validation } from "@/domain/core/errors";
import { fingerprintBase } from "@/domain/core/identity";
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
import { LOCKABLE_FIELDS } from "@/domain/core/types";
import type { CoreStore } from "../ports";
import {
  lockableFromDb,
  lockableToDb,
  toAccount,
  toAuditEntry,
  toBatch,
  toCategory,
  toInstitution,
  toTransaction,
} from "./mappers";

type Row = Record<string, unknown>;

/** Máximo de linhas por chamada a core_upsert_transactions (data-model §5). */
const UPSERT_SLICE = 1000;
const EXPORT_CHUNK = 500;
const BATCH_COLUMNS =
  "id,owner_id,source,account_id,initiated_by,file_name,file_sha256,period_start,period_end,status," +
  "count_read,count_created,count_updated,count_restored,count_duplicate,count_protected," +
  "count_rejected,error_summary,started_at,finished_at";

const byOrder = (a: Category, b: Category) =>
  a.sortOrder - b.sortOrder ||
  nameKey(a.name).localeCompare(nameKey(b.name)) ||
  a.id.localeCompare(b.id);

/** Remove chaves `undefined` (o banco distingue "ausente" de "null" no patch). */
function defined(obj: Row): Row {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

const isTxCursor = (v: Record<string, unknown>): v is { b: string; i: string } =>
  typeof v.b === "string" && typeof v.i === "string";
const isBatchCursor = (v: Record<string, unknown>): v is { s: string; i: string } =>
  typeof v.s === "string" && typeof v.i === "string";
const isAuditCursor = (v: Record<string, unknown>): v is { a: number } => typeof v.a === "number";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:\d{2})$/;

function installmentRow(value: IncomingTx["installment"] | null | undefined): Row {
  return value
    ? {
        installment_number: value.number,
        installment_total: value.total,
        installment_group: value.group,
      }
    : {};
}

function originalRow(value: IncomingTx["original"] | null | undefined): Row {
  return value
    ? { original_currency: value.currency, original_amount_minor: value.amountMinor }
    : {};
}

/**
 * Implementação Supabase do CoreStore (só servidor). Gravações via funções core_* (R-02) com o
 * ator explícito; leituras via PostgREST SEMPRE filtradas por owner_id (mesmo com RLS — no modo
 * service a chave secreta ignora RLS, R-03).
 */
export class SupabaseCoreStore implements CoreStore {
  readonly mode = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    readonly ownerId: OwnerId,
  ) {}

  // ---- infraestrutura ------------------------------------------------------------------------

  /** Chama uma função core_* com dono e ator; erros viram CoreError (sem vazar detalhes). */
  private async rpc<T>(fn: string, args: Row, actor?: Actor): Promise<T> {
    let result;
    try {
      result = await this.client.rpc(fn, {
        ...args,
        p_owner_id: this.ownerId,
        ...(actor ? { p_actor: actor } : {}),
      });
    } catch (error) {
      throw mapDbError(error);
    }
    if (result.error) throw mapDbError(result.error);
    return result.data as T;
  }

  /** SELECT escopado ao dono (filtro explícito em toda consulta — T037). */
  private scoped(table: string, columns = "*") {
    return this.client.from(table).select(columns).eq("owner_id", this.ownerId);
  }

  private async rows<T = Row>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
    let result;
    try {
      result = await query;
    } catch (error) {
      throw mapDbError(error);
    }
    if (result.error) throw mapDbError(result.error);
    return (result.data ?? []) as T[];
  }

  private async one(table: string, id: Uuid, columns = "*"): Promise<Row> {
    if (!UUID_RE.test(id)) throw notFound();
    const [row] = await this.rows(this.scoped(table, columns).eq("id", id).limit(1));
    if (!row) throw notFound();
    return row;
  }

  private async allCategories(): Promise<Category[]> {
    const rows = await this.rows(this.scoped("categories").limit(1000));
    return rows.map(toCategory);
  }

  // ---- bootstrap (FR-029) --------------------------------------------------------------------

  bootstrap = async (): Promise<{ createdCategories: number }> => {
    const data = await this.rpc<{ created: number }>(
      "core_bootstrap_owner",
      {},
      { type: "system" },
    );
    return { createdCategories: data.created };
  };

  private async ensuredCategories(): Promise<Category[]> {
    const categories = await this.allCategories();
    if (categories.length > 0) return categories;
    await this.bootstrap();
    return this.allCategories();
  }

  // ---- instituições ---------------------------------------------------------------------------

  institutions = {
    list: async (): Promise<Institution[]> => {
      const rows = await this.rows(
        this.client
          .from("institutions")
          .select("*")
          .or(`owner_id.is.null,owner_id.eq.${this.ownerId}`)
          .limit(1000),
      );
      return rows
        .map(toInstitution)
        .sort(
          (a, b) =>
            Number(a.ownerId !== null) - Number(b.ownerId !== null) ||
            nameKey(a.name).localeCompare(nameKey(b.name)) ||
            a.id.localeCompare(b.id),
        );
    },
    create: async (input: NewInstitution, actor: Actor): Promise<Institution> => {
      const data = parseInput(newInstitutionSchema, input);
      const row = await this.rpc<Row>(
        "core_create_institution",
        {
          p: defined({
            name: data.name,
            kind: data.kind,
            bank_code: data.bankCode,
            external_ref: data.externalRef,
          }),
        },
        actor,
      );
      return toInstitution(row);
    },
    update: async (id: Uuid, patch: InstitutionPatch, actor: Actor): Promise<Institution> => {
      const data = parseInput(institutionPatchSchema, patch);
      const row = await this.rpc<Row>(
        "core_update_institution",
        {
          p_id: id,
          p_patch: defined({ name: data.name, kind: data.kind, bank_code: data.bankCode }),
        },
        actor,
      );
      return toInstitution(row);
    },
  };

  // ---- contas ---------------------------------------------------------------------------------

  accounts = {
    list: async (opts: { includeArchived?: boolean } = {}): Promise<Account[]> => {
      let query = this.scoped("accounts");
      if (!opts.includeArchived) query = query.is("archived_at", null);
      const rows = await this.rows(
        query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1000),
      );
      return rows.map(toAccount);
    },
    get: async (id: Uuid): Promise<Account> => toAccount(await this.one("accounts", id)),
    upsert: async (input: AccountInput, actor: Actor): Promise<Account> => {
      const d = parseInput(accountInputSchema, input);
      const row = await this.rpc<Row>(
        "core_upsert_account",
        {
          p: defined({
            institution_id: d.institutionId,
            name: d.name,
            type: d.type,
            nickname: d.nickname,
            source: d.source,
            external_id: d.externalId,
            last4: d.last4,
            credit_limit_cents: d.creditLimitCents,
            closing_day: d.closingDay,
            due_day: d.dueDay,
            opening_balance_cents: d.openingBalanceCents,
            opening_balance_on: d.openingBalanceOn,
          }),
        },
        actor,
      );
      return toAccount(row);
    },
    update: async (id: Uuid, patch: AccountPatch, actor: Actor): Promise<Account> => {
      const d = parseInput(accountPatchSchema, patch);
      const row = await this.rpc<Row>(
        "core_update_account",
        {
          p_id: id,
          p_patch: defined({
            nickname: d.nickname,
            closing_day: d.closingDay,
            due_day: d.dueDay,
            opening_balance_cents: d.openingBalanceCents,
            opening_balance_on: d.openingBalanceOn,
            name: d.name,
            type: d.type,
            institution_id: d.institutionId,
            last4: d.last4,
            credit_limit_cents: d.creditLimitCents,
          }),
        },
        actor,
      );
      return toAccount(row);
    },
    setArchived: async (id: Uuid, archived: boolean, actor: Actor): Promise<Account> =>
      toAccount(
        await this.rpc<Row>("core_archive_account", { p_id: id, p_archived: archived }, actor),
      ),
    setReportedBalance: async (
      id: Uuid,
      cents: Cents,
      on: IsoDate,
      actor: Actor,
    ): Promise<Account> => {
      assertCents(cents, "reportedBalanceCents");
      if (!isIsoDate(on)) throw validation("reportedBalanceOn");
      return toAccount(
        await this.rpc<Row>(
          "core_set_reported_balance",
          { p_account_id: id, p_cents: cents, p_on: on },
          actor,
        ),
      );
    },
    balances: async (asOf: IsoDate): Promise<AccountBalance[]> => {
      if (!isIsoDate(asOf)) throw validation("asOf");
      const rows = await this.rpc<Row[]>("core_account_balances", { p_as_of: asOf });
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      return rows.map((r) => ({
        accountId: String(r.account_id),
        reportedCents: num(r.reported_cents),
        reportedOn: (r.reported_on as string | null) ?? null,
        computedCents: Number(r.computed_cents),
        computedAtReportedCents: num(r.computed_at_reported_cents),
        divergenceCents: num(r.divergence_cents),
      }));
    },
  };

  // ---- transações -----------------------------------------------------------------------------

  private incomingRow(row: IncomingTx): Row {
    const base = defined({
      account_id: row.accountId,
      source: row.source,
      amount_cents: row.amountCents,
      booked_on: row.bookedOn,
      occurred_at: row.occurredAt,
      description_original: row.descriptionOriginal,
      merchant: row.merchant,
      status: row.status,
      nature: row.nature,
      category_id: row.category?.id,
      category_source: row.category?.source,
      category_confidence: row.category?.confidence,
      ...installmentRow(row.installment),
      ...originalRow(row.original),
    });
    return row.externalId !== undefined
      ? { ...base, external_id: row.externalId }
      : { ...base, fp_base: fingerprintBase(row) };
  }

  transactions = {
    list: async (q: TxQuery): Promise<Page<Transaction>> => {
      const query = parseInput(txQuerySchema, q ?? {});
      const limit = query.limit ?? 50;
      const after = query.cursor ? decodeCursor(query.cursor, isTxCursor) : null;
      if (after && (!isIsoDate(after.b) || !UUID_RE.test(after.i))) throw validation("cursor");
      let select = this.scoped("transactions");
      if (!query.includeDeleted) select = select.is("deleted_at", null);
      if (query.accountIds) select = select.in("account_id", query.accountIds);
      if (query.from) select = select.gte("booked_on", query.from);
      if (query.to) select = select.lte("booked_on", query.to);
      if (query.status) select = select.eq("status", query.status);
      if (after) {
        select = select.or(`booked_on.lt.${after.b},and(booked_on.eq.${after.b},id.lt.${after.i})`);
      }
      const rows = await this.rows(
        select
          .order("booked_on", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit + 1),
      );
      const items = rows.slice(0, limit).map(toTransaction);
      const last = items[items.length - 1];
      return {
        items,
        nextCursor:
          rows.length > limit && last ? encodeCursor({ b: last.bookedOn, i: last.id }) : null,
      };
    },
    get: async (id: Uuid, opts: { includeDeleted?: boolean } = {}): Promise<Transaction> => {
      const tx = toTransaction(await this.one("transactions", id));
      if (tx.deletedAt && !opts.includeDeleted) throw notFound();
      return tx;
    },
    upsertMany: async (batchId: Uuid, rows: IncomingTx[], actor: Actor): Promise<UpsertResult> => {
      if (!UUID_RE.test(batchId)) throw notFound("batchId");
      // linhas inválidas já seguem marcadas: o banco as conta como lidas/rejeitadas (FR-033)
      const prepared = rows.map((row): Row => {
        const parsed = incomingTxSchema.safeParse(row);
        if (parsed.success) return this.incomingRow(parsed.data as IncomingTx);
        try {
          parseInput(incomingTxSchema, row);
        } catch (error) {
          const e = error as CoreError;
          return { rejected: defined({ code: e.code, field: e.field }) };
        }
        return { rejected: { code: "validation" } };
      });
      const total: UpsertResult = {
        created: 0,
        updated: 0,
        restored: 0,
        duplicate: 0,
        protected: 0,
        rejected: 0,
        results: [],
      };
      for (let offset = 0; offset === 0 || offset < prepared.length; offset += UPSERT_SLICE) {
        const slice = prepared.slice(offset, offset + UPSERT_SLICE);
        const data = await this.rpc<Row & { results: Row[] }>(
          "core_upsert_transactions",
          { p_batch_id: batchId, p_rows: slice },
          actor,
        );
        for (const key of [
          "created",
          "updated",
          "restored",
          "duplicate",
          "protected",
          "rejected",
        ] as const) {
          total[key] += Number(data[key] ?? 0);
        }
        for (const r of data.results) {
          const protectedFields = (r.protected_fields as string[] | undefined)?.map(lockableFromDb);
          total.results.push({
            index: offset + Number(r.index),
            outcome: r.outcome as UpsertResult["results"][number]["outcome"],
            ...(r.id ? { id: String(r.id) } : {}),
            ...(protectedFields ? { protectedFields } : {}),
            ...(r.error ? { error: r.error as UpsertResult["results"][number]["error"] } : {}),
          });
        }
        if (prepared.length === 0) break;
      }
      return total;
    },
    createManual: async (input: ManualTxInput, actor: Actor): Promise<Transaction> => {
      const d = parseInput(manualTxInputSchema, input);
      const row = await this.rpc<Row>(
        "core_create_manual_transaction",
        {
          p_row: defined({
            account_id: d.accountId,
            amount_cents: d.amountCents,
            booked_on: d.bookedOn,
            description: d.description,
            occurred_at: d.occurredAt,
            merchant: d.merchant,
            status: d.status,
            nature: d.nature,
            related_transaction_id: d.relatedTransactionId,
            category_id: d.categoryId ?? undefined,
            notes: d.notes,
            ...installmentRow(d.installment),
            ...originalRow(d.original),
          }),
        },
        actor,
      );
      return toTransaction(row);
    },
    update: async (id: Uuid, patch: TxPatch, actor: Actor): Promise<Transaction> => {
      const d = parseInput(txPatchSchema, patch) as TxPatch;
      if (!UUID_RE.test(id)) throw notFound();
      const p: Row = defined({
        description: d.description,
        merchant: d.merchant,
        notes: d.notes,
        nature: d.nature,
        related_transaction_id: d.relatedTransactionId,
        category: d.category
          ? defined({ id: d.category.id, confidence: d.category.confidence })
          : undefined,
        amount_cents: d.amountCents,
        booked_on: d.bookedOn,
        account_id: d.accountId,
        status: d.status,
        occurred_at: d.occurredAt,
      });
      if ("installment" in d) p.installment = d.installment ?? null;
      if ("original" in d) {
        p.original = d.original
          ? { currency: d.original.currency, amount_minor: d.original.amountMinor }
          : null;
      }
      return toTransaction(
        await this.rpc<Row>("core_update_transaction", { p_id: id, p_patch: p }, actor),
      );
    },
    unlockField: async (id: Uuid, field: LockableField, actor: Actor): Promise<Transaction> => {
      if (!LOCKABLE_FIELDS.includes(field)) throw validation("field");
      if (!UUID_RE.test(id)) throw notFound();
      return toTransaction(
        await this.rpc<Row>("core_unlock_field", { p_id: id, p_field: lockableToDb(field) }, actor),
      );
    },
    softDelete: async (
      ids: Uuid[],
      reason: DeletedReason,
      actor: Actor,
      mergedInto?: Uuid,
    ): Promise<number> => {
      if (ids.some((id) => !UUID_RE.test(id))) throw notFound();
      return this.rpc<number>(
        "core_soft_delete_transactions",
        { p_ids: ids, p_reason: reason, p_merged_into: mergedInto ?? null },
        actor,
      );
    },
    restore: async (ids: Uuid[], actor: Actor): Promise<number> => {
      if (ids.some((id) => !UUID_RE.test(id))) throw notFound();
      return this.rpc<number>("core_restore_transactions", { p_ids: ids }, actor);
    },
  };

  // ---- categorias -----------------------------------------------------------------------------

  categories = {
    tree: async (
      opts: { includeHidden?: boolean; includeDeleted?: boolean } = {},
    ): Promise<CategoryNode[]> => {
      const visible = (c: Category) =>
        (opts.includeHidden || !c.hidden) && (opts.includeDeleted || !c.deletedAt);
      const all = (await this.ensuredCategories()).filter(visible);
      return all
        .filter((c) => c.parentId === null)
        .sort(byOrder)
        .map((root) => ({
          ...root,
          children: all.filter((c) => c.parentId === root.id).sort(byOrder),
        }));
    },
    bySystemKey: async (key: SystemCategoryKey): Promise<Category> => {
      const category = (await this.ensuredCategories()).find((c) => c.systemKey === key);
      if (!category) throw notFound();
      return category;
    },
    create: async (input: NewCategory, actor: Actor): Promise<Category> => {
      const d = parseInput(newCategorySchema, input);
      const row = await this.rpc<Row>(
        "core_create_category",
        { p: defined({ name: d.name, parent_id: d.parentId, kind: d.kind }) },
        actor,
      );
      return toCategory(row);
    },
    update: async (id: Uuid, patch: CategoryPatch, actor: Actor): Promise<Category> => {
      const d = parseInput(categoryPatchSchema, patch);
      if (!UUID_RE.test(id)) throw notFound();
      const row = await this.rpc<Row>(
        "core_update_category",
        {
          p_id: id,
          p_patch: defined({
            name: d.name,
            hidden: d.hidden,
            parent_id: d.parentId,
            kind: d.kind,
            sort_order: d.sortOrder,
          }),
        },
        actor,
      );
      return toCategory(row);
    },
    remove: async (
      id: Uuid,
      opts: { targetId?: Uuid; children: "move" | "delete" },
      actor: Actor,
    ): Promise<{ reassigned: number }> => {
      if (!UUID_RE.test(id)) throw notFound();
      if (opts.targetId !== undefined && !UUID_RE.test(opts.targetId)) throw notFound("targetId");
      if (opts.targetId === undefined) await this.ensuredCategories();
      return this.rpc<{ reassigned: number }>(
        "core_delete_category",
        { p_id: id, p_target_id: opts.targetId ?? null, p_children: opts.children },
        actor,
      );
    },
    restore: async (id: Uuid, actor: Actor): Promise<Category> => {
      if (!UUID_RE.test(id)) throw notFound();
      return toCategory(await this.rpc<Row>("core_restore_category", { p_id: id }, actor));
    },
  };

  // ---- lotes ----------------------------------------------------------------------------------

  batches = {
    create: async (input: NewBatch, actor: Actor): Promise<ImportBatch> => {
      const d = parseInput(newBatchSchema, input);
      const row = await this.rpc<Row>(
        "core_create_batch",
        {
          p: defined({
            source: d.source,
            initiated_by: d.initiatedBy,
            account_id: d.accountId,
            file_name: d.fileName,
            file_sha256: d.fileSha256,
            period_start: d.periodStart,
            period_end: d.periodEnd,
          }),
        },
        actor,
      );
      return toBatch(row);
    },
    findCompletedByFile: async (accountId: Uuid, sha256: string): Promise<ImportBatch | null> => {
      if (!UUID_RE.test(accountId) || !/^[0-9a-f]{64}$/.test(sha256)) throw validation("sha256");
      const row = await this.rpc<Row | null>("core_find_completed_batch_by_file", {
        p_account_id: accountId,
        p_sha256: sha256,
      });
      return row ? toBatch(row) : null;
    },
    finish: async (
      id: Uuid,
      status: "in_review" | "completed" | "failed",
      actor: Actor,
      errorSummary?: string,
    ): Promise<ImportBatch> => {
      if (!UUID_RE.test(id)) throw notFound();
      return toBatch(
        await this.rpc<Row>(
          "core_finish_batch",
          { p_id: id, p_status: status, p_error: errorSummary ?? null },
          actor,
        ),
      );
    },
    resume: async (id: Uuid, actor: Actor): Promise<ImportBatch> => {
      if (!UUID_RE.test(id)) throw notFound();
      return toBatch(await this.rpc<Row>("core_resume_batch", { p_id: id }, actor));
    },
    undo: async (id: Uuid, actor: Actor): Promise<{ deleted: number; withManualEdits: number }> => {
      if (!UUID_RE.test(id)) throw notFound();
      return this.rpc("core_undo_batch", { p_id: id }, actor);
    },
    list: async (
      opts: { limit?: number; cursor?: string | null } = {},
    ): Promise<Page<ImportBatch>> => {
      const page = parseInput(pageOptionsSchema(200), opts);
      const limit = page.limit ?? 50;
      const after = page.cursor ? decodeCursor(page.cursor, isBatchCursor) : null;
      if (after && (!ISO_TS_RE.test(after.s) || !UUID_RE.test(after.i))) throw validation("cursor");
      let select = this.scoped("import_batches", BATCH_COLUMNS);
      if (after) {
        select = select.or(
          `started_at.lt."${after.s}",and(started_at.eq."${after.s}",id.lt.${after.i})`,
        );
      }
      const rows = await this.rows(
        select
          .order("started_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit + 1),
      );
      const items = rows.slice(0, limit).map(toBatch);
      const lastRow = rows[Math.min(limit, rows.length) - 1];
      return {
        items,
        nextCursor:
          rows.length > limit && lastRow
            ? encodeCursor({ s: String(lastRow.started_at), i: String(lastRow.id) })
            : null,
      };
    },
    get: async (id: Uuid): Promise<ImportBatch> =>
      toBatch(await this.one("import_batches", id, BATCH_COLUMNS)),
  };

  // ---- auditoria e exportação -----------------------------------------------------------------

  audit = {
    history: async (
      entityType: AuditEntityType,
      entityId: Uuid,
      opts: { limit?: number; cursor?: string | null } = {},
    ): Promise<Page<AuditEntry>> => {
      const page = parseInput(pageOptionsSchema(500), opts);
      const limit = page.limit ?? 50;
      const after = page.cursor ? decodeCursor(page.cursor, isAuditCursor) : null;
      if (!UUID_RE.test(entityId)) return { items: [], nextCursor: null };
      const rows = await this.rpc<Row[]>("core_list_audit", {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_after_id: after?.a ?? null,
        p_limit: Math.min(limit + 1, 500),
      });
      const items = rows.slice(0, limit).map(toAuditEntry);
      const last = items[items.length - 1];
      return {
        items,
        nextCursor: rows.length > limit && last ? encodeCursor({ a: last.id }) : null,
      };
    },
  };

  /** FR-044 — páginas de até 500 por tabela (respeita max_rows 1.000 da API), por id. */
  exportAll = (): AsyncIterable<ExportChunk> => {
    const pages = async function* <T>(
      fetchPage: (after: string | number | null) => Promise<Row[]>,
      map: (row: Row) => T,
    ): AsyncGenerator<T[]> {
      let after: string | number | null = null;
      for (;;) {
        const rows = await fetchPage(after);
        if (rows.length === 0) return;
        yield rows.map(map);
        if (rows.length < EXPORT_CHUNK) return;
        after = rows[rows.length - 1].id as string | number;
      }
    };
    const byId =
      (table: string, columns = "*") =>
      (after: string | number | null) => {
        let query = this.scoped(table, columns);
        if (after !== null) query = query.gt("id", after);
        return this.rows(query.order("id", { ascending: true }).limit(EXPORT_CHUNK));
      };
    return (async function* () {
      for await (const rows of pages(byId("institutions"), toInstitution)) {
        yield { entity: "institutions" as const, rows };
      }
      for await (const rows of pages(byId("accounts"), toAccount)) {
        yield { entity: "accounts" as const, rows };
      }
      for await (const rows of pages(byId("categories"), toCategory)) {
        yield { entity: "categories" as const, rows };
      }
      for await (const rows of pages(byId("import_batches", BATCH_COLUMNS), toBatch)) {
        yield { entity: "import_batches" as const, rows };
      }
      for await (const rows of pages(byId("transactions"), toTransaction)) {
        yield { entity: "transactions" as const, rows };
      }
      for await (const rows of pages(byId("audit_log"), toAuditEntry)) {
        yield { entity: "audit_log" as const, rows };
      }
    })();
  };
}
