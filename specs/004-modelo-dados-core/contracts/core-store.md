# Contrato — `CoreStore` (porta de dados core)

**Dona**: feature 004. **Consumidores**: todas as features com dados (005, 007–032).
Arquivo: `src/data/core/ports.ts` (tipos em `src/domain/core/types.ts`, schemas zod em
`src/domain/core/schemas.ts`). Duas implementações com comportamento idêntico, provado por
`tests/contract/core-store.contract.ts`: `SupabaseCoreStore` (`src/data/core/supabase/`) e
`MemoryCoreStore` (`src/data/core/memory/`). Nenhuma feature acessa as tabelas core por outro
caminho (Constitution VII); leitura analítica pesada futura (017/022) pode ganhar funções
`core_*` novas **propostas nesta feature**. Exportado por `@/data/core`: a porta, os tipos,
`createCoreStore`, `getCoreStore`, `registerOwnerContextProvider`, `CoreError` e
`DEMO_OWNER_ID` (ver [owner-context.md](owner-context.md)).

Todas as operações são assíncronas, escopadas a **um dono** (definido na construção) e
recebem, quando gravam, um `Actor`. Toda entrada é validada por zod com os limites dos
`CHECK` do data-model; falha ⇒ `CoreError("validation", field)`.

## Tipos

