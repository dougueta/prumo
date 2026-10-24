/**
 * Erros do contrato core (contracts/core-store.md §Erros). Mensagens nunca incluem valores,
 * URLs ou chaves: só o código, o campo e o motivo.
 */

export type CoreErrorCode =
  | "not_found"
  | "validation"
  | "conflict"
  | "forbidden_operation"
  | "owner_required"
  | "unavailable";

export type ForbiddenReason =
  | "imported_fact"
  | "source_field"
  | "status_regression"
  | "deleted"
  | "batch_closed"
  | "batch_state"
  | "system_category"
  | "system_child"
  | "depth"
  | "merged_survivor_deleted"
  | "hard_delete";

const MESSAGES: Record<CoreErrorCode, string> = {
  not_found: "Registro não encontrado.",
  validation: "Dado inválido.",
  conflict: "Já existe um registro com esses dados.",
  forbidden_operation: "Operação não permitida.",
  owner_required: "Operação sem dono identificado.",
  unavailable: "Armazenamento de dados indisponível; tente novamente.",
};

export class CoreError extends Error {
  readonly code: CoreErrorCode;
  readonly field?: string;
  readonly reason?: ForbiddenReason;

  constructor(code: CoreErrorCode, details: { field?: string; reason?: ForbiddenReason } = {}) {
    const suffix = details.field
      ? ` (${details.field})`
      : details.reason
        ? ` (${details.reason})`
        : "";
    super(MESSAGES[code] + suffix);
    this.name = "CoreError";
    this.code = code;
    if (details.field) this.field = details.field;
    if (details.reason) this.reason = details.reason;
  }
}

export const validation = (field?: string) => new CoreError("validation", { field });
export const forbidden = (reason: ForbiddenReason) =>
  new CoreError("forbidden_operation", { reason });
export const notFound = (field?: string) => new CoreError("not_found", { field });

const FORBIDDEN_REASONS = new Set<string>([
  "imported_fact",
  "source_field",
  "status_regression",
  "deleted",
  "batch_closed",
  "batch_state",
  "system_category",
  "system_child",
  "depth",
  "merged_survivor_deleted",
  "hard_delete",
]);

const TABLE_PREFIX =
  /^(institutions|accounts|transactions|categories|category_templates|import_batches|audit_log)_/;

const snakeToCamel = (value: string) =>
  value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** "accounts_last4_check" → "last4"; nomes automáticos ("transactions_check1") → undefined. */
export function fieldFromConstraint(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const column = name.replace(TABLE_PREFIX, "").replace(/_(check|fkey|key)\d*$/, "");
  if (!column || /^check\d*$/.test(column) || column === name) return undefined;
  return snakeToCamel(column);
}

type DbErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
};

/** Traduz um erro do banco/PostgREST/rede para CoreError (nunca repassa a mensagem original). */
export function mapDbError(error: unknown): CoreError {
  if (error instanceof CoreError) return error;
  const e = (typeof error === "object" && error !== null ? error : {}) as DbErrorLike;
  const message = typeof e.message === "string" ? e.message : "";
  const code = typeof e.code === "string" ? e.code : "";

  const core = message.match(/^core\.([a-z_]+)(?::([A-Za-z0-9_]+))?/);
  if (core) {
    const [, kind, detail] = core;
    if (kind === "not_found") return notFound(detail);
    if (kind === "validation") return validation(detail);
    if (kind === "conflict") return new CoreError("conflict", { field: detail });
    if (kind === "owner_required") return new CoreError("owner_required");
    if (kind === "hard_delete_forbidden") return forbidden("hard_delete");
    if (kind === "forbidden" && detail && FORBIDDEN_REASONS.has(detail)) {
      return forbidden(detail as ForbiddenReason);
    }
  }

  switch (code) {
    case "P0002":
    case "PGRST116":
    case "23503":
      return notFound();
    case "23505":
      return new CoreError("conflict");
    case "23514": {
      const constraint = message.match(/constraint "([^"]+)"/)?.[1];
      return validation(fieldFromConstraint(constraint));
    }
    case "22P02":
    case "22007":
    case "22008":
    case "22003":
    case "22001":
    case "23502":
      return validation();
    default:
      return new CoreError("unavailable");
  }
}
