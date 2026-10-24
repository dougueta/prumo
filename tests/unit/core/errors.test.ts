import { describe, expect, it } from "vitest";
import { CoreError, mapDbError } from "@/domain/core/errors";

// 004 · T066 — mapeamento de erros do banco (contracts/core-store.md §Erros).
describe("mapDbError", () => {
  it.each([
    [{ message: "core.not_found", code: "P0002" }, { code: "not_found" }],
    [
      { message: "JSON object requested, no rows returned", code: "PGRST116" },
      { code: "not_found" },
    ],
    [{ message: "violates foreign key constraint", code: "23503" }, { code: "not_found" }],
    [{ message: "duplicate key value", code: "23505" }, { code: "conflict" }],
    [
      { message: 'new row violates check constraint "accounts_last4_check"', code: "23514" },
      { code: "validation", field: "last4" },
    ],
    [{ message: "invalid input syntax for type uuid", code: "22P02" }, { code: "validation" }],
    [{ message: "date/time field value out of range", code: "22008" }, { code: "validation" }],
    [{ message: "invalid datetime format", code: "22007" }, { code: "validation" }],
    [
      { message: "core.validation:bookedOn", code: "P0001" },
      { code: "validation", field: "bookedOn" },
    ],
    [
      { message: "core.forbidden:imported_fact", code: "P0001" },
      { code: "forbidden_operation", reason: "imported_fact" },
    ],
    [
      { message: "core.hard_delete_forbidden", code: "P0001" },
      { code: "forbidden_operation", reason: "hard_delete" },
    ],
    [{ message: "core.owner_required", code: "42501" }, { code: "owner_required" }],
    [
      { message: "canceling statement due to statement timeout", code: "57014" },
      { code: "unavailable" },
    ],
    [new TypeError("fetch failed"), { code: "unavailable" }],
    [{ message: "Internal Server Error", status: 503 }, { code: "unavailable" }],
    [{ message: "algo inesperado", code: "XX000" }, { code: "unavailable" }],
  ])("%j → %j", (input, expected) => {
    const error = mapDbError(input);
    expect(error).toBeInstanceOf(CoreError);
    expect(error).toMatchObject(expected);
  });

  it("devolve o próprio CoreError sem alterar", () => {
    const original = new CoreError("conflict");
    expect(mapDbError(original)).toBe(original);
  });

  it("nunca expõe URL, chave ou valores do erro original na mensagem", () => {
    const error = mapDbError({
      message: "falha em http://127.0.0.1:57321/rest/v1 com sb_secret_abc123 valor -12345 do dono",
      code: "XX000",
    });
    expect(error.message).not.toMatch(/http|sb_secret|12345|dono/);
  });
});
