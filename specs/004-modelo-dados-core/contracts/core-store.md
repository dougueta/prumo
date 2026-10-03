# Contrato — `CoreStore` (porta de dados core)

**Dona**: feature 004. **Consumidores**: todas as features com dados (005, 007–032).
Arquivo: `src/data/core/ports.ts`. Duas implementações com comportamento idêntico, provado por
`tests/contract/core-store.contract.ts`: `SupabaseCoreStore` (`src/data/core/supabase/`) e
`MemoryCoreStore` (`src/data/core/memory/`). Nenhuma feature acessa as tabelas core por outro
caminho (Constitution VII); leitura analítica pesada futura (017/022) pode ganhar funções
`core_*` novas **propostas nesta feature**.

Todas as operações são assíncronas, escopadas a **um dono** (definido na construção — ver
[owner-context.md](owner-context.md)) e recebem, quando gravam, um `Actor`.

```ts
// Tipos (data-model §6). Cents = inteiro seguro; IsoDate = "YYYY-MM-DD".
type Actor = { type: "user" | "sync" | "import" | "ai" | "rule" | "system"; ref?: string; batchId?: string };
type Page<T> = { items: T[]; nextCursor: string | null };            // cursor opaco (booked_on,id)

interface CoreStore {
  readonly ownerId: OwnerId;
  readonly mode: "supabase" | "memory";

  bootstrap(): Promise<{ createdCategories: number }>;                // FR-029, idempotente

  institutions: {
    list(): Promise<Institution[]>;                                   // catálogo + próprias
    create(input: NewInstitution, actor: Actor): Promise<Institution>;
    update(id: string, patch: InstitutionPatch, actor: Actor): Promise<Institution>;
  };

  accounts: {
    list(opts?: { includeArchived?: boolean }): Promise<Account[]>;
    get(id: string): Promise<Account>;                                // NotFound se de outro dono
    upsert(input: AccountInput, actor: Actor): Promise<Account>;      // manual: sem externalId; pluggy: por (source, externalId)
    update(id: string, patch: AccountPatch, actor: Actor): Promise<Account>;
    setArchived(id: string, archived: boolean, actor: Actor): Promise<Account>;
    setReportedBalance(id: string, cents: Cents, on: IsoDate, actor: Actor): Promise<Account>;
    balances(asOf: IsoDate): Promise<AccountBalance[]>;               // FR-010 (reported, computed, divergence)
  };

  transactions: {
    list(q: TxQuery): Promise<Page<Transaction>>;                     // FR-042
    get(id: string, opts?: { includeDeleted?: boolean }): Promise<Transaction>;
    upsertMany(batchId: string, rows: IncomingTx[], actor: Actor): Promise<UpsertResult>; // FR-021/022, ≤ 1.000/chamada (o repositório fatia)
    createManual(input: ManualTxInput, actor: Actor): Promise<Transaction>;
    update(id: string, patch: TxPatch, actor: Actor): Promise<Transaction>;    // aplica travas (FR-024)
    unlockField(id: string, field: LockableField, actor: Actor): Promise<Transaction>; // FR-025
    softDelete(ids: string[], reason: DeletedReason, actor: Actor, mergedInto?: string): Promise<number>;
    restore(ids: string[], actor: Actor): Promise<number>;
  };

  categories: {
    tree(opts?: { includeHidden?: boolean; includeDeleted?: boolean }): Promise<CategoryNode[]>;
    bySystemKey(key: SystemCategoryKey): Promise<Category>;
    create(input: NewCategory, actor: Actor): Promise<Category>;
    update(id: string, patch: CategoryPatch, actor: Actor): Promise<Category>; // renomear, ocultar, mover
    remove(id: string, opts: { targetId?: string; children: "move" | "delete" }, actor: Actor): Promise<{ reassigned: number }>;
    restore(id: string, actor: Actor): Promise<Category>;
  };

  batches: {
    create(input: NewBatch, actor: Actor): Promise<ImportBatch>;
    findCompletedByFile(accountId: string, sha256: string): Promise<ImportBatch | null>; // FR-034
    finish(id: string, status: "in_review" | "completed" | "failed", actor: Actor, errorSummary?: string): Promise<ImportBatch>;
    undo(id: string, actor: Actor): Promise<{ deleted: number; withManualEdits: number }>; // FR-035
    list(opts?: { limit?: number }): Promise<ImportBatch[]>;
    get(id: string): Promise<ImportBatch>;
  };

  audit: {
    history(entityType: AuditEntityType, entityId: string): Promise<AuditEntry[]>; // FR-043
  };

  exportAll(): AsyncIterable<ExportChunk>;                             // FR-044 (tudo, inclusive excluídos e auditoria)
}
```

