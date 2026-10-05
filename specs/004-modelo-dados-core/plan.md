# Implementation Plan: Modelo de Dados Core

**Branch**: `004-modelo-dados-core` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-modelo-dados-core/spec.md`

## Summary

Criar o contrato único de dados de finanças: 7 tabelas Postgres (instituições, contas,
transações, categorias, modelos de categoria, lotes de importação, auditoria) com RLS por dono,
constraints, triggers de guarda/proteção/auditoria e funções `core_*` para todas as gravações;
um domínio TypeScript puro com as mesmas regras; a porta `CoreStore` com duas implementações
intercambiáveis (Supabase e memória) validadas por **uma única bateria de testes de contrato**;
o adaptador do `SyntheticDataset` v1 da 001 e a sessão do modo demonstração. Sem telas.
Detalhes e escolhas em [research.md](research.md); schema em [data-model.md](data-model.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS · SQL (Postgres 17 do Supabase)
**Primary Dependencies**: as da 001 — Next.js 16.3, @supabase/supabase-js 2.117, zod 4.6,
`server-only`. Extensão Postgres `unaccent` (já disponível no Supabase). **Nenhuma dependência npm nova.**
**Storage**: Supabase Postgres — 7 tabelas + funções/triggers (dona: 004); memória no modo demonstração
**Testing**: Vitest 5 (unit + contrato em memória; integração + contrato + RLS + desempenho no
Supabase local/CI). Sem E2E nesta feature (não há UI; o modo demonstração é coberto por contrato)
**Target Platform**: servidor Next.js (Vercel) e Supabase; preview sem banco
**Project Type**: web app (Next.js full-stack, projeto único)
**Performance Goals**: 1 mês de extrato (todas as contas) ≤ 1 s com 100 mil transações (SC-007);
upsert de 1.000 linhas ≤ 2 s no Supabase local
**Constraints**: custo R$ 0; dinheiro só em inteiros; nada de DELETE físico; nenhum segredo
no client; owner sempre explícito; mesmo comportamento nas duas implementações
**Scale/Scope**: 1 dono real; ~3.600 transações/ano; 28 features consumidoras

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 004 aprovada (Gate 1, 3 clarificações); branch `004-modelo-dados-core` | ✅ |
| II. Privacidade | RLS + `FORCE RLS` nas 7 tabelas; matriz GRANT/REVOKE explícita (sem DELETE/TRUNCATE; `anon` sem tabela nem função); sem policy de DELETE; só 4 últimos dígitos; chave secreta só em `server-only` com filtro de dono obrigatório; testes só com dados sintéticos e 2 donos sintéticos | ✅ |
| III. Dinheiro exato | `BIGINT *_cents`; `Cents` validado como inteiro seguro; `parseCentsStrict` rejeita fração; `DATE` São Paulo; `TIMESTAMPTZ` UTC; moeda original separada | ✅ |
| IV. Rastreabilidade | `source`, `external_id`, `identity_key`, `batch_id` obrigatórios; unicidade inclui excluídas; auditoria atômica append-only; DELETE físico bloqueado por trigger | ✅ |
| V. Test-first | Toda task de implementação tem teste vermelho antes (inclusive schema, RLS, auditoria e guardas na Phase 2); bateria de contrato roda nas duas implementações no CI | ✅ |
| VI. IA assistente | `category_source` + `category_confidence`; travas impedem IA/regra/sync de sobrescrever edição manual; "Sem categoria" como degradação | ✅ |
| VII. Donos de dados / demo | Todas as tabelas com dona 004 registrada (data-model §1); repositórios Supabase + memória; demo com sessão própria | ✅ |
| VIII. Revisão independente | PR `autor:claude` → revisão Gemini | ✅ |
| IX. Qualidade dos artefatos | data-model tipado com índices/constraints/RLS; contracts; máquinas de estado; algoritmos; Gherkin abaixo | ✅ |
| X. Simplicidade | Sem ORM, sem libs novas; sem UI; filtros avançados/dedup cruzado/faturas ficam com 011/013/018 | ✅ |
| Custo R$ 0 | Só Supabase Free já existente; volume projetado (≪ 500 MB) | ✅ |

**Re-check pós-design**: ✅ sem violações. Uma decisão registrada em Complexity Tracking
(regras duplicadas banco × TS — exigência do ADR 0006).

## Project Structure

### Documentation (this feature)

```text
specs/004-modelo-dados-core/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (core-store.md · owner-context.md)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/core/                    # regras puras, sem I/O (usadas pelas duas implementações)
│   ├── types.ts                    # tipos de domínio + nominais (Cents, IsoDate, OwnerId…)
│   ├── schemas.ts                  # zod: entradas (IncomingTx, ManualTxInput, patches…)
│   ├── money.ts                    # assertCents, parseCentsStrict, sumCents
│   ├── dates.ts                    # isIsoDate, toSaoPauloDate(instant)
│   ├── text.ts                     # normalizeDescription, nameKey
│   ├── identity.ts                 # identityKey(row, occurrence) — R-06 (node:crypto)
│   ├── locks.ts                    # applyPatch(tx, patch, actor) — R-07/R-08
│   ├── state.ts                    # transições de lote e de transação (máquinas do data-model)
│   ├── balances.ts                 # computeBalances — R-09
│   ├── default-categories.ts       # taxonomia (data-model §4) — fonte única
│   └── errors.ts                   # CoreError + mapeamento de erros do banco
├── data/core/
│   ├── index.ts                    # superfície pública: porta, tipos, fábricas, CoreError, DEMO_OWNER_ID
│   ├── ports.ts                    # CoreStore (contracts/core-store.md)
│   ├── context.ts                  # OwnerContext, DEMO_OWNER_ID, registerOwnerContextProvider, getCoreStore
│   ├── synthetic-adapter.ts        # fromSyntheticDataset (data-model §7)
│   ├── memory/memory-store.ts      # MemoryCoreStore
│   ├── memory/demo-sessions.ts     # DemoSessions (LRU 50, TTL 2 h)
│   └── supabase/
│       ├── supabase-store.ts       # SupabaseCoreStore (server-only)
│       └── mappers.ts              # linha ⇄ domínio, cursor
└── proxy.ts                        # + cookie prumo_demo_sid em preview (contracts/owner-context.md)
scripts/generate-category-seed.ts   # gera a migração de seed (R-12)
supabase/migrations/
├── <ts>_core_schema.sql            # extensões, utilitárias, tabelas, índices, guardas (INSERT/UPDATE)
├── <ts>_core_audit.sql             # audit_log, core_audit(), imutabilidade, proibição de DELETE/TRUNCATE
├── <ts>_core_rls.sql               # RLS + FORCE + policies + matriz GRANT/REVOKE (data-model §3)
├── <ts>_core_functions.sql         # funções core_* (data-model §5)
└── <ts>_core_seed_catalog.sql      # gerado: category_templates + catálogo de instituições
tests/
├── contract/core-store.contract.ts # bateria única (describeCoreStoreContract)
├── helpers/supabase-test.ts        # usuários de teste (Admin API), clientes user/service
├── unit/core/                      # domínio, errors, memory-store.contract.test.ts, adapter, demo
├── unit/demo-cookie.test.ts        # cookie prumo_demo_sid no proxy
└── integration/core/               # schema, rls, audit, guards, batch-state, concurrency,
                                    # supabase-store.contract, resilience, synthetic-supabase, perf (*.int.test.ts)
