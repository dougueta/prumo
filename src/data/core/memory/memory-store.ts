import { CoreError } from "@/domain/core/errors";
import type { OwnerId } from "@/domain/core/types";
import type { CoreStore } from "../ports";

const todo = (): never => {
  throw new CoreError("unavailable");
};

/** Banco em memória compartilhado por várias lojas (um MemoryCoreStore por dono). */
export class MemoryDb {}

/** Implementação em memória do CoreStore (modo demonstração e testes de contrato). */
export class MemoryCoreStore implements CoreStore {
  readonly mode = "memory" as const;

  constructor(
    readonly db: MemoryDb,
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
