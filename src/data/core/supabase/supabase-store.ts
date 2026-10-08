import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreError } from "@/domain/core/errors";
import type { OwnerId } from "@/domain/core/types";
import type { CoreStore } from "../ports";

const todo = (): never => {
  throw new CoreError("unavailable");
};

/** Implementação Supabase do CoreStore (só servidor). Gravações via funções core_* (R-02). */
export class SupabaseCoreStore implements CoreStore {
  readonly mode = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    readonly ownerId: OwnerId,
  ) {}

  bootstrap = todo;
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
    tree: todo,
    bySystemKey: todo,
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