```ts
// Nominais (data-model §6)
type Cents = number;            // Number.isSafeInteger
type IsoDate = string;          // "YYYY-MM-DD" de calendário real, 1900-01-01..2100-12-31
type OwnerId = string;          // UUID (auth.users.id)
type Uuid = string;

type Source = "pluggy" | "csv" | "ofx" | "pdf" | "sheets" | "manual";
type AccountType = "checking" | "digital_wallet" | "credit_card" | "savings" | "investment";
type InstitutionKind = "bank" | "digital_wallet" | "card_issuer" | "broker" | "other";
type TxStatus = "pending" | "posted";
type TxNature = "regular" | "internal_transfer" | "card_payment" | "refund";
type CategorySource = "manual" | "rule" | "ai" | "source";
type CategoryKind = "expense" | "income" | "neutral";
type CategoryOrigin = "system" | "default" | "custom";
type SystemCategoryKey = "uncategorized" | "internal_transfer" | "card_payment" | "salary" | "bank_fees";
type DeletedReason = "user" | "merged" | "batch_undone" | "canceled_at_source";
type BatchStatus = "processing" | "in_review" | "completed" | "failed" | "undone";
type BatchInitiator = "user" | "schedule" | "webhook" | "system";
type LockableField = "description" | "merchant" | "categoryId" | "nature"
  | "relatedTransactionId" | "notes" | "amountCents" | "bookedOn" | "status";
type AuditEntityType = "institution" | "account" | "transaction" | "category" | "import_batch";
type AuditAction = "create" | "update" | "soft_delete" | "restore" | "merge" | "archive"
  | "unarchive" | "undo_batch" | "reassign" | "lock" | "unlock";

type Actor = { type: "user" | "sync" | "import" | "ai" | "rule" | "system"; ref?: string /* ≤100 */; batchId?: Uuid };
type Page<T> = { items: T[]; nextCursor: string | null };   // cursor opaco

// Entidades (espelham as colunas do data-model em camelCase)
type Institution = { id: Uuid; ownerId: OwnerId | null; name: string; kind: InstitutionKind;
  bankCode: string | null; externalRef: string | null; createdAt: string; updatedAt: string };
type Account = { id: Uuid; ownerId: OwnerId; institutionId: Uuid; name: string; nickname: string | null;
  type: AccountType; currency: "BRL"; source: "pluggy" | "manual"; externalId: string | null;
  last4: string | null; creditLimitCents: Cents | null; closingDay: number | null; dueDay: number | null;
  openingBalanceCents: Cents; openingBalanceOn: IsoDate | null;
  reportedBalanceCents: Cents | null; reportedBalanceOn: IsoDate | null;
  archivedAt: string | null; createdAt: string; updatedAt: string };
type Transaction = { id: Uuid; ownerId: OwnerId; accountId: Uuid; batchId: Uuid | null; source: Source;
  externalId: string | null; identityKey: string; amountCents: Cents; bookedOn: IsoDate;
  occurredAt: string | null; descriptionOriginal: string; description: string | null;
  merchant: string | null; status: TxStatus; nature: TxNature; relatedTransactionId: Uuid | null;
  categoryId: Uuid | null;                       // null ⇔ "sem categoria" (única representação)
  categorySource: CategorySource | null; categoryConfidence: number | null; notes: string | null;
  installment: { number: number; total: number; group: string } | null;
  original: { currency: string; amountMinor: number } | null;
  lockedFields: LockableField[]; deletedAt: string | null; deletedReason: DeletedReason | null;
  mergedIntoId: Uuid | null; createdAt: string; updatedAt: string };
type Category = { id: Uuid; ownerId: OwnerId; parentId: Uuid | null; name: string; kind: CategoryKind;
  origin: CategoryOrigin; systemKey: SystemCategoryKey | null; templateKey: string | null;
  hidden: boolean; sortOrder: number; deletedAt: string | null; createdAt: string; updatedAt: string };
type CategoryNode = Category & { children: Category[] };     // 2 níveis
type ImportBatch = { id: Uuid; ownerId: OwnerId; source: Source; accountId: Uuid | null;
  initiatedBy: BatchInitiator; fileName: string | null; fileSha256: string | null;
  periodStart: IsoDate | null; periodEnd: IsoDate | null; status: BatchStatus;
  counts: { read: number; created: number; updated: number; restored: number; duplicate: number;
            protected: number; rejected: number };
  errorSummary: string | null; startedAt: string; finishedAt: string | null };
type AccountBalance = { accountId: Uuid; reportedCents: Cents | null; reportedOn: IsoDate | null;
  computedCents: Cents; computedAtReportedCents: Cents | null; divergenceCents: Cents | null };
type AuditEntry = { id: number; entityType: AuditEntityType; entityId: Uuid; action: AuditAction;
  actor: Actor; reason: string | null; changes: Record<string, { old: unknown; new: unknown }>;
  occurredAt: string };
type ExportChunk =
  | { entity: "institutions"; rows: Institution[] } | { entity: "accounts"; rows: Account[] }
  | { entity: "categories"; rows: Category[] } | { entity: "import_batches"; rows: ImportBatch[] }
  | { entity: "transactions"; rows: Transaction[] } | { entity: "audit_log"; rows: AuditEntry[] };
  // ≤ 500 linhas por chunk; inclui excluídos logicamente; ordem: a ordem do union acima

// Entradas
type NewInstitution = { name: string /* 1..120 */; kind: InstitutionKind; bankCode?: string /* 3 dígitos */; externalRef?: string /* ≤100 */ };
type InstitutionPatch = Partial<Pick<NewInstitution, "name" | "kind" | "bankCode">>;
type AccountInput = {
  institutionId: Uuid; name: string /* 1..80 */; type: AccountType; nickname?: string /* ≤40 */;
  source: "manual" | "pluggy"; externalId?: string /* obrigatório se pluggy, ≤100 */;
  last4?: string /* ^[0-9]{4}$ */; creditLimitCents?: Cents; closingDay?: number; dueDay?: number; // 1..31, só credit_card
  openingBalanceCents?: Cents; openingBalanceOn?: IsoDate;                                      // só manual
};
type AccountPatch = Partial<Pick<AccountInput, "nickname" | "closingDay" | "dueDay"
  | "openingBalanceCents" | "openingBalanceOn" | "name" | "type" | "institutionId" | "last4" | "creditLimitCents">>;
  // partição de campos do data-model §2.3: campo "da fonte" em conta pluggy com ator user ⇒ forbidden_operation:source_field
type IncomingTx = {                       // o que um conector entrega
  accountId: Uuid;
  source: Exclude<Source, "manual">;
  externalId?: string;                    // ≤140; ausente ⇒ identidade por impressão digital (R-06)
  amountCents: Cents;                     // perspectiva da conta (FR-016)
  bookedOn: IsoDate;                      // já convertido para America/Sao_Paulo
  occurredAt?: string;                    // ISO-8601 com fuso (instante)
  descriptionOriginal: string;            // ≤ 500 (pode ser vazia)
  merchant?: string;                      // ≤ 200
  status: TxStatus;
  nature?: TxNature;
  category?: { id: Uuid; source: "rule" | "ai" | "source"; confidence?: number /* 0..100 inteiro */ };
  installment?: { number: number; total: number /* 1..420 */; group: string /* ≤100 */ };
  original?: { currency: string /* ISO 4217 ≠ BRL */; amountMinor: number };
};
type ManualTxInput = {
  accountId: Uuid; amountCents: Cents; bookedOn: IsoDate; description: string /* ≤500 */;
  occurredAt?: string; merchant?: string; status?: TxStatus /* padrão posted */; nature?: TxNature;
  relatedTransactionId?: Uuid; categoryId?: Uuid | null; notes?: string /* ≤2000 */;
  installment?: IncomingTx["installment"]; original?: IncomingTx["original"];
};  // descriptionOriginal = description; identityKey = "man:" + id
type TxPatch = {
  description?: string | null; merchant?: string | null; notes?: string | null;
  nature?: TxNature; relatedTransactionId?: Uuid | null;
  category?: { id: Uuid | null; confidence?: number };   // origem = tipo do ator (user ⇒ manual)
  // só manuais (importadas ⇒ forbidden_operation:imported_fact para ator user):
  amountCents?: Cents; bookedOn?: IsoDate; accountId?: Uuid; status?: TxStatus; occurredAt?: string | null;
  installment?: IncomingTx["installment"] | null; original?: IncomingTx["original"] | null;
};
type NewCategory = { name: string /* 1..60 */; parentId?: Uuid; kind?: CategoryKind /* obrigatório sem pai; com pai é herdado */ };
type CategoryPatch = { name?: string; hidden?: boolean; parentId?: Uuid | null; kind?: CategoryKind; sortOrder?: number };
type NewBatch = { source: Source; initiatedBy: BatchInitiator; accountId?: Uuid; fileName?: string /* ≤255 */;
  fileSha256?: string /* hex 64 */; periodStart?: IsoDate; periodEnd?: IsoDate };
type TxQuery = {
  accountIds?: Uuid[]; from?: IsoDate; to?: IsoDate;       // inclusivos
  includeDeleted?: boolean;                                 // padrão false (FR-038)
  status?: TxStatus;
  limit?: number;                                           // 1–200, padrão 50
  cursor?: string | null;
};
type UpsertResult = {
  created: number; updated: number; restored: number; duplicate: number; protected: number; rejected: number;
  results: { index: number; outcome: "created" | "updated" | "restored" | "duplicate" | "rejected"; id?: Uuid;
             protectedFields?: LockableField[]; error?: { code: CoreErrorCode; field?: string } }[];
};
```

