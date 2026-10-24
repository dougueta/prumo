import { beforeAll, describe, expect, it } from "vitest";
import { createTestOwner, lit, sql } from "../../helpers/supabase-test";
import { seedBatch, sqlError } from "../../helpers/core-fixtures";

// 004 · T070 — máquina de estados do lote no banco (data-model §2.4; FR-033, FR-035).
let owner: string;

beforeAll(async () => {
  owner = (await createTestOwner()).id;
});

const setStatus = (id: string, status: string) =>
  `update public.import_batches set status = ${lit(status)} where id = ${lit(id)};`;

describe("import_batches_state_guard", () => {
  it.each([
    ["processing", "in_review"],
    ["processing", "completed"],
    ["processing", "failed"],
    ["in_review", "processing"],
    ["in_review", "failed"],
    ["completed", "undone"],
    ["failed", "undone"],
  ])("permite %s → %s", (from, to) => {
    const id = seedBatch(owner, { status: from });
    sql(setStatus(id, to));
    expect(sql(`select status from public.import_batches where id = ${lit(id)};`)).toBe(to);
  });

  it.each([
    ["in_review", "completed"],
    ["completed", "processing"],
    ["completed", "in_review"],
    ["completed", "failed"],
    ["failed", "processing"],
    ["failed", "in_review"],
    ["failed", "completed"],
    ["undone", "processing"],
    ["undone", "completed"],
    ["undone", "failed"],
    ["processing", "undone"],
  ])("proíbe %s → %s", (from, to) => {
    const id = seedBatch(owner, { status: from });
    expect(sqlError(setStatus(id, to))).toMatch(/core\.forbidden:batch_state/);
  });

  it("INSERT só em processing e com contadores zerados", () => {
    const base = `insert into public.import_batches (owner_id, source, initiated_by`;
    expect(
      sqlError(`${base}, status) values (${lit(owner)}, 'csv', 'user', 'completed');`),
    ).toMatch(/core\.validation/);
    expect(sqlError(`${base}, count_read) values (${lit(owner)}, 'csv', 'user', 5);`)).toMatch(
      /core\.validation/,
    );
  });

  it("finished_at é preenchido ao concluir/falhar e limpo ao retomar", () => {
    const done = seedBatch(owner, { status: "completed" });
    expect(
      sql(`select finished_at is not null from public.import_batches where id = ${lit(done)};`),
    ).toBe("t");
    const failed = seedBatch(owner, { status: "failed" });
    expect(
      sql(`select finished_at is not null from public.import_batches where id = ${lit(failed)};`),
    ).toBe("t");
    const review = seedBatch(owner, { status: "in_review" });
    sql(setStatus(review, "processing"));
    expect(
      sql(`select finished_at is null from public.import_batches where id = ${lit(review)};`),
    ).toBe("t");
  });

  it("entrar em undone gera auditoria undo_batch", () => {
    const id = seedBatch(owner, { status: "undone" });
    expect(
      sql(
        `select count(*) from public.audit_log where entity_id = ${lit(id)} and action = 'undo_batch';`,
      ),
    ).toBe("1");
  });
});
