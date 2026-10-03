# Tasks: Modelo de Dados Core

**Input**: `specs/004-modelo-dados-core/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.
**Bateria de contrato**: `tests/contract/core-store.contract.ts` cresce a cada história e roda
contra memória (unit) **e** Supabase (integration). Uma task de contrato só fecha quando passa
nas duas.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto

---

## Phase 1: Setup

- [ ] T001 Rebase da branch `004-modelo-dados-core` sobre a `main` com a 001 mergeada; confirmar `npm run check` e `npm run test:integration` verdes antes de qualquer mudança
- [ ] T002 [P] Regra ESLint `no-restricted-imports`: fora de `src/data/core/**`, proibir `@/data/core/supabase/*` e `@/data/core/memory/*`; proibir `.from("<tabela core>").delete` via regra `no-restricted-syntax` — `eslint.config.mjs` (plan §Bibliotecas)
- [ ] T003 [P] `scripts/ci-supabase-env.mjs` passa a exportar `SUPABASE_TEST_PUBLISHABLE_KEY` (mascarada) só para testes + helper `tests/helpers/supabase-test.ts`: `createTestOwner()` (Admin API, e-mail `owner-<uuid>@example.test`), `userClient(owner)` (login por senha → JWT), `serviceClient()`, `resetCore()` (R-15)

## Phase 2: Foundational (bloqueia todas as histórias)

### Domínio puro (testes primeiro)
- [ ] T004 [P] Testes de `money.ts`: `assertCents` (inteiro seguro), `parseCentsStrict("12,34")=1234`, rejeita `"12,345"`, `NaN`, `1.5`; `sumCents` — `tests/unit/core/money.test.ts` (FR-018)
- [ ] T005 [P] Testes de `dates.ts`: `isIsoDate` (calendário real, 1900–2100), `toSaoPauloDate("2026-10-01T02:30:00Z") = "2026-09-30"` — `tests/unit/core/dates.test.ts` (FR-013, US1 cenário 6)
- [ ] T006 [P] Testes de `text.ts`: `normalizeDescription`, `nameKey("Alimentação ") = "alimentacao"` — `tests/unit/core/text.test.ts` (FR-022, FR-032)
- [ ] T007 Implementar `src/domain/core/{types,money,dates,text,errors}.ts` até T004–T006 passarem; `CoreError` com códigos de contracts/core-store.md §Erros
- [ ] T008 `src/domain/core/schemas.ts` (zod 4) para `IncomingTx`, `ManualTxInput`, `TxPatch`, `AccountInput`, `NewCategory`, `NewBatch` com os limites dos `CHECK` do data-model + teste de limites — `tests/unit/core/schemas.test.ts` (FR-013, FR-015, FR-018)

### Taxonomia
- [ ] T009 [P] Teste: `default-categories.ts` tem 15 despesas, 5 receitas, 3 neutras + "Sem categoria"; 75 subcategorias; system keys `uncategorized, internal_transfer, card_payment, salary, bank_fees`; nomes únicos por irmãos (`nameKey`) — `tests/unit/core/default-categories.test.ts` (FR-029)
- [ ] T010 Implementar `src/domain/core/default-categories.ts` (data-model §4) e `scripts/generate-category-seed.ts` (gera `supabase/migrations/<ts>_core_seed_catalog.sql` com `category_templates` + catálogo de instituições; `--check` compara com o arquivo versionado) + teste `tests/unit/core/category-seed.test.ts` (R-12)

### Banco (dona 004)
- [ ] T011 Migração `<ts>_core_schema.sql`: `unaccent`, `core_name_key`, `core_resolve_owner`, `core_current_actor`, 6 tabelas de dados + `category_templates` com todas as colunas, `CHECK`, FKs compostas e índices do data-model §2; trigger `core_touch_updated_at`
- [ ] T012 Migração `<ts>_core_audit.sql`: `audit_log`, função `core_audit()` (`SECURITY DEFINER`, `search_path=''`, `changes` só de colunas alteradas, ação derivada), triggers `AFTER INSERT/UPDATE` nas 5 tabelas, `audit_log_immutable` (UPDATE/DELETE/TRUNCATE) e `core_forbid_delete` (data-model §2.7–2.8)
- [ ] T013 Migração `<ts>_core_rls.sql`: `ENABLE` + `FORCE ROW LEVEL SECURITY` nas 7 tabelas, policies e `REVOKE` do data-model §3
- [ ] T014 Gerar e versionar `<ts>_core_seed_catalog.sql` via T010; `supabase db reset` local sem erros; teste de integração confere 99 templates e 11 instituições de catálogo — `tests/integration/core/schema.int.test.ts`

### Porta, contexto e esqueletos
- [ ] T015 `src/data/core/ports.ts` (interface `CoreStore` de contracts/core-store.md) e `src/data/core/index.ts` (exporta só porta, tipos, `createCoreStore`, `getCoreStore`)
- [ ] T016 [P] Teste de `context.ts`: `createCoreStore` por `kind`; `getCoreStore()` em preview → `mode="memory"`; em local sem provedor → `owner_required`; `registerOwnerContextProvider` usado quando registrado — `tests/unit/core/context.test.ts` (contracts/owner-context.md)
- [ ] T017 Implementar `src/data/core/context.ts` até T016 passar
- [ ] T018 Bateria de contrato vazia parametrizada `describeCoreStoreContract(name, makeStore: () => Promise<{ store; other }>)` (dois donos por execução) + runners `tests/unit/core/memory-store.contract.test.ts` e `tests/integration/core/supabase-store.contract.int.test.ts` (rodando modos `user` e `service`) — `tests/contract/core-store.contract.ts` (FR-045, FR-046)
- [ ] T019 Esqueletos `src/data/core/memory/memory-store.ts` e `src/data/core/supabase/{supabase-store,mappers}.ts` (`server-only`) implementando `bootstrap()` (memória: copia taxonomia; Supabase: função `core_bootstrap_owner` em `<ts>_core_functions.sql`) + caso de contrato "bootstrap idempotente cria 99 categorias" (FR-029)

**Checkpoint**: schema aplicado, porta definida, contrato rodando nas duas implementações.

---

## Phase 3: US1 — Contrato único e confiável de transações (P1) 🎯 MVP

**Independent Test**: gravar um lote sintético, regravar, contagem inalterada e lote com `duplicate = n`.

### Testes (escrever primeiro)
- [ ] T020 [P] [US1] Teste de `identity.ts`: `ext:` com id; `fp:` determinístico; `assignOccurrences` distingue 2 cafés idênticos; descrição com acento/espaços normalizada — `tests/unit/core/identity.test.ts` (FR-021, FR-022)
- [ ] T021 [P] [US1] Teste de `state.ts` (lote): transições permitidas e proibidas do plan — `tests/unit/core/batch-state.test.ts` (FR-033)
- [ ] T022 [US1] Contrato US1: upsert cria com todos os campos; reenvio = 0 criadas/`duplicate=n`; CSV sem id idempotente; 2 cafés → 2 transações; fração de centavo/data inválida/parcela n>m → `rejected` com `field`; transação importada exige lote; reimportar excluída não ressuscita; `findCompletedByFile`; lote com contadores; `list` ordenado `bookedOn DESC, id DESC` com cursor — `tests/contract/core-store.contract.ts` (FR-013–FR-018, FR-021, FR-022, FR-033, FR-034, FR-042)

### Implementação
- [ ] T023 [US1] `src/domain/core/identity.ts` e `src/domain/core/state.ts` até T020–T021 passarem
- [ ] T024 [US1] Funções `core_create_batch`, `core_finish_batch`, `core_find_completed_batch_by_file`, trigger `import_batches_state_guard` e `core_upsert_transactions` (algoritmo data-model §5) em `<ts>_core_functions.sql`
- [ ] T025 [US1] `MemoryCoreStore`: `batches.*` (exceto `undo`), `transactions.upsertMany/list/get` até a parte memória de T022 passar
- [ ] T026 [US1] `SupabaseCoreStore`: mesmas operações via `rpc()` (fatiamento em 1.000 linhas, mapeamento de erros `core.*`/`23505` → `CoreError`, cursor opaco) até a parte Supabase de T022 passar
- [ ] T027 [US1] Teste de integração do trigger `transactions_guard` em INSERT: `source≠manual` sem lote, `identity_key` fora do formato, moeda original `BRL` → erro — `tests/integration/core/guards.int.test.ts` (FR-014, FR-015)

**Checkpoint**: conectores (007/009) já podem gravar de forma idempotente.

---

## Phase 4: US2 — Edições manuais nunca são perdidas (P1)

**Independent Test**: editar descrição/categoria, reimportar com valores diferentes, edição permanece e auditoria registra ambas.

### Testes
- [ ] T028 [P] [US2] Teste de `locks.ts` (`applyPatch`): usuário trava campo; ator automático preserva campo travado e reporta `protectedFields`; fato de importada → `forbidden_operation:imported_fact` (user) / ignorado (auto); categoria manual zera confiança; `changes` vazio não grava — `tests/unit/core/locks.test.ts` (FR-020, FR-024, FR-026)
- [ ] T029 [US2] Contrato US2: cenários 1–4 da spec (descrição editada preservando original; categoria manual resiste a sync/regra/IA via `upsertMany` e `update`; categoria `ai` atualizável com confiança; `unlockField` libera) — `tests/contract/core-store.contract.ts` (FR-024–FR-026)

### Implementação
- [ ] T030 [US2] `src/domain/core/locks.ts` até T028 passar
- [ ] T031 [US2] Trigger `transactions_guard` BEFORE UPDATE (matriz de campos do data-model §2.6, travas, `posted→pending` proibido) + funções `core_update_transaction`, `core_unlock_field`
- [ ] T032 [US2] `transactions.update/unlockField` em memória e Supabase até T029 passar nas duas
- [ ] T033 [US2] Teste de integração: `UPDATE` direto via PostgREST com JWT trava o campo (ator padrão `user`); `UPDATE` com `prumo.actor={"type":"ai"}` em campo travado mantém valor — `tests/integration/core/guards.int.test.ts` (R-07)

---

## Phase 5: US3 — Isolamento e privacidade (P1)

**Independent Test**: dois donos sintéticos; nenhuma operação de um alcança o outro; sem dono → recusa.

### Testes
- [ ] T034 [P] [US3] Teste RLS com JWT (dono A × B) nas 7 tabelas: SELECT só próprias; INSERT com `owner_id` alheio recusado; UPDATE alheio afeta 0 linhas; DELETE negado; `anon` sem acesso; catálogo de instituições e templates legíveis — `tests/integration/core/rls.int.test.ts` (FR-001–FR-003)
- [ ] T035 [P] [US3] Teste de `core_resolve_owner`: JWT ignora/rejeita `p_owner_id` divergente (`not_found`); service exige `p_owner_id`; sem nenhum → `owner_required` — `tests/integration/core/rls.int.test.ts` (FR-002)
- [ ] T036 [US3] Contrato US3: com `store` (A) e `other` (B), `get/update/softDelete` de id de B → `not_found`; `list` nunca retorna B; FK composta impede vincular conta/categoria/lote de B; `last4` aceita só 4 dígitos — `tests/contract/core-store.contract.ts` (FR-001–FR-004)

### Implementação
- [ ] T037 [US3] Garantir filtro `owner_id` explícito em toda consulta do `SupabaseCoreStore` (helper `scoped(table)`), e passagem de `p_owner_id` em modo `service`, até T036 passar em `user` e `service`
- [ ] T038 [US3] Memória: todas as coleções indexadas por dono; ids alheios → `not_found` até T036 passar

---

## Phase 6: US4 — Cadastro e manutenção manual (P2)

**Independent Test**: criar conta manual, lançar 3 transações, editar, excluir, restaurar, criar subcategoria e reatribuir.

### Testes
- [ ] T039 [P] [US4] Teste de `balances.ts`: `computed` só `posted` não excluídas dentro de `opening_on..asOf`; `divergence` na data reportada; contas sem saldo reportado → `null` — `tests/unit/core/balances.test.ts` (FR-010)
- [ ] T040 [US4] Contrato US4 — contas: criar manual (cartão com limite/fechamento/vencimento), campos de cartão recusados em outros tipos, `upsert` pluggy idempotente por `(source, externalId)`, arquivar/desarquivar mantém histórico, `setReportedBalance` + `balances` — `tests/contract/core-store.contract.ts` (FR-005–FR-012)
- [ ] T041 [US4] Contrato US4 — transações manuais: criar, editar valor/data/conta, excluir (`user`), restaurar; natureza + `relatedTransactionId` e desfazimento do vínculo ao excluir a contrapartida — `tests/contract/core-store.contract.ts` (FR-016, FR-017, FR-019, FR-037, FR-038)
- [ ] T042 [US4] Contrato US4 — categorias: árvore 2 níveis, herança de `kind`, renomear reflete nas transações, nome único sem acento/caixa entre irmãos, ocultar, excluir com destino (padrão "Sem categoria") e `children: move|delete`, sistema não excluível, restaurar — `tests/contract/core-store.contract.ts` (FR-027–FR-032)

### Implementação
- [ ] T043 [US4] `src/domain/core/balances.ts` até T039 passar
- [ ] T044 [US4] Funções SQL `core_upsert_account`, `core_archive_account`, `core_set_reported_balance`, `core_account_balances`, `core_create_manual_transaction`, `core_soft_delete_transactions`, `core_restore_transactions`, `core_create_category`, `core_update_category`, `core_delete_category`, `core_restore_category`, triggers `accounts_guard` e `categories_guard`
- [ ] T045 [US4] `accounts.*`, `institutions.*`, `transactions.createManual/softDelete/restore`, `categories.*` em memória até T040–T042 passarem
- [ ] T046 [US4] Mesmas operações no Supabase até T040–T042 passarem

---

## Phase 7: US5 — Trilha de auditoria (P2)

**Independent Test**: criar, editar, recategorizar automaticamente, excluir, restaurar e desfazer lote — cada ação com entrada de auditoria completa.

### Testes
- [ ] T047 [P] [US5] Teste de integração: `UPDATE/DELETE/TRUNCATE` em `audit_log` falham para `service_role` e `authenticated`; `DELETE` físico em contas/transações/categorias/lotes/instituições falha com `core.hard_delete_forbidden`; falha no meio de uma função não deixa auditoria órfã (atomicidade) — `tests/integration/core/audit.int.test.ts` (FR-036, FR-037, FR-040)
- [ ] T048 [US5] Contrato US5: `audit.history` traz `create/update/soft_delete/restore/merge/archive/reassign/undo_batch/unlock` com ator, `batchId` e `changes` antes/depois; nenhum campo de segredo; `undo` de lote com 2 editadas → `{deleted, withManualEdits: 2}` e lote `undone`; restaurar após undo — `tests/contract/core-store.contract.ts` (FR-035, FR-039, FR-041, US5)

### Implementação
- [ ] T049 [US5] Função `core_undo_batch` e `audit.history` no Supabase
- [ ] T050 [US5] Auditoria em memória (mesmo formato de `changes` e mesmas ações derivadas) + `batches.undo` até T048 passar nas duas

---

## Phase 8: US6 — Modo demonstração com o mesmo contrato (P2)

**Independent Test**: bateria de contrato 100% nas duas implementações; `getCoreStore()` em preview com dados sintéticos.

### Testes
- [ ] T051 [P] [US6] Teste do adaptador: 5 contas mapeadas, 1 lote por conta, Σ centavos = Σ dataset (seed 42), pares de transferência/pagamento ligados por `relatedTransactionId`, parcelas e moeda original preservadas, categorias por `kind` — `tests/unit/core/synthetic-adapter.test.ts` (FR-047, SC-006)
- [ ] T052 [P] [US6] Teste de `DemoSessions`: lojas isoladas por `sessionId`, LRU 50, TTL 2 h (relógio injetado), gravação de uma sessão invisível na outra — `tests/unit/core/demo-sessions.test.ts` (FR-047)
- [ ] T053 [P] [US6] Teste do proxy: em `preview` sem cookie emite `prumo_demo_sid` (`HttpOnly`, `SameSite=Lax`, `Max-Age=7200`); fora de preview nunca emite; trava de produção da 001 inalterada — `tests/unit/demo-cookie.test.ts` (contracts/owner-context.md)

### Implementação
- [ ] T054 [US6] `src/data/core/synthetic-adapter.ts` até T051 passar
- [ ] T055 [US6] `src/data/core/memory/demo-sessions.ts` + integração em `getCoreStore()` (lê cookie via `cookies()` do Next) até T052 passar
- [ ] T056 [US6] Cookie de sessão demo em `src/proxy.ts` (só `APP_ENV=preview`) até T053 passar; teste E2E existente `tests/e2e/demo.spec.ts` continua verde

---

## Phase 9: US7 — Pendentes e atualizações da fonte (P3)

**Independent Test**: pendente via `pluggy` reenviada efetivada com outro valor → 1 transação, `posted`, novo valor, auditoria.

- [ ] T057 [US7] Contrato US7: pendente → efetivada (mesma transação); valor/descrição alterados na confirmação com auditoria do valor anterior; campos travados intocados; `posted` reenviada como `pending` não regride; `softDelete(reason='canceled_at_source')` — `tests/contract/core-store.contract.ts` (FR-020, FR-037, Clarificação Q2)
- [ ] T058 [US7] Ajustar `core_upsert_transactions` e `upsertMany` em memória (ramo `pending` do algoritmo) até T057 passar nas duas

---

## Phase 10: Polish & transversais

- [ ] T059 [P] Teste de desempenho: 100 mil transações (5 contas, `generate_series`) no Supabase local; `transactions.list` de 1 mês ≤ 1 s (mediana de 5) e upsert de 1.000 linhas ≤ 2 s; `EXPLAIN` usa `tx_owner_date_idx` — `tests/integration/core/perf.int.test.ts` (SC-007)
- [ ] T060 [P] `exportAll()` nas duas implementações (stream por entidade, inclui excluídos e auditoria) + caso de contrato — `tests/contract/core-store.contract.ts` (FR-044)
- [ ] T061 [P] Teste de resiliência: 10 reimportações do dataset sintético → 0 duplicatas (SC-001); 100 ciclos de sync/recategorização automática sobre transações editadas → 100% dos campos manuais intactos (SC-002) — `tests/integration/core/resilience.int.test.ts`
- [ ] T062 Documentar no README (seção "Dados") o uso de `getCoreStore`/`createCoreStore`, erros e regra de propriedade das tabelas; validar `quickstart.md` do zero (`supabase db reset` + testes)
- [ ] T063 Abrir PR `004 · Modelo de dados core` (`autor:claude`, milestone `0 · Plataforma`); atualização do `docs/roadmap.md` feita pelo coordenador no PR

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → histórias. T001 exige a 001 mergeada na `main`.
- **US1 → US2 → US3** (P1, nesta ordem: US2 e US3 usam o upsert/listagem da US1).
- US4 depende de US1 (lotes/transações) e US2 (travas no `update`).
- US5 depende de US1 + US4 (ações a auditar); auditoria básica já existe desde T012.
- US6 depende de US1–US5 (adaptador e demo usam o contrato completo), mas T052–T053 podem
  começar após a Phase 2.
- US7 depende de US1 + US2.
- Phase 10 depende de todas as histórias.

## Parallel Opportunities

- Phase 1: T002 e T003.
- Phase 2: T004, T005, T006, T009 juntos; T011–T013 (SQL) em paralelo com T015–T017 (TS).
- US1: T020 e T021; T025 (memória) em paralelo com T024 (SQL).
- US3: T034 e T035.
- US4: T039 em paralelo com T040–T042; T045 (memória) ∥ T044/T046 (Supabase).
- US6: T051, T052, T053 juntos.
- Phase 10: T059, T060, T061.

## Implementation Strategy

1. **MVP**: Phases 1–2 + US1 + US2 + US3 — contrato seguro e idempotente; desbloqueia 007/009/012.
2. US4 + US5 (CRUD manual e auditoria completa) — desbloqueia 011/012/014/016.
3. US6 (demo) — obrigatório antes do PR (Constitution VII).
4. US7 + Polish; PR para revisão Gemini + Gate 3.

## Rastreabilidade FR → Tasks

| FR | Tasks |
|---|---|
| FR-001–FR-003 | T013, T034, T035, T036, T037, T038 |
| FR-004 | T011, T036 |
| FR-005, FR-006 | T010, T014, T040, T045, T046 |
| FR-007–FR-009, FR-011, FR-012 | T011, T040, T044, T045, T046 |
| FR-010 | T039, T040, T043, T044 |
| FR-013–FR-015 | T005, T008, T011, T022, T024, T027 |
| FR-016, FR-017 | T011, T041, T044 |
| FR-018 | T004, T008, T022 |
| FR-019 | T041, T044, T045 |
| FR-020 | T028, T031, T057 |
| FR-021, FR-022 | T006, T020, T022, T023, T024, T061 |
| FR-023 | T041, T044, T048 |
| FR-024–FR-026 | T028, T029, T030, T031, T032, T033, T061 |
| FR-027–FR-032 | T006, T009, T010, T019, T042, T044 |
| FR-033, FR-034 | T021, T022, T024 |
| FR-035, FR-036 | T047, T048, T049, T050 |
| FR-037, FR-038 | T012, T041, T047, T057 |
| FR-039–FR-041 | T012, T047, T048, T050 |
| FR-042, FR-043 | T022, T026, T048 |
| FR-044 | T060 |
| FR-045–FR-047 | T018, T019, T051, T052, T053, T054, T055, T056 |
| FR-048 | T011–T014 (migrações aditivas, timestamp), T063 |
| SC-001–SC-007 | T061, T061, T034, T047, T018, T051, T059 |