## Porta

```ts
interface CoreStore {
  readonly ownerId: OwnerId;
  readonly mode: "supabase" | "memory";

  bootstrap(): Promise<{ createdCategories: number }>;                // FR-029, idempotente

  institutions: {
    list(): Promise<Institution[]>;                                   // catálogo + próprias
    create(input: NewInstitution, actor: Actor): Promise<Institution>;
    update(id: Uuid, patch: InstitutionPatch, actor: Actor): Promise<Institution>; // catálogo ⇒ not_found
  };

  accounts: {
    list(opts?: { includeArchived?: boolean }): Promise<Account[]>;
    get(id: Uuid): Promise<Account>;
    upsert(input: AccountInput, actor: Actor): Promise<Account>;      // manual: cria; pluggy: por (source, externalId)
    update(id: Uuid, patch: AccountPatch, actor: Actor): Promise<Account>;
    setArchived(id: Uuid, archived: boolean, actor: Actor): Promise<Account>;
    setReportedBalance(id: Uuid, cents: Cents, on: IsoDate, actor: Actor): Promise<Account>;
    balances(asOf: IsoDate): Promise<AccountBalance[]>;               // FR-010
  };

  transactions: {
    list(q: TxQuery): Promise<Page<Transaction>>;                     // FR-042: bookedOn DESC, id DESC
    get(id: Uuid, opts?: { includeDeleted?: boolean }): Promise<Transaction>;
    upsertMany(batchId: Uuid, rows: IncomingTx[], actor: Actor): Promise<UpsertResult>; // FR-021/022; o repositório fatia em 1.000
    createManual(input: ManualTxInput, actor: Actor): Promise<Transaction>;
    update(id: Uuid, patch: TxPatch, actor: Actor): Promise<Transaction>;            // aplica travas (FR-024)
    unlockField(id: Uuid, field: LockableField, actor: Actor): Promise<Transaction>; // FR-025
    softDelete(ids: Uuid[], reason: DeletedReason, actor: Actor, mergedInto?: Uuid): Promise<number>;
    restore(ids: Uuid[], actor: Actor): Promise<number>;
  };

  categories: {
    tree(opts?: { includeHidden?: boolean; includeDeleted?: boolean }): Promise<CategoryNode[]>;
    bySystemKey(key: SystemCategoryKey): Promise<Category>;
    create(input: NewCategory, actor: Actor): Promise<Category>;
    update(id: Uuid, patch: CategoryPatch, actor: Actor): Promise<Category>;          // renomear, ocultar, mover
    remove(id: Uuid, opts: { targetId?: Uuid; children: "move" | "delete" }, actor: Actor): Promise<{ reassigned: number }>;
    restore(id: Uuid, actor: Actor): Promise<Category>;
  };

  batches: {
    create(input: NewBatch, actor: Actor): Promise<ImportBatch>;                     // nasce processing
    findCompletedByFile(accountId: Uuid, sha256: string): Promise<ImportBatch | null>; // FR-034 (só completed)
    finish(id: Uuid, status: "in_review" | "completed" | "failed", actor: Actor, errorSummary?: string): Promise<ImportBatch>;
    resume(id: Uuid, actor: Actor): Promise<ImportBatch>;                            // in_review → processing
    undo(id: Uuid, actor: Actor): Promise<{ deleted: number; withManualEdits: number }>; // completed|failed (FR-035)
    list(opts?: { limit?: number /* 1–200, padrão 50 */; cursor?: string | null }): Promise<Page<ImportBatch>>;
    get(id: Uuid): Promise<ImportBatch>;
  };

  audit: {
    history(entityType: AuditEntityType, entityId: Uuid, opts?: { limit?: number /* 1–500 */; cursor?: string | null }): Promise<Page<AuditEntry>>; // FR-043, mais recente primeiro
  };

  exportAll(): AsyncIterable<ExportChunk>;                             // FR-044 (tudo, inclusive excluídos e auditoria)
}
```