## Entradas principais

```ts
type IncomingTx = {                       // o que um conector entrega
  accountId: string;
  source: Exclude<Source, "manual">;
  externalId?: string;                    // ausente ⇒ identidade por impressão digital (R-06)
  amountCents: Cents;                     // perspectiva da conta (FR-016)
  bookedOn: IsoDate;                      // já convertido para America/Sao_Paulo
  occurredAt?: string;                    // ISO-8601 com fuso (instante)
  descriptionOriginal: string;            // ≤ 500
  merchant?: string;
  status: "pending" | "posted";
  nature?: TxNature;
  category?: { id: string; source: "rule" | "ai" | "source"; confidence?: number };
  installment?: { number: number; total: number; group: string };
  original?: { currency: string; amountMinor: number };
};

type UpsertResult = {
  created: number; updated: number; duplicate: number; protected: number; rejected: number;
  results: { index: number; outcome: "created" | "updated" | "duplicate" | "rejected"; id?: string;
             protectedFields?: LockableField[]; error?: { code: CoreErrorCode; field?: string } }[];
};

type TxQuery = {
  accountIds?: string[]; from?: IsoDate; to?: IsoDate;      // inclusivos
  includeDeleted?: boolean;                                 // padrão false (FR-038)
  status?: "pending" | "posted";
  limit?: number;                                           // 1–200, padrão 50
  cursor?: string | null;
};
```

Ordenação de `list`: `bookedOn DESC, id DESC` (estável). Filtros avançados (categoria, valor,
texto) são da 013 e serão adicionados aqui por proposta à 004.

## Erros (`CoreError`, `src/domain/core/errors.ts`)

| `code` | Quando | Origem no banco |
|---|---|---|
| `not_found` | id inexistente **ou de outro dono** (FR-003) | `core.not_found` / 0 linhas |
| `validation` | campo inválido; `field` informa qual (FR-018) | `CHECK`/`core.validation:<campo>` |
| `conflict` | violação de unicidade (nome de categoria, conta externa) | `23505` |
| `forbidden_operation` | excluir categoria de sistema, transição de estado proibida, editar fato de importada, lote fechado | `core.forbidden:<motivo>` |
| `owner_required` | contexto sem dono | `core.owner_required` |
| `unavailable` | banco inacessível/timeout (recuperável) | rede/5xx |

Mensagens nunca incluem valores de outros donos, URLs ou chaves. `unavailable` é o único
erro que o chamador deve tentar de novo.

## Garantias (testadas na bateria de contrato, para as duas implementações)

1. Reenviar o mesmo `IncomingTx[]` ao mesmo lote ou a um lote novo não cria transações (FR-021/022).
2. Campos travados nunca mudam por ator ≠ `user` (FR-024); `unlockField` remove a trava (FR-025).
3. Toda gravação gera `AuditEntry` com ator, ação e `changes` antes/depois (FR-039).
4. `softDelete`/`restore`/`undo` nunca removem dados; `includeDeleted` os enxerga (FR-037/038).
5. Nenhuma operação lê ou altera dados de outro dono (FR-002/003).
6. Somas em centavos inteiros; nenhum valor fracionário aceito (FR-018).