scripts/ci-supabase-env.mjs         # + SUPABASE_PUBLISHABLE_KEY (mascarada; usada só por testes na 004)
```

**Structure Decision**: domínio puro em `src/domain/core/` + adaptadores em `src/data/core/`
(ports & adapters). Outras features importam **somente** `@/data/core` (porta, fábrica, tipos);
importar `supabase/` ou `memory/` diretamente é proibido por regra de lint
(`no-restricted-imports`).

## Design Detalhado

### Padrões
- **Ports & Adapters (Repository)**: `CoreStore` é a porta; Supabase e memória são adaptadores.
- **Contract test suite**: `describeCoreStoreContract(name, makeStore)` parametrizada.
- **Functional core**: regras em funções puras (`applyPatch`, `identityKey`, `computeBalances`,
  `nextBatchStatus`) reutilizadas pela memória; o banco reimplementa as mesmas em
  triggers/funções e a bateria de contrato prova equivalência.
- **Command → Audit**: toda gravação carrega `Actor`; auditoria é efeito colateral atômico.

### Algoritmo — identidade da transação (R-06, FR-021/022)
Divisão de responsabilidade: **TS normaliza e calcula a base; o banco conta a ocorrência e
monta a chave** (a memória faz o mesmo com o mesmo código TS).
1. `row.externalId` presente → `externalId = externalId.trim()` (1..140); chave
   `"ext:" + externalId` (o banco monta e o CHECK garante a coerência).
2. Senão → `norm = normalizeDescription(descriptionOriginal)` (NFKD, remove `\p{M}`,
   maiúsculas, colapsa `\s+`, trim) e
   `fpBase = sha256hex([accountId, bookedOn, String(amountCents), norm].join("|"))`
   (`fingerprintBase(row)` em `identity.ts`; enviado em `p_rows.fp_base`).
3. Ocorrência: o banco (ou a memória) lê `import_batches.fp_occurrences[fpBase]`, soma 1 e
   grava — contagem no **lote inteiro**, ordem de chegada das linhas, mesmo em várias chamadas.
4. Chave: `fpIdentity(fpBase, k) = "fp:" + sha256hex(fpBase + "|" + k)`, idêntica a
   `core_fp_identity` em SQL (teste de equivalência com vetores fixos).
5. Manual: `"man:" + id`.
Motivo de a normalização ficar só em TS: `unaccent` ≠ NFKD; uma única implementação evita
divergência entre memória e Supabase.

### Algoritmo — `applyPatch(existing, patch, actor)` (R-07/R-08, FR-020/024)
1. Se `existing.deletedAt` e o patch não é `restore` → `forbidden_operation:deleted`.
2. Para cada campo do patch:
   a. Campo de fato (`amountCents`, `bookedOn`, `descriptionOriginal`, `occurredAt`,
      `installment*`, `original*`, `accountId`) em transação importada:
      permitido só se `actor.type ∈ {sync, import}` e `existing.status = pending`; senão
      `forbidden_operation:imported_fact` (ator user) ou ignorado (ator automático).
   b. `status`: `posted → pending` → `forbidden_operation:status_regression`.
   c. Campo travável e `actor.type = user` → aplica e adiciona a `lockedFields`
      (categoria: `categorySource = manual`, `categoryConfidence = null`).
   d. Campo travável em `lockedFields` e ator ≠ user → mantém valor antigo e registra em
      `protectedFields`.
3. Retorna `{ next, changes: {campo: {old, new}}, protectedFields }` — `changes` vazio ⇒
   nenhuma gravação nem auditoria.

### Algoritmo — `computeBalances(accounts, txs, asOf)` (R-09, FR-010)
Igual a data-model §5 (`core_account_balances`), somando apenas `posted`, não excluídas,
`openingBalanceOn ≤ bookedOn ≤ d`; `divergence = reported − computed(reportedOn)`.

### Algoritmo — reimportação de lote desfeito (D-C, FR-035)
No upsert, conflito de identidade com transação excluída por `batch_undone` → restaura
(`deleted_at/deleted_reason := null`, auditoria `restore` com `reason='reimport'` e
`batchId` do lote novo), sem mudar fatos nem travas → `outcome = "restored"`,
`count_restored += 1`. Excluídas por outro motivo continuam excluídas (`duplicate`). A regra é
por linha: cobre o mesmo arquivo (decisão do Doug) e também arquivos que se sobrepõem a ele.

### Algoritmo — `undoBatch(id)` (FR-035)
1. Lote do dono em `completed` ou `failed` (senão `forbidden_operation:batch_state`).
2. Seleciona transações `batch_id = id` não excluídas; `withManualEdits` = quantas têm
   `lockedFields ≠ ∅`.
3. `softDelete(ids, "batch_undone")` (desfaz vínculos dependentes) e lote → `undone`, com
   `prumo.action = 'undo_batch'`; tudo numa transação.

### Algoritmo — `removeCategory(id, {targetId, children})` (FR-031)
1. Categoria do dono, não de sistema (senão `forbidden_operation:system_category`) e sem
   filho de sistema (senão `forbidden_operation:system_child`).
2. `target = targetId ?? bySystemKey("uncategorized")`; target não pode ser a própria
   categoria nem filha dela (`validation`); target `uncategorized` ⇒ `category_id = NULL`
   (representação única de "sem categoria").
3. `children = move`: filhos ganham `parent_id = target` se target for de 1º nível e não for
   `uncategorized`; caso contrário viram 1º nível (mantendo seu `kind`); `delete`: filhos
   excluídos logicamente e suas transações reatribuídas ao target.
4. Transações da categoria → `category_id = target` (ou `NULL`) com `prumo.action = 'reassign'`
   (preservando `category_source`; `NULL` ⇒ `category_source = NULL`); categoria →
   `deleted_at = now()` (auditoria `reason='user'`).

### Máquinas de estado
- **Lote** (data-model §2.4): `processing → in_review | completed | failed`;
  `in_review → processing (resume) | failed`; `completed → undone`; `failed → undone`.
  Proibidas: saídas de `undone`; de `completed` ou `failed` para qualquer estado que não
  `undone`; `in_review → completed`. Gravação de transações só em `processing`.
- **Transação**: `pending → posted`; qualquer → excluída (com motivo) → restaurada (volta ao
  status que tinha); `batch_undone` → restaurada também por reimportação (D-C).
  Proibidas: `posted → pending`; DELETE/TRUNCATE físico; restaurar `merged` com sobrevivente
  excluído (`forbidden_operation:merged_survivor_deleted`).
- **Conta**: `ativa ⇄ arquivada`. Proibidas: exclusão; gravar transação em arquivada.
- **Categoria**: `ativa ⇄ oculta`; `ativa → excluída → restaurada`. Proibidas: excluir ou
  mover categoria de sistema; excluir categoria com filho de sistema; dar pai a categoria
  com filhos (3º nível).

### Bibliotecas
- **Permitidas**: as da 001 + `node:crypto` (sha256), `server-only`.
- **Proibidas**: ORMs (Prisma/Drizzle) — schema é SQL versionado da 004; `decimal.js`/float
  para dinheiro; `moment`/`date-fns-tz` (Intl basta); acesso a tabelas core fora de
  `src/data/core/supabase/`; `.delete()` do supabase-js em tabelas core.

### Critérios de aceite (Gherkin, com verificação no banco)

```gherkin
Funcionalidade: Idempotência de importação
  Cenário: Reimportar OFX não duplica
    Dado o dono A com a conta "Conta Aurora (simulada)" e um lote ofx concluído com 120 transações
    Quando reenvio as mesmas 120 linhas em um novo lote
    Então o resultado é created=0, duplicate=120
    E SELECT count(*) FROM transactions WHERE owner_id = A retorna 120
    E o novo lote tem count_duplicate = 120 e status "completed"

  Cenário: Dois cafés idênticos no mesmo CSV
    Dado um lote csv com duas linhas (2026-09-12, -800, "CAFE FICTICIO")
    Quando importo o arquivo em um lote e depois em um lote novo
    Então existem exatamente 2 transações com identity_key distintas iniciadas por "fp:"
    E o segundo lote tem count_duplicate = 2

  Cenário: Cafés idênticos em chamadas diferentes do mesmo lote
    Dado um lote csv em processing
    Quando envio a 1ª linha (2026-09-12, -800, "CAFE FICTICIO") numa chamada e a 2ª, idêntica, em outra
    Então existem 2 transações e fp_occurrences do lote registra 2 para essa base

  Cenário: Reimportar arquivo de lote desfeito restaura (D-C)
    Dado um lote csv de 30 transações desfeito (30 com deleted_reason "batch_undone")
    Quando reimporto o mesmo arquivo em um lote novo
    Então SELECT count(*) FROM transactions WHERE deleted_at IS NULL AND batch_id = <lote antigo> retorna 30
    E o novo lote tem count_restored = 30 e count_created = 0
    E audit_log tem 30 entradas action "restore" com reason "reimport" e batch_id = <lote novo>

  Cenário: Lote em revisão não recebe transações
    Dado um lote pdf em in_review
    Quando chamo upsertMany nesse lote
    Então recebo forbidden_operation:batch_closed e nenhuma linha em transactions
    E após resume o lote volta a processing e aceita a gravação