Filtros avançados (categoria, valor, texto) são da 013 e serão adicionados aqui por proposta
à 004.

**Pré-condição de `upsertMany`** (R-06): cada linha do arquivo/sincronização é enviada **uma
única vez por lote**; a ordem de ocorrência entre linhas idênticas sem `externalId` é contada
no lote inteiro (várias chamadas ao mesmo lote continuam a contagem). Para reprocessar, crie um
**lote novo**. Repetir uma chamada que falhou é seguro (ela é revertida inteira).

## Erros (`CoreError`, `src/domain/core/errors.ts`)

| `code` | Quando | Origem no banco (mapeamento em `mapDbError`) |
|---|---|---|
| `not_found` | id inexistente, **de outro dono** ou referência (conta/lote/categoria/relacionada) de outro dono (FR-003) | `core.not_found` / 0 linhas / `23503` (FK composta) |
| `validation` | campo inválido; `field` informa qual (FR-018) | `23514` (CHECK) / `22P02`/`22007`/`22008` / `core.validation:<campo>` |
| `conflict` | violação de unicidade (nome de categoria entre irmãs, conta externa, instituição) | `23505` |
| `forbidden_operation` | ver motivos abaixo; `reason` informa qual | `core.forbidden:<motivo>` / `core.hard_delete_forbidden` |
| `owner_required` | contexto sem dono | `core.owner_required` |
| `unavailable` | banco inacessível, timeout, 5xx (recuperável) | erro de rede/`fetch`, HTTP 5xx, `57014` |

