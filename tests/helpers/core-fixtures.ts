import { createHash, randomUUID } from "node:crypto";
import { lit, sql, sqlTry } from "./supabase-test";

/**
 * 004 — fixtures SQL (papel postgres, ator "system") para testes de schema, guardas, RLS e
 * auditoria. Só dados sintéticos. Cada função devolve o id criado.
 */

export const CATALOG_OTHER = "00000000-0000-4000-a000-000000000999";

const last = (out: string) => out.trim().split(/\r?\n/).pop() ?? "";
const val = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : lit(value);

export function seedAccount(
  ownerId: string,
  opts: {
    type?: string;
    source?: "manual" | "pluggy";
    externalId?: string;
    archived?: boolean;
  } = {},
): string {
  const source = opts.source ?? "manual";
  const externalId = opts.externalId ?? (source === "pluggy" ? `acc-${randomUUID()}` : null);
  return last(
    sql(`insert into public.accounts (owner_id, institution_id, name, type, source, external_id, archived_at)
values (${lit(ownerId)}, ${lit(CATALOG_OTHER)}, 'Conta Fictícia', ${lit(opts.type ?? "checking")},
  ${lit(source)}, ${val(externalId)}, ${opts.archived ? "now()" : "NULL"}) returning id;`),
  );
}

export function seedBatch(
  ownerId: string,
  opts: { source?: string; status?: string; accountId?: string } = {},
): string {
  const status = opts.status ?? "processing";
  const path: Record<string, string[]> = {
    processing: [],
    in_review: ["in_review"],
    completed: ["completed"],
    failed: ["failed"],
    undone: ["completed", "undone"],
  };
  const id = last(
    sql(`insert into public.import_batches (owner_id, source, account_id, initiated_by)
values (${lit(ownerId)}, ${lit(opts.source ?? "csv")}, ${val(opts.accountId)}, 'system') returning id;`),
  );
  for (const next of path[status]) {
    sql(`update public.import_batches set status = ${lit(next)} where id = ${lit(id)};`);
  }
  return id;
}

export const randomFpKey = () => `fp:${createHash("sha256").update(randomUUID()).digest("hex")}`;

export type TxSeed = {
  source?: string;
  batchId?: string | null;
  externalId?: string;
  identityKey?: string;
  amountCents?: number;
  bookedOn?: string;
  status?: string;
  description?: string;
  categoryId?: string | null;
  categorySource?: string | null;
  relatedId?: string | null;
  extra?: Record<string, string | number | null>;
};

/** INSERT de transação (sem RETURNING interpretado): devolve o SQL para testes de erro. */
export function txInsertSql(ownerId: string, accountId: string, seed: TxSeed = {}): string {
  const source = seed.source ?? (seed.batchId ? "csv" : "manual");
  const identityKey =
    seed.identityKey ??
    (seed.externalId
      ? `ext:${seed.externalId}`
      : source === "manual"
        ? `man:${randomUUID()}`
        : randomFpKey());
  const extra = seed.extra ?? {};
  const columns = [
    "owner_id",
    "account_id",
    "batch_id",
    "source",
    "external_id",
    "identity_key",
    "amount_cents",
    "booked_on",
    "description_original",
    "status",
    "category_id",
    "category_source",
    "related_transaction_id",
    ...Object.keys(extra),
  ];
  const values = [
    lit(ownerId),
    lit(accountId),
    val(seed.batchId ?? null),
    lit(source),
    val(seed.externalId ?? null),
    lit(identityKey),
    String(seed.amountCents ?? -800),
    lit(seed.bookedOn ?? "2026-09-12"),
    lit(seed.description ?? "CAFE FICTICIO"),
    lit(seed.status ?? "posted"),
    val(seed.categoryId ?? null),
    val(seed.categorySource ?? (seed.categoryId ? "rule" : null)),
    val(seed.relatedId ?? null),
    ...Object.values(extra).map(val),
  ];
  return `insert into public.transactions (${columns.join(", ")}) values (${values.join(", ")}) returning id;`;
}

export function seedTx(ownerId: string, accountId: string, seed: TxSeed = {}): string {
  return last(sql(txInsertSql(ownerId, accountId, seed)));
}

export function seedCategory(
  ownerId: string,
  opts: { name: string; kind?: string; origin?: string; systemKey?: string; parentId?: string },
): string {
  return last(
    sql(`insert into public.categories (owner_id, parent_id, name, kind, origin, system_key)
values (${lit(ownerId)}, ${val(opts.parentId)}, ${lit(opts.name)}, ${lit(opts.kind ?? "expense")},
  ${lit(opts.origin ?? (opts.systemKey ? "system" : "custom"))}, ${val(opts.systemKey)}) returning id;`),
  );
}

/** Espera erro de SQL cuja mensagem casa com `pattern`. */
export function sqlError(query: string): string {
  const result = sqlTry(query);
  if (result.ok) throw new Error(`SQL deveria falhar: ${query}`);
  return result.err;
}
