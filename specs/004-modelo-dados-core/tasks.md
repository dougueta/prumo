# Tasks: Modelo de Dados Core

**Input**: `specs/004-modelo-dados-core/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e **falha** antes da task de
implementação que o faz passar; toda task de implementação cita o(s) teste(s) que a
precedem ("até Txxx passar"). Isso vale também para schema, RLS, auditoria e guardas (Phase 2).
**Bateria de contrato**: `tests/contract/core-store.contract.ts` cresce a cada história e roda
contra memória (unit) **e** Supabase (integration). Uma task de contrato só fecha quando passa
nas duas.
**Remediação pós-analyze 2026-10-05**: IDs T001–T063 mantidos (alguns movidos de fase, marcados
"↑ movida"); novas tasks T064–T075.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto

---

## Phase 1: Setup

- [x] T064 Atualizar `docs/roadmap.md`: status da 004 → `impl` (decisão transversal 14), no primeiro commit da implementação
- [x] T001 Rebase da branch `004-modelo-dados-core` sobre a `main` com a 001 e a emenda da constitution v1.1.0 integradas; confirmar `npm run check` e `npm run test:integration` verdes antes de qualquer mudança
- [x] T065 [P] Teste (vermelho): `tests/unit/core/lint-boundaries.test.ts` roda ESLint (API `ESLint`) sobre fixtures em `tests/fixtures/lint/` com `import "@/data/core/supabase/supabase-store"` fora de `src/data/core/**` e `.from("transactions").delete()` e espera erro das duas regras
- [x] T002 Regra ESLint `no-restricted-imports`: fora de `src/data/core/**`, proibir `@/data/core/supabase/*` e `@/data/core/memory/*`; proibir `.from("<tabela core>").delete` via `no-restricted-syntax` — `eslint.config.mjs` (plan §Bibliotecas) até T065 passar
- [x] T003 [P] `scripts/ci-supabase-env.mjs` passa a exportar também `SUPABASE_PUBLISHABLE_KEY` (mascarada; na 004 usada só por testes — nome único da onda 1) + helper `tests/helpers/supabase-test.ts`: `createTestOwner()` (Admin API, e-mail `owner-<uuid>@example.test`), `userClient(owner)` (login por senha → JWT; chave de `SUPABASE_PUBLISHABLE_KEY` ou `supabase status -o env`), `serviceClient()`, `resetCore()` (R-15)

## Phase 2: Foundational (bloqueia todas as histórias)

### Domínio puro — testes (vermelho)
- [x] T004 [P] Testes de `money.ts`: `assertCents` (inteiro seguro), `parseCentsStrict("12,34")=1234`, rejeita `"12,345"`, `NaN`, `1.5`, texto, nulo; aceita `0`; `sumCents` — `tests/unit/core/money.test.ts` (FR-018)
- [x] T005 [P] Testes de `dates.ts`: `isIsoDate` (calendário real, 1900–2100; data futura válida aceita), `toSaoPauloDate("2026-10-01T02:30:00Z") = "2026-09-30"` — `tests/unit/core/dates.test.ts` (FR-013, US1 cenário 6)
- [x] T006 [P] Testes de `text.ts`: `normalizeDescription` (NFKD, sem diacríticos, maiúsculas, espaços), `nameKey("Alimentação ") = "alimentacao"` — `tests/unit/core/text.test.ts` (FR-022, FR-032)
- [x] T066 [P] Testes de `errors.ts` (`mapDbError`): `core.not_found`/0 linhas/`23503` → `not_found`; `23505` → `conflict`; `23514`/`22P02`/`22007`/`22008`/`core.validation:<campo>` → `validation` com `field`; `core.forbidden:<motivo>` e `core.hard_delete_forbidden` → `forbidden_operation` com `reason`; `core.owner_required` → `owner_required`; erro de rede/5xx/`57014`/não mapeado → `unavailable`; mensagem nunca contém URL/chave/valores — `tests/unit/core/errors.test.ts` (FR-003, FR-018; edge case offline)
- [x] T067 [P] Testes de `schemas.ts` (zod 4): limites de `IncomingTx`, `ManualTxInput`, `TxPatch`, `AccountInput`, `AccountPatch`, `NewInstitution`, `NewCategory`, `CategoryPatch`, `NewBatch`, `TxQuery` iguais aos `CHECK` do data-model (500/200/2000 chars, parcela 1..420 com n ≤ m, moeda original ≠ BRL, confiança 0..100, `last4`, dias 1..31, `limit` 1..200) — `tests/unit/core/schemas.test.ts` (FR-013, FR-015, FR-018)

### Domínio puro — implementação
- [x] T007 Implementar `src/domain/core/{types,money,dates,text,errors}.ts` (tipos de contracts/core-store.md §Tipos; `CoreError` com códigos e motivos de §Erros) até T004–T006 e T066 passarem
- [x] T008 Implementar `src/domain/core/schemas.ts` até T067 passar

### Taxonomia
- [x] T009 [P] Teste: `default-categories.ts` tem 15 despesas, 5 receitas, 3 neutras + "Sem categoria"; 75 subcategorias; system keys `uncategorized, internal_transfer, card_payment, salary, bank_fees` (`bank_fees` subcategoria de "Impostos, tarifas e juros"); só #21, #22 e `uncategorized` neutras de sistema; nomes únicos por irmãos (`nameKey`) — `tests/unit/core/default-categories.test.ts` (FR-029)
- [x] T068 [P] Teste: `scripts/generate-category-seed.ts` gera SQL determinístico com 99 `category_templates` e 11 instituições de catálogo (UUIDs `…000000000NNN`, "Outra instituição" = `999`); `--check` falha se a migração versionada divergir — `tests/unit/core/category-seed.test.ts` (FR-005, FR-029, R-12)
- [x] T010 Implementar `src/domain/core/default-categories.ts` (data-model §4) e `scripts/generate-category-seed.ts` até T009 e T068 passarem

### Banco (dona 004) — testes de integração (vermelho)
- [x] T069 [P] Teste de schema — `tests/integration/core/schema.int.test.ts`: após `supabase db reset`, as 7 tabelas existem com colunas/tipos do data-model §2 (`BIGINT *_cents`, `DATE`, `TIMESTAMPTZ`); CHECKs: `currency='BRL'`, `last4`, coerência `ext:`/`external_id`, `man:`/`manual`, parcelas, `deleted_reason`↔`merged_into_id`, `category_id`↔`category_source`; índices (incl. `tx_owner_date_idx`, `tx_identity_uq`); 99 templates e 11 instituições de catálogo; `core_fp_identity(base, k)` = `fpIdentity` de TS para 3 vetores fixos; migrações com nome `<timestamp>_core_*.sql` (FR-004, FR-005, FR-007–FR-009, FR-012–FR-015, FR-021, FR-048)
- [x] T034 [P] [US3] ↑ movida — Teste RLS e privilégios com JWT (dono A × B) nas 7 tabelas: SELECT só próprias; INSERT com `owner_id` alheio recusado; UPDATE alheio afeta 0 linhas; DELETE negado; catálogo de instituições e templates legíveis; `has_table_privilege`: `authenticated`/`service_role` sem `DELETE`/`TRUNCATE`, `anon` sem nenhum privilégio; `has_function_privilege`: `anon` sem `EXECUTE` em `core_*`, funções de trigger sem `EXECUTE` para os papéis da API; premissa `postgres` BYPASSRLS verificada (`pg_roles.rolbypassrls`) — `tests/integration/core/rls.int.test.ts` (FR-001–FR-003, SC-003)
- [x] T035 [P] [US3] ↑ movida — Teste de `core_resolve_owner`: JWT rejeita `p_owner_id` divergente (`not_found`); service exige `p_owner_id`; sem nenhum → `owner_required` — `tests/integration/core/rls.int.test.ts` (FR-002)
- [x] T047 [P] [US5] ↑ movida — Teste de integração: `UPDATE/DELETE/TRUNCATE` em `audit_log` falham para `service_role`, `authenticated` e `postgres`; `DELETE` físico e `TRUNCATE` em contas/transações/categorias/lotes/instituições/templates falham com `core.hard_delete_forbidden`; INSERT/UPDATE direto em `transactions` gera `audit_log` na mesma transação e uma falha posterior na mesma transação não deixa auditoria órfã (atomicidade) — `tests/integration/core/audit.int.test.ts` (FR-036, FR-037, FR-040, SC-004)
- [x] T027 [US1] ↑ movida — Teste de integração do trigger `transactions_guard` em INSERT: `source≠manual` sem lote; lote de outra `source` ou fora de `processing`; conta arquivada; `identity_key` fora do formato ou `ext:` incoerente com `external_id`; moeda original `BRL`; `related_transaction_id` excluída → erro; `category_id` = `uncategorized` gravado como `NULL` — `tests/integration/core/guards.int.test.ts` (FR-014, FR-015, FR-021)
- [x] T070 [P] Teste de integração do `import_batches_state_guard`: transições permitidas e proibidas do data-model §2.4 (incl. `in_review → processing` permitida, `failed → undone` permitida, `in_review → completed` e qualquer saída de `undone` proibidas, INSERT só `processing` com contadores zerados, `finished_at` preenchido) — `tests/integration/core/batch-state.int.test.ts` (FR-033, FR-035)

### Banco — implementação
- [x] T011 Migração `<ts>_core_schema.sql`: `unaccent`, `core_name_key`, `core_fp_identity`, `core_resolve_owner`, `core_current_actor`, 6 tabelas de dados + `category_templates` com todas as colunas, `CHECK`, FKs compostas e índices do data-model §2; triggers `core_touch_updated_at`, `transactions_guard` (INSERT; data-model §2.6) e `import_batches_state_guard` até T069, T027 e T070 passarem (exceto partes que dependem de T013)
- [x] T012 Migração `<ts>_core_audit.sql`: `audit_log`, `core_audit()` (`SECURITY DEFINER`, `search_path=''`, `changes` só de colunas alteradas, ação derivada conforme data-model §2.7), triggers `AFTER INSERT/UPDATE` nas 5 tabelas, `audit_log_immutable` (UPDATE/DELETE/TRUNCATE), `core_forbid_delete` e `core_forbid_truncate` (data-model §2.8) até T047 passar
- [x] T013 Migração `<ts>_core_rls.sql`: `ENABLE` + `FORCE ROW LEVEL SECURITY` nas 7 tabelas, policies e matriz GRANT/REVOKE do data-model §3 até T034 e T035 passarem
- [x] T014 Gerar e versionar `<ts>_core_seed_catalog.sql` via T010; `supabase db reset` local sem erros até T069 passar por completo

### Porta, contexto e esqueletos
- [x] T015 `src/data/core/ports.ts` (interface `CoreStore` de contracts/core-store.md) e `src/data/core/index.ts` (exporta só porta, tipos, `createCoreStore`, `getCoreStore`, `registerOwnerContextProvider`, `CoreError`, `DEMO_OWNER_ID`) — verificado por T065/T016
- [x] T016 [P] Teste de `context.ts`: `createCoreStore` por `kind`; `DEMO_OWNER_ID = "00000000-0000-4000-8000-00000000d3e0"` exportado por `@/data/core`; `getCoreStore()` com provedor registrado usa `current()` (`user` e `demo`); sem provedor em preview → `mode="memory"` com dono `DEMO_OWNER_ID` e `sessionId` do cookie `prumo_demo_sid`; sem provedor em local/production → `owner_required` — `tests/unit/core/context.test.ts` (contracts/owner-context.md)
- [x] T017 Implementar `src/data/core/context.ts` até T016 passar
- [x] T018 Bateria de contrato vazia parametrizada `describeCoreStoreContract(name, makeStore: () => Promise<{ store; other }>)` (dois donos por execução) + runners `tests/unit/core/memory-store.contract.test.ts` e `tests/integration/core/supabase-store.contract.int.test.ts` (rodando modos `user` e `service`) — `tests/contract/core-store.contract.ts` (FR-045, FR-046, SC-005)
- [x] T071 Caso de contrato (vermelho): "bootstrap idempotente cria 99 categorias; 2ª chamada cria 0; `categories.tree()` vazio dispara bootstrap preguiçoso" — `tests/contract/core-store.contract.ts` (FR-029)
- [x] T019 Esqueletos `src/data/core/memory/memory-store.ts` e `src/data/core/supabase/{supabase-store,mappers}.ts` (`server-only`; mapeamento `LockableField` camelCase ⇄ snake_case) implementando `bootstrap()` (memória: copia taxonomia; Supabase: `core_bootstrap_owner` em `<ts>_core_functions.sql`) até T071 passar nas duas

**Checkpoint**: schema aplicado com RLS/GRANTs/auditoria testados, porta definida, contrato rodando nas duas implementações.

---

## Phase 3: US1 — Contrato único e confiável de transações (P1) 🎯 MVP

**Independent Test**: gravar um lote sintético, regravar em lote novo, contagem inalterada e lote com `duplicate = n`.

### Testes (escrever primeiro)
- [x] T020 [P] [US1] Teste de `identity.ts`: `fingerprintBase` determinística e sensível a conta/data/valor/descrição normalizada (acento/espaço/caixa irrelevantes); `fpIdentity(base, k)` = `"fp:" + sha256(base|k)`; `OccurrenceCounter` (memória) conta por base no lote inteiro, inclusive entre chamadas — `tests/unit/core/identity.test.ts` (FR-021, FR-022)
- [ ] T021 [P] [US1] Teste de `state.ts` (lote): transições permitidas e proibidas do data-model §2.4 (incl. `resume`, `failed → undone`); gravação só em `processing` — `tests/unit/core/batch-state.test.ts` (FR-033)
- [ ] T022 [US1] Contrato US1: upsert cria com todos os campos; reenvio em **lote novo** = 0 criadas/`duplicate=n`; CSV sem id idempotente; 2 cafés no mesmo arquivo → 2 transações, inclusive enviados em **chamadas diferentes do mesmo lote**; mesmo `externalId` em contas diferentes → 2 transações; valor zero e data futura aceitos; descrição original vazia preservada; fração de centavo/data inválida/parcela n>m → `rejected` com `field`; conta arquivada → `rejected`; transação importada exige lote; lote `in_review` → `forbidden_operation:batch_closed` e, após `resume`, aceita; reimportar excluída por `user` não ressuscita; `findCompletedByFile` (só `completed`); lote com contadores (incl. `protected`); `batches.list/get` paginados; `list` ordenado `bookedOn DESC, id DESC` com cursor — `tests/contract/core-store.contract.ts` (FR-013–FR-018, FR-021, FR-022, FR-033, FR-034, FR-042, FR-043)
- [ ] T072 [US1] Teste de integração de resiliência do lote: chamada N que falha (linha que aborta a transação simulada) é revertida inteira, inclusive `fp_occurrences`, e as chamadas anteriores permanecem; `finish(failed)` guarda contadores parciais; reprocessar em lote novo não duplica; duas chamadas concorrentes ao mesmo lote são serializadas (`FOR UPDATE` do lote) sem perder ocorrências — `tests/integration/core/resilience.int.test.ts` (FR-022, FR-033; edge case falha no meio)

### Implementação
- [ ] T023 [US1] `src/domain/core/identity.ts` e `src/domain/core/state.ts` até T020–T021 passarem
- [ ] T024 [US1] Funções `core_create_batch`, `core_finish_batch`, `core_resume_batch`, `core_find_completed_batch_by_file` e `core_upsert_transactions` (formato de `p_rows` e algoritmo do data-model §5, ramos `created/updated/duplicate/protected/rejected`) em `<ts>_core_functions.sql` até a parte Supabase de T022 e T072 passar
- [ ] T025 [US1] `MemoryCoreStore`: `batches.*` (exceto `undo`), `transactions.upsertMany/list/get` com o mesmo contador de ocorrências até a parte memória de T022 passar
- [ ] T026 [US1] `SupabaseCoreStore`: mesmas operações via `rpc()` (cálculo de `fp_base` em TS, fatiamento em 1.000 linhas, `mapDbError`, cursor opaco) até a parte Supabase de T022 passar

**Checkpoint**: conectores (007/009) já podem gravar de forma idempotente.

---

## Phase 4: US2 — Edições manuais nunca são perdidas (P1)

**Independent Test**: editar descrição/categoria, reimportar com valores diferentes, edição permanece e auditoria registra ambas.

### Testes
- [ ] T028 [P] [US2] Teste de `locks.ts` (`applyPatch`): usuário trava campo; ator automático preserva campo travado e reporta `protectedFields`; fato de importada → `forbidden_operation:imported_fact` (user) / ignorado (auto); categoria manual zera confiança; "sem categoria" manual trava `categoryId` com `null`; atribuir `uncategorized` normaliza para `null`; `changes` vazio não grava — `tests/unit/core/locks.test.ts` (FR-020, FR-024, FR-026)
- [ ] T029 [US2] Contrato US2: cenários 1–4 da spec (descrição editada preservando original; categoria manual resiste a sync/regra/IA via `upsertMany` e `update`; categoria `ai` atualizável com confiança; `unlockField` libera) — `tests/contract/core-store.contract.ts` (FR-024–FR-026)
- [ ] T033 [US2] ↑ antes da implementação — Teste de integração: `UPDATE` direto via PostgREST com JWT trava o campo (ator padrão `user`); `UPDATE` com `prumo.actor={"type":"ai"}` em campo travado mantém valor; `posted → pending` → `core.forbidden:status_regression` — `tests/integration/core/guards.int.test.ts` (R-07, FR-024)
- [ ] T073 [US2] Teste de integração de concorrência: sync (`upsertMany` de pendente atualizada) e edição manual (`update`) na mesma transação em duas conexões simultâneas — a edição manual prevalece nos campos que alterou, os fatos da fonte são aplicados, as duas ações aparecem na auditoria — `tests/integration/core/concurrency.int.test.ts` (FR-024, edge case gravação concorrente)

### Implementação
- [ ] T030 [US2] `src/domain/core/locks.ts` até T028 passar
- [ ] T031 [US2] Trigger `transactions_guard` BEFORE UPDATE (matriz de campos do data-model §2.6, travas, `posted→pending` proibido, normalização de "sem categoria") + funções `core_update_transaction`, `core_unlock_field` até T033 e T073 passarem
- [ ] T032 [US2] `transactions.update/unlockField` em memória e Supabase até T029 passar nas duas

---

## Phase 5: US3 — Isolamento e privacidade (P1)

**Independent Test**: dois donos sintéticos; nenhuma operação de um alcança o outro; sem dono → recusa.
(T034 e T035 — RLS, privilégios e `core_resolve_owner` — foram movidas para a Phase 2.)

### Testes
- [ ] T036 [US3] Contrato US3: com `store` (A) e `other` (B), `get/update/softDelete/restore` de id de B → `not_found`; `list`/`tree`/`batches.list`/`audit.history` nunca retornam B; vincular conta/categoria/lote/relacionada de B → `not_found` (FK composta, `23503`); `last4` aceita só 4 dígitos e nenhum campo aceita número completo — `tests/contract/core-store.contract.ts` (FR-001–FR-004, SC-003)

### Implementação
- [ ] T037 [US3] Garantir filtro `owner_id` explícito em toda consulta do `SupabaseCoreStore` (helper `scoped(table)`), e passagem de `p_owner_id` em modo `service`, até T036 passar em `user` e `service`
- [ ] T038 [US3] Memória: todas as coleções indexadas por dono; ids alheios → `not_found` até T036 passar

---

## Phase 6: US4 — Cadastro e manutenção manual (P2)

**Independent Test**: criar conta manual, lançar 3 transações, editar, excluir, restaurar, criar subcategoria e reatribuir.

### Testes
- [ ] T039 [P] [US4] Teste de `balances.ts`: `computed` só `posted` não excluídas dentro de `opening_on..asOf`; `divergence` na data reportada; contas sem saldo reportado → `null`; cartão: compras negativas e pagamento positivo somam no sinal da conta — `tests/unit/core/balances.test.ts` (FR-010, FR-016)
- [ ] T040 [US4] Contrato US4 — contas: criar manual (cartão com limite/fechamento/vencimento), campos de cartão recusados em outros tipos, moeda ≠ BRL recusada, `upsert` pluggy idempotente por `(source, externalId)`, **partição de campos** (sync não altera `nickname`/`closingDay`/`dueDay`; usuário recebe `forbidden_operation:source_field` ao editar `name`/`creditLimitCents` de conta pluggy), arquivar/desarquivar mantém histórico, `setReportedBalance` + `balances`, `institutions.list/create/update` (catálogo não editável) — `tests/contract/core-store.contract.ts` (FR-005–FR-012, FR-024, FR-043)
- [ ] T041 [US4] Contrato US4 — transações manuais: criar, editar valor/data/conta, excluir (`user`), restaurar (volta ao status anterior); natureza + `relatedTransactionId` e desfazimento do vínculo ao excluir a contrapartida (natureza volta a `regular`, auditado); `softDelete(merged, mergedInto)` e restaurar `merged` com sobrevivente excluído → `forbidden_operation:merged_survivor_deleted`; convenção de sinal em cartão — `tests/contract/core-store.contract.ts` (FR-016, FR-017, FR-019, FR-023, FR-037, FR-038)
- [ ] T042 [US4] Contrato US4 — categorias: árvore 2 níveis, herança de `kind`, renomear reflete nas transações, nome único sem acento/caixa entre irmãs, ocultar, mover; categoria com filhos não ganha pai (`depth`); sistema não excluível nem movível; categoria com filho de sistema não excluível (`system_child`); excluir com destino (padrão "Sem categoria" ⇒ `categoryId null`) e `children: move|delete`; restaurar reativa sem desfazer reatribuição e revalida nome (`conflict`) — `tests/contract/core-store.contract.ts` (FR-027–FR-032, FR-043)

### Implementação
- [ ] T043 [US4] `src/domain/core/balances.ts` até T039 passar
- [ ] T044 [US4] Funções SQL `core_upsert_account`, `core_archive_account`, `core_set_reported_balance`, `core_account_balances`, `core_create_manual_transaction`, `core_soft_delete_transactions`, `core_restore_transactions`, `core_create_category`, `core_update_category`, `core_delete_category`, `core_restore_category`, triggers `accounts_guard` (partição de campos) e `categories_guard` (data-model §2.3/§2.5) até a parte Supabase de T040–T042 passar
- [ ] T045 [US4] `accounts.*`, `institutions.*`, `transactions.createManual/softDelete/restore`, `categories.*` em memória até a parte memória de T040–T042 passar
- [ ] T046 [US4] Mesmas operações no `SupabaseCoreStore` até T040–T042 passarem nas duas

---

## Phase 7: US5 — Trilha de auditoria (P2)

**Independent Test**: criar, editar, recategorizar automaticamente, excluir, restaurar e desfazer lote — cada ação com entrada de auditoria completa.
(T047 — imutabilidade, DELETE/TRUNCATE e atomicidade — foi movida para a Phase 2.)

### Testes
- [ ] T048 [US5] Contrato US5: `audit.history` (paginado, mais recente primeiro) traz `create/update/soft_delete/restore/merge/archive/unarchive/reassign/undo_batch/unlock` com ator, `batchId`, `reason` e `changes` antes/depois; `undo_batch` só ao entrar em `undone`; nenhum campo de segredo; `undo` de lote concluído com 2 editadas → `{deleted, withManualEdits: 2}` e lote `undone`; `undo` de lote `failed`; `undo` de `in_review`/`undone` → `batch_state`; **reimportar o mesmo arquivo após undo → `restored = n`, `created = 0`, auditoria `restore` com `reason='reimport'` e `batchId` do lote novo; arquivo sobreposto restaura por linha (só as linhas coincidentes com `batch_undone`; excluídas por `user` seguem `duplicate`)** (D-C, por linha); restaurar manualmente após undo — `tests/contract/core-store.contract.ts` (FR-035, FR-039, FR-041, FR-043, US5 cenários 3–5)

### Implementação
- [ ] T049 [US5] Função `core_undo_batch` (`completed|failed`), `core_list_audit` e ramo `restored` de `core_upsert_transactions` (data-model §5) + `audit.history` no `SupabaseCoreStore` até a parte Supabase de T048 passar
- [ ] T050 [US5] Auditoria em memória (mesmo formato de `changes`, mesmas ações derivadas e `reason`) + `batches.undo` + ramo `restored` do `upsertMany` até T048 passar nas duas

---

## Phase 8: US6 — Modo demonstração com o mesmo contrato (P2)

**Independent Test**: bateria de contrato 100% nas duas implementações; `getCoreStore()` em preview com dados sintéticos.

### Testes
- [ ] T051 [P] [US6] Teste do adaptador: 5 contas mapeadas, 1 lote por conta, UUIDs v5 determinísticos, Σ centavos = Σ dataset (seed 42) no total **e por mês**, pares de transferência/pagamento ligados por `relatedTransactionId`, parcelas e moeda original preservadas, categorias conforme data-model §7 (compras sem categoria = `null`) — `tests/unit/core/synthetic-adapter.test.ts` (FR-047, SC-006)
- [ ] T052 [P] [US6] Teste de `DemoSessions`: lojas isoladas por `sessionId`, LRU 50, TTL 2 h (relógio injetado), gravação de uma sessão invisível na outra, dono `DEMO_OWNER_ID`, `anchorDate` = hoje em São Paulo (relógio injetado) — `tests/unit/core/demo-sessions.test.ts` (FR-047)
- [ ] T053 [P] [US6] Teste do proxy: em `preview` sem cookie emite `prumo_demo_sid` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=7200`, `Secure` fora de localhost); com cookie não reemite; fora de preview nunca emite — `tests/unit/demo-cookie.test.ts` (contracts/owner-context.md)
- [ ] T074 [US6] Teste de integração: o dataset da semente 42 adaptado e gravado no Supabase via `batches.create` + `upsertMany` (modo `service`) dá as mesmas somas por mês que a memória — `tests/integration/core/synthetic-supabase.int.test.ts` (SC-006, FR-045)

### Implementação
- [ ] T054 [US6] `src/data/core/synthetic-adapter.ts` até T051 e T074 passarem
- [ ] T055 [US6] `src/data/core/memory/demo-sessions.ts` + integração em `getCoreStore()` (lê `prumo_demo_sid` via `cookies()` do Next quando não há provedor) até T052 passar
- [ ] T056 [US6] Cookie de sessão demo em `src/proxy.ts` (só `APP_ENV=preview`; sem referenciar a trava de produção da 001 — a 006 reescreve o proxy preservando este trecho) até T053 passar; teste E2E existente `tests/e2e/demo.spec.ts` continua verde

---

## Phase 9: US7 — Pendentes e atualizações da fonte (P3)

**Independent Test**: pendente via `pluggy` reenviada efetivada com outro valor → 1 transação, `posted`, novo valor, auditoria.

- [ ] T057 [US7] Contrato US7: pendente → efetivada (mesma transação); valor/descrição alterados na confirmação com auditoria do valor anterior; campos travados intocados; `posted` reenviada como `pending` não regride; `softDelete(reason='canceled_at_source')` e reenvio posterior não ressuscita — `tests/contract/core-store.contract.ts` (FR-020, FR-037, Clarificação Q2)
- [ ] T058 [US7] Ajustar `core_upsert_transactions` e `upsertMany` em memória (ramo `pending` do algoritmo) até T057 passar nas duas

---

## Phase 10: Polish & transversais

- [ ] T059 [P] Teste de desempenho: 100 mil transações (5 contas, `generate_series`) no Supabase local; `transactions.list` de 1 mês ≤ 1 s (mediana de 5) e upsert de 1.000 linhas ≤ 2 s; `EXPLAIN` usa `tx_owner_date_idx` — `tests/integration/core/perf.int.test.ts` (SC-007, FR-042)
- [ ] T075 [P] Caso de contrato (vermelho): `exportAll()` produz chunks ≤ 500 na ordem do contrato, com todas as entidades do dono, inclusive excluídas, arquivadas e auditoria, e nada do outro dono — `tests/contract/core-store.contract.ts` (FR-044)
- [ ] T060 `exportAll()` nas duas implementações (paginação ≤ 500, respeitando `max_rows` 1.000 da 001) até T075 passar
- [ ] T061 [P] Teste de resiliência: 10 reimportações (lotes novos) do dataset sintético → 0 duplicatas (SC-001); 100 ciclos de sync/recategorização automática sobre transações editadas → 100% dos campos manuais intactos (SC-002) — `tests/integration/core/resilience.int.test.ts`
- [ ] T062 Documentar no README (seção "Dados") o uso de `getCoreStore`/`createCoreStore`, `DEMO_OWNER_ID`, erros, pré-condição de `upsertMany` e regra de propriedade das tabelas; validar `quickstart.md` do zero (`supabase db reset` + testes)
- [ ] T063 Abrir PR `004 · Modelo de dados core` com rótulos `autor:claude` + `iniciativa:0`, milestone `0 · Plataforma` e template de PR quando existir; status da 004 em `docs/roadmap.md` → `review` no PR

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → histórias. T001 exige 001 e constitution v1.1.0 na `main`.
- Phase 2: testes (T004–T006, T066, T067, T009, T068, T069, T034, T035, T047, T027, T070,
  T016, T071) sempre antes das implementações que citam; T011 → T012 → T013 → T014.
- **US1 → US2 → US3** (P1, nesta ordem: US2 e US3 usam o upsert/listagem da US1).
- US4 depende de US1 (lotes/transações) e US2 (travas no `update`).
- US5 depende de US1 + US4 (ações a auditar); auditoria básica já existe desde T012.
- US6 depende de US1–US5 (adaptador e demo usam o contrato completo), mas T052–T053 podem
  começar após a Phase 2.
- US7 depende de US1 + US2.
- Phase 10 depende de todas as histórias. Merge da onda 1: 004 → 003 → 006 → 002.

## Parallel Opportunities

- Phase 1: T065 e T003.
- Phase 2: T004, T005, T006, T066, T067, T009, T068 juntos; T069, T034, T035, T047, T070 juntos;
  SQL (T011–T014) em paralelo com T015–T017 (TS).
- US1: T020 e T021; T025 (memória) em paralelo com T024 (SQL).
- US2: T028 em paralelo com T033/T073.
- US4: T039 em paralelo com T040–T042; T045 (memória) ∥ T044/T046 (Supabase).
- US6: T051, T052, T053 juntos.
- Phase 10: T059, T075, T061.

## Implementation Strategy

1. **MVP**: Phases 1–2 + US1 + US2 + US3 — contrato seguro e idempotente; desbloqueia 007/009/012.
2. US4 + US5 (CRUD manual e auditoria completa) — desbloqueia 011/012/014/016.
3. US6 (demo) — obrigatório antes do PR (Constitution VII).
4. US7 + Polish; PR para revisão Gemini + Gate 3.

## Rastreabilidade FR → Tasks → Testes

| Requisito | Implementação | Teste(s) |
|---|---|---|
| FR-001–FR-003 | T011, T013, T037, T038 | T034, T035, T036 |
| FR-004 | T011, T008 | T069, T036 |
| FR-005, FR-006 | T010, T014, T045, T046 | T068, T069, T040 |
| FR-007–FR-009, FR-011, FR-012 | T011, T044, T045, T046 | T069, T040 |
| FR-010 | T043, T044, T045, T046 | T039, T040 |
| FR-013–FR-015 | T007, T008, T011, T024, T025, T026 | T005, T067, T069, T027, T022 |
| FR-016 | T043, T044, T045 | T039, T041 |
| FR-017 | T011, T044, T045 | T041 |
| FR-018 | T007, T008, T011 | T004, T067, T022 |
| FR-019 | T044, T045, T046 | T041 |
| FR-020 | T030, T031, T058 | T028, T029, T033, T057 |
| FR-021, FR-022 | T023, T024, T025, T026 | T006, T020, T022, T027, T072, T061 |
| FR-023 | T044, T045, T046 | T041, T048 |
| FR-024 | T030, T031, T032, T044 | T028, T029, T033, T073, T040, T061 |
| FR-025, FR-026 | T030, T031, T032 | T028, T029 |
| FR-027–FR-032 | T010, T019, T044, T045, T046 | T006, T009, T071, T042 |
| FR-033 | T011, T023, T024, T025 | T021, T070, T022, T072 |
| FR-034 | T024, T025, T026 | T022 |
| FR-035 | T049, T050, T011 | T048, T070 |
| FR-036 | T011, T012 | T047, T070 |
| FR-037, FR-038 | T012, T044, T045, T046 | T047, T041, T057 |
| FR-039–FR-041 | T012, T049, T050 | T047, T048 |
| FR-042 | T025, T026 | T022, T059 |
| FR-043 | T026, T045, T046, T049 | T022, T040, T042, T048 |
| FR-044 | T060 | T075 |
| FR-045, FR-046 | T018, T019, T025, T026 | T018 (runners), T071, T074 |
| FR-047 | T054, T055, T056 | T051, T052, T053, T074 |
| FR-048 | T011–T014 | T069 (migrações `<timestamp>_core_*` aplicadas do zero) |
| SC-001, SC-002 | — | T061 |
| SC-003 | — | T034, T036 |
| SC-004 | — | T047, T048 |
| SC-005 | — | T018 (contrato nas duas implementações) |
| SC-006 | — | T051, T074 |
| SC-007 | — | T059 |
| SC-008 | fora do escopo (medido na 012, sem UI aqui — spec) | — |