Funcionalidade: Proteção de edição manual
  Cenário: Sincronização não sobrescreve categoria manual
    Dado uma transação pluggy com categoria "Mercado" definida pelo usuário
    Quando a sincronização envia a mesma transação com categoria "Restaurantes" (source)
    Então category_id continua "Mercado" e locked_fields contém "category_id"
    E o resultado do upsert lista protectedFields ["category_id"]

  Cenário: Pendente confirmada com outro valor
    Dado uma transação pluggy pendente de -5.000 com external_id "P9"
    Quando a sincronização envia "P9" efetivada com -5.250
    Então existe 1 transação "P9" com status posted e amount_cents -5250
    E audit_log tem uma entrada update com changes.amount_cents = {old: -5000, new: -5250}

Funcionalidade: Isolamento
  Cenário: Dono A não enxerga dados do dono B
    Dado os donos A e B, cada um com 1 conta e 10 transações
    Quando A consulta transactions com seu JWT
    Então recebe 10 linhas, todas com owner_id = A
    E update em transação de B afeta 0 linhas e o repositório lança not_found

  Cenário: Sem dono
    Quando chamo core_upsert_transactions com a chave secreta sem p_owner_id
    Então recebo erro owner_required

Funcionalidade: Nada some silenciosamente
  Cenário: DELETE físico é bloqueado
    Quando executo DELETE FROM transactions WHERE id = X com service_role
    Então recebo erro core.hard_delete_forbidden e a linha continua existindo

  Cenário: Auditoria é imutável
    Quando executo UPDATE audit_log SET action = 'create'
    Então recebo erro core.audit_immutable

  Cenário: Desfazer lote
    Dado um lote csv concluído com 30 transações, 2 delas editadas pelo usuário
    Quando desfaço o lote
    Então o retorno é {deleted: 30, withManualEdits: 2}
    E as 30 têm deleted_reason "batch_undone" e o lote status "undone"

  Cenário: TRUNCATE é bloqueado
    Quando executo TRUNCATE transactions como postgres
    Então recebo erro core.hard_delete_forbidden e as linhas continuam existindo

  Cenário: Privilégios mínimos
    Quando consulto has_table_privilege('authenticated', 'public.transactions', 'DELETE')
    Então o resultado é false
    E has_function_privilege('anon', 'public.core_upsert_transactions(uuid,jsonb,uuid,jsonb)', 'EXECUTE') é false