Motivos de `forbidden_operation`: `imported_fact`, `source_field`, `status_regression`,
`deleted`, `batch_closed`, `batch_state`, `system_category`, `system_child`, `depth`,
`merged_survivor_deleted`, `hard_delete`.

Mensagens nunca incluem valores de outros donos, URLs ou chaves. `unavailable` é o único erro
que o chamador deve tentar de novo. Qualquer erro não mapeado vira `unavailable` com log sem dados.

### Erros por operação (além de `owner_required` e `unavailable`, possíveis em todas)

| Operação | Erros |
|---|---|
| `institutions.create/update` | `validation`, `conflict`, `not_found` (update) |
| `accounts.get` | `not_found` |
| `accounts.upsert/update` | `validation`, `conflict`, `not_found` (instituição/conta), `forbidden_operation:source_field` |
| `accounts.setArchived/setReportedBalance` | `not_found`, `validation` |
| `transactions.get/list` | `not_found` (get), `validation` (query/cursor) |
| `transactions.upsertMany` | `not_found` (lote), `forbidden_operation:batch_closed`; erros de linha vão em `results[].error` (`validation`, `not_found`) |
| `transactions.createManual` | `validation`, `not_found` (conta/categoria/relacionada) |
| `transactions.update` | `not_found`, `validation`, `forbidden_operation:imported_fact | status_regression | deleted` |
| `transactions.unlockField` | `not_found`, `validation` (campo) |
| `transactions.softDelete` | `not_found` (qualquer id ⇒ nada é alterado), `validation` (`merged` sem `mergedInto`) |
| `transactions.restore` | `not_found`, `forbidden_operation:merged_survivor_deleted` |
| `categories.create/update` | `validation`, `conflict`, `not_found` (pai), `forbidden_operation:depth | system_category` |
| `categories.remove` | `not_found`, `forbidden_operation:system_category | system_child`, `validation` (destino = a própria ou filha) |
| `categories.restore` | `not_found`, `conflict` |
| `batches.create` | `validation`, `not_found` (conta) |
| `batches.finish/resume/undo` | `not_found`, `forbidden_operation:batch_state` |
| `batches.get/list`, `audit.history`, `findCompletedByFile` | `not_found` (get), `validation` |

## Garantias (testadas na bateria de contrato, para as duas implementações)

1. Reenviar o mesmo `IncomingTx[]` em um **lote novo** não cria transações (FR-021/022); duas
   linhas idênticas legítimas no mesmo lote, em chamadas diferentes, geram duas transações.
2. Campos travados nunca mudam por ator ≠ `user` (FR-024); `unlockField` remove a trava (FR-025).
3. Toda gravação gera `AuditEntry` com ator, ação e `changes` antes/depois (FR-039).
4. `softDelete`/`restore`/`undo` nunca removem dados; `includeDeleted` os enxerga (FR-037/038).
5. Reimportar linhas de lote desfeito as restaura (`restored`), por linha, inclusive em arquivo sobreposto — D-C (FR-035).
6. Nenhuma operação lê ou altera dados de outro dono (FR-002/003).
7. Somas em centavos inteiros; nenhum valor fracionário aceito (FR-018).
