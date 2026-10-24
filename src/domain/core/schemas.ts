import { z } from "zod";
import { isInstant, isIsoDate } from "./dates";
import { validation } from "./errors";
import {
  ACCOUNT_TYPES,
  BATCH_INITIATORS,
  CATEGORY_KINDS,
  INSTITUTION_KINDS,
  SOURCES,
  TX_NATURES,
  TX_STATUSES,
} from "./types";

/**
 * Validação de entradas do contrato (zod 4) com os mesmos limites dos CHECK do data-model §2.
 * Falha ⇒ CoreError("validation", field) via `parseInput`.
 */

const id = z.guid();
const cents = z.int();
const isoDate = z.string().refine(isIsoDate, "data inválida");
const instant = z.string().refine(isInstant, "instante inválido");
const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, "vazio");
const smallint = z.int().min(-32768).max(32767);
const day = z.int().min(1).max(31);
const confidence = z.int().min(0).max(100);

export const installmentSchema = z
  .strictObject({
    number: z.int().min(1).max(420),
    total: z.int().min(1).max(420),
    group: z.string().min(1).max(100),
  })
  .refine((value) => value.number <= value.total, { path: ["number"], message: "n > m" });

export const originalSchema = z.strictObject({
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine((value) => value !== "BRL", "moeda original deve ser estrangeira"),
  amountMinor: z.int(),
});

export const incomingTxSchema = z.strictObject({
  accountId: id,
  source: z.enum(SOURCES).exclude(["manual"]),
  externalId: z.string().trim().min(1).max(140).optional(),
  amountCents: cents,
  bookedOn: isoDate,
  occurredAt: instant.optional(),
  descriptionOriginal: z.string().max(500),
  merchant: z.string().max(200).optional(),
  status: z.enum(TX_STATUSES),
  nature: z.enum(TX_NATURES).optional(),
  category: z
    .strictObject({
      id,
      source: z.enum(["rule", "ai", "source"]),
      confidence: confidence.optional(),
    })
    .optional(),
  installment: installmentSchema.optional(),
  original: originalSchema.optional(),
});

export const manualTxInputSchema = z.strictObject({
  accountId: id,
  amountCents: cents,
  bookedOn: isoDate,
  description: z.string().max(500),
  occurredAt: instant.optional(),
  merchant: z.string().max(200).optional(),
  status: z.enum(TX_STATUSES).optional(),
  nature: z.enum(TX_NATURES).optional(),
  relatedTransactionId: id.optional(),
  categoryId: id.nullable().optional(),
  notes: z.string().max(2000).optional(),
  installment: installmentSchema.optional(),
  original: originalSchema.optional(),
});

export const txPatchSchema = z.strictObject({
  description: z.string().max(500).nullable().optional(),
  merchant: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  nature: z.enum(TX_NATURES).optional(),
  relatedTransactionId: id.nullable().optional(),
  category: z.strictObject({ id: id.nullable(), confidence: confidence.optional() }).optional(),
  amountCents: cents.optional(),
  bookedOn: isoDate.optional(),
  accountId: id.optional(),
  status: z.enum(TX_STATUSES).optional(),
  occurredAt: instant.nullable().optional(),
  installment: installmentSchema.nullable().optional(),
  original: originalSchema.nullable().optional(),
});

const accountFields = {
  institutionId: id,
  name: nonBlank(80),
  type: z.enum(ACCOUNT_TYPES),
  nickname: z.string().max(40).optional(),
  last4: z
    .string()
    .regex(/^[0-9]{4}$/)
    .optional(),
  creditLimitCents: cents.min(0).optional(),
  closingDay: day.optional(),
  dueDay: day.optional(),
  openingBalanceCents: cents.optional(),
  openingBalanceOn: isoDate.optional(),
};

export const accountInputSchema = z
  .strictObject({
    ...accountFields,
    source: z.enum(["manual", "pluggy"]),
    externalId: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "pluggy" && !value.externalId) {
      ctx.addIssue({ code: "custom", path: ["externalId"], message: "obrigatório" });
    }
    if (value.source === "manual" && value.externalId) {
      ctx.addIssue({ code: "custom", path: ["externalId"], message: "só pluggy" });
    }
    if (value.type !== "credit_card") {
      for (const field of ["creditLimitCents", "closingDay", "dueDay"] as const) {
        if (value[field] !== undefined) {
          ctx.addIssue({ code: "custom", path: [field], message: "só cartão de crédito" });
        }
      }
    }
    if (value.source !== "manual") {
      for (const field of ["openingBalanceCents", "openingBalanceOn"] as const) {
        if (value[field] !== undefined) {
          ctx.addIssue({ code: "custom", path: [field], message: "só conta manual" });
        }
      }
    }
  });

export const accountPatchSchema = z.strictObject({
  nickname: accountFields.nickname,
  closingDay: accountFields.closingDay,
  dueDay: accountFields.dueDay,
  openingBalanceCents: accountFields.openingBalanceCents,
  openingBalanceOn: accountFields.openingBalanceOn,
  name: accountFields.name.optional(),
  type: accountFields.type.optional(),
  institutionId: id.optional(),
  last4: accountFields.last4,
  creditLimitCents: accountFields.creditLimitCents,
});

export const newInstitutionSchema = z.strictObject({
  name: nonBlank(120),
  kind: z.enum(INSTITUTION_KINDS),
  bankCode: z
    .string()
    .regex(/^[0-9]{3}$/)
    .optional(),
  externalRef: z.string().min(1).max(100).optional(),
});

export const institutionPatchSchema = z.strictObject({
  name: nonBlank(120).optional(),
  kind: z.enum(INSTITUTION_KINDS).optional(),
  bankCode: z
    .string()
    .regex(/^[0-9]{3}$/)
    .optional(),
});

export const newCategorySchema = z
  .strictObject({
    name: nonBlank(60),
    parentId: id.optional(),
    kind: z.enum(CATEGORY_KINDS).optional(),
  })
  .refine((value) => value.parentId !== undefined || value.kind !== undefined, {
    path: ["kind"],
    message: "obrigatório sem pai",
  });

export const categoryPatchSchema = z.strictObject({
  name: nonBlank(60).optional(),
  hidden: z.boolean().optional(),
  parentId: id.nullable().optional(),
  kind: z.enum(CATEGORY_KINDS).optional(),
  sortOrder: smallint.optional(),
});

export const newBatchSchema = z
  .strictObject({
    source: z.enum(SOURCES),
    initiatedBy: z.enum(BATCH_INITIATORS),
    accountId: id.optional(),
    fileName: z.string().min(1).max(255).optional(),
    fileSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    periodStart: isoDate.optional(),
    periodEnd: isoDate.optional(),
  })
  .refine(
    (value) => !value.periodStart || !value.periodEnd || value.periodEnd >= value.periodStart,
    { path: ["periodEnd"], message: "fim antes do início" },
  );

export const txQuerySchema = z.strictObject({
  accountIds: z.array(id).max(200).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  includeDeleted: z.boolean().optional(),
  status: z.enum(TX_STATUSES).optional(),
  limit: z.int().min(1).max(200).optional(),
  cursor: z.string().max(500).nullable().optional(),
});

export const pageOptionsSchema = (max: number) =>
  z.strictObject({
    limit: z.int().min(1).max(max).optional(),
    cursor: z.string().max(500).nullable().optional(),
  });

/** Valida `value`; em falha lança CoreError("validation", <primeiro campo do caminho>). */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const path = result.error.issues[0]?.path ?? [];
  const field = path.find((segment) => typeof segment === "string");
  throw validation(typeof field === "string" ? field : undefined);
}