Funcionalidade: Contas e categorias
  Cenário: Sincronização não sobrescreve campo do dono na conta
    Dado uma conta pluggy de cartão com due_day 12 definido pelo usuário
    Quando a sincronização faz upsert da conta com due_day 15
    Então SELECT due_day FROM accounts WHERE id = X retorna 12

  Cenário: Excluir categoria com destino padrão
    Dado a categoria "Lazer" com 3 transações
    Quando a excluo sem destino
    Então as 3 têm category_id NULL e audit_log tem 3 entradas "reassign"
    E categories.deleted_at de "Lazer" não é nulo

  Cenário: Categoria de sistema protegida
    Quando tento excluir "Impostos, tarifas e juros" (contém "Tarifas bancárias" de sistema)
    Então recebo forbidden_operation:system_child

Funcionalidade: Modo demonstração
  Cenário: Mesmo contrato em memória
    Dado APP_ENV=preview
    Quando obtenho getCoreStore()
    Então mode = "memory", há 5 contas e ≥ 12 meses de transações sintéticas
    E a soma de amount_cents é igual à soma de amountCents do dataset da semente 42
```

## Ações externas na implementação
Nenhuma. Migrações chegam à produção pelo job `deploy-db` da 001 após merge (Gate 3).

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Divergência entre triggers SQL e domínio TS | Bateria de contrato única obrigatória no CI para as duas implementações |
| Chave secreta ignorando RLS em jobs | Filtro de dono obrigatório no repositório + `core_resolve_owner` + teste que roda o contrato em modo `service` com 2 donos |
| 006 ainda não mergeada | Ordem de merge da onda 1: 004 → 003 → 006 → 002. Contrato `owner-context.md` (provedor implementado pela 006); 004 não depende de UI/login; testes criam usuários pela Admin API |
| Conflito em `src/proxy.ts` com a 006 | A 004 só acrescenta o cookie demo em preview, sem referenciar a trava da 001; a 006 reescreve preservando-o |
| GRANTs ausentes (CLI 2.119 não expõe objetos novos) | Matriz explícita no data-model §3, testada em T034 |
| Ocorrência `fp:` dependente de chamadas | Contador no lote (`fp_occurrences`), testado em T022/T072 |
| 001 ainda não está na `main` do repositório | Implementação só inicia após merge da 001; rebase da branch antes da Phase 1 |
| Sessões demo perdidas entre instâncias serverless | Aceito e documentado (dados fictícios, selo de demonstração) |
| Mudança de schema pedida por feature futura | Proposta na spec da 004 (Constitution VII); migrações aditivas |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Regras de negócio duplicadas (triggers SQL + domínio TS) | ADR 0006 exige o mesmo contrato sem banco; Constitution II/IV exigem proteção no banco | Só TS deixaria PostgREST/jobs contornar travas e auditoria; só SQL deixaria o modo demonstração sem regras |
