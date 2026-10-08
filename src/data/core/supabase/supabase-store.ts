import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreError, mapDbError, notFound } from "@/domain/core/errors";
import { nameKey } from "@/domain/core/text";
import type {
  Actor,
  Category,
  CategoryNode,
  OwnerId,
  SystemCategoryKey,
} from "@/domain/core/types";
import type { CoreStore } from "../ports";
import { toCategory } from "./mappers";

const todo = (): never => {
  throw new CoreError("unavailable");
};

type Row = Record<string, unknown>;

const byOrder = (a: Category, b: Category) =>
  a.sortOrder - b.sortOrder ||
  nameKey(a.name).localeCompare(nameKey(b.name)) ||
  a.id.localeCompare(b.id);

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
  protected async rpc<T>(fn: string, args: Row, actor?: Actor): Promise<T> {
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
  protected scoped(table: string, columns = "*") {
    return this.client.from(table).select(columns).eq("owner_id", this.ownerId);
  }

  protected async rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
    let result;
    try {
      result = await query;
    } catch (error) {
      throw mapDbError(error);
    }
    if (result.error) throw mapDbError(result.error);
    return (result.data ?? []) as T[];
  }

  protected async allCategories(): Promise<Category[]> {
    const rows = await this.rows<Row>(this.scoped("categories").limit(1000));
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

  protected async ensuredCategories(): Promise<Category[]> {
    const categories = await this.allCategories();
    if (categories.length > 0) return categories;
    await this.bootstrap();
    return this.allCategories();
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
