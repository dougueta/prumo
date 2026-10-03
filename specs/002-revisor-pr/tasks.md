# Tasks: Revisor de PR Independente

**Input**: `specs/002-revisor-pr/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.
Fixtures 100% sintéticas no formato da API do GitHub; nenhum teste usa rede.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto · ⚠️ = ação externa (confirmar com Doug)

---

## Phase 1: Setup

- [ ] T001 ⚠️ Decisão D1 com o Doug (plan.md): A público / B Pro / C privado + camadas. Se C, atualizar `specs/002-revisor-pr/spec.md` (FR-001, FR-002, FR-005 e US1 cenários 1, 2, 6: "recusado nos agentes e no comando de merge + detectado e alertado em ≤ 5 min") e obter reaprovação antes de qualquer código (Constitution I)
- [ ] T002 Rebase da branch na `main` com a 001 integrada; confirmar os 4 nomes de check de CI em `.github/workflows/ci.yml` iguais a `REQUIRED_CI_CHECKS` (data-model §1)
- [ ] T003 [P] `.gitignore` (+ `.review/`, `.env.review.local`) e scripts em `package.json`: `review:bundle`, `review:publish`, `pr:merge`, `gh:labels`, `gh:repo-settings`, `gh:ruleset`, `prepare` (`git config core.hooksPath .githooks`)
- [ ] T004 [P] `src/review/catalog.ts` e `src/review/types.ts` conforme data-model §1–§2
- [ ] T005 [P] Fixtures sintéticas em `tests/unit/review/fixtures/` (reviews/comentários/commits/arquivos no formato da API: Gemini com e sem bloco, selos inline, prumo-revisor com `head=`, comentário da conta do Doug, trailers Claude/Gemini/nenhum, patch de constitution)

## Phase 2: Foundational (bloqueia todas as histórias)

- [ ] T006 [P] Teste de `parseVerdict` cobrindo todas as linhas da tabela "Regras de parsing" de `contracts/veredito.md` §1 (marcador, cabeçalho, tabelas, severidades com/sem acento, # repetido, `head=` e "Insumos lidos" do Claude, "Achados anteriores", selos inline → severidade) — `tests/unit/review/parse-verdict.test.ts` (FR-007, FR-010, FR-016, FR-020)
- [ ] T007 [P] Teste de `parseResponses` (`corrigido` com sha 7–40 hex, `justificado` ≥ 20 caracteres, ações inválidas, união de várias respostas) — `tests/unit/review/parse-responses.test.ts` (FR-019)
- [ ] T008 [P] Teste de `authorship` (trailers → agente, mistos, nenhum ⇒ doug) e `classifyPr` (feature/processo/emenda, `PROCESS_PATHS`, `GATE_SELF_PATHS`, branch `^\d{3}-…`) — `tests/unit/review/authorship.test.ts`, `tests/unit/review/classify-pr.test.ts` (FR-011, FR-012, FR-013)
- [ ] T009 Implementar `src/review/parse-verdict.ts`, `src/review/parse-responses.ts`, `src/review/authorship.ts`, `src/review/classify-pr.ts` até T006–T008 passarem
- [ ] T010 ⚠️ Spike Gemini (risco alto, plan "Riscos"): Doug instala o Gemini Code Assist (consumer) só em `dougueta/prumo`; branch de teste com rascunho de `.gemini/config.yaml` + styleguide exigindo o bloco `prumo:veredito`; 3 PRs de teste; registrar em `specs/002-revisor-pr/research.md` R-01: taxa de vereditos no formato, de qual ref o Gemini lê config/styleguide (base ou head), latência (FR-016, SC-004). Se < 3/3 no formato após ajuste do styleguide → parar e levar ao Doug (plano B exige emenda da spec)

**Checkpoint**: parsers prontos e viabilidade do veredito do Gemini confirmada.

---

## Phase 3: US1 — Nada entra na `main` sem revisão independente (P1) 🎯 MVP

**Independent Test**: roteiro do quickstart §2, cenários 1, 2, 3, 5, 6, 7, 8, 11, 14.

### Testes (escrever primeiro)
- [ ] T011 [P] [US1] Teste de `evaluateGate`: uma asserção por linha (1–14) da tabela de decisão de `contracts/review-gate.md`, ordem de precedência, avisos (agente errado, fora do formato, incoerente, altera o portão), `reason` ≤ 140 — `tests/unit/review/evaluate-gate.test.ts` (FR-002, FR-006–FR-013, FR-024)
- [ ] T012 [P] [US1] Teste de `mainGuard` (push): não-squash, sem PR, CI incompleto, revisão ≠ success, ok, PR `emergencia` gera issue pendente — `tests/unit/review/main-guard.test.ts` (FR-001, FR-002)
- [ ] T013 [P] [US1] Teste do montador de `PrSnapshot` com `fetch` falso (paginação, associação `pull_request_review_id` → review, `specExists` via contents 404/200, patch da constitution) — `tests/unit/review/github.test.ts` (FR-009)
- [ ] T014 [P] [US1] Teste de `mergeReadiness` (exit 6/7/8 do `contracts/review-cli.md`) e do hook `pre-push` (executa `.githooks/pre-push` com stdin simulado; recusa `refs/heads/main`, aceita outras) — `tests/unit/review/merge-readiness.test.ts`, `tests/unit/review/pre-push.test.ts` (FR-001, FR-003, FR-004)

### Implementação
- [ ] T015 [US1] `src/review/evaluate-gate.ts` (algoritmo do plan) até T011 passar
- [ ] T016 [US1] `scripts/review/github.ts` (cliente mínimo, `fetch` injetável, `GITHUB_TOKEN`/`gh auth token`) até T013 passar
- [ ] T017 [US1] `scripts/review/gate.ts` (snapshot → `evaluateGate` → `POST statuses` com context "Revisão independente" + job summary) e `.github/workflows/review-gate.yml` (gatilhos e permissões de `contracts/review-gate.md`; checkout `ref: main`; job de `pull_request_review` só faz `gh workflow run review-gate.yml --ref main -f pr=<n>`; `concurrency` por PR) (FR-006, FR-008)
- [ ] T018 [US1] `src/review/main-guard.ts` + `scripts/review/main-guard.ts` + `.github/workflows/main-guard.yml` (gatilho `push` em `main`; issue `violacao-main` idempotente atribuída a `dougueta`) até T012 passar (FR-001, FR-002, FR-005)
- [ ] T019 [US1] `src/review/merge-readiness.ts` + `scripts/review/merge.ts` (`gh pr merge --squash --delete-branch` só se pronto e TTY) até T014 passar (FR-002, FR-003, FR-004)
- [ ] T020 [P] [US1] `.githooks/pre-push` (POSIX sh, funciona no Git Bash) até T014 passar (FR-001)
- [ ] T021 [P] [US1] `.claude/settings.json` (`permissions.deny`: `Bash(git push * main*)`, `Bash(git push * HEAD:main*)`, `Bash(gh pr merge*)`, `Bash(npm run pr:merge*)`, `Bash(gh api * /merge*)`) e `.gemini/settings.json` (`excludeTools` equivalentes) (FR-004, FR-005)
- [ ] T022 [US1] `scripts/review/repo-settings.ts` com `--dry-run` (`allow_squash_merge=true`, `allow_merge_commit=false`, `allow_rebase_merge=false`, `delete_branch_on_merge=true`, `allow_update_branch=true`); ⚠️ Doug executa (FR-003)
- [ ] T023 [US1] ⚠️ Somente se D1 = A ou B: `scripts/review/ruleset.ts` (ruleset "main protegida": PR obrigatório, 4 checks de CI + "Revisão independente" obrigatórios, branch atualizada, histórico linear, bloquear force push e deleção, sem bypass); Doug executa (FR-001, FR-002, FR-005)
- [ ] T024 [US1] Documentação: `docs/adr/0007-protecao-main-repo-privado.md` (D1 e camadas) + índice em `docs/adr/README.md`; `docs/workflow.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`: fim da exceção de bootstrap com data, trailer `Co-Authored-By: Gemini <noreply@google.com>`, rótulos obrigatórios, `npm run pr:merge` (FR-023)
- [ ] T025 [US1] Roteiro de aceite (quickstart §2, cenários 1, 2, 3, 5, 6, 7, 8, 11, 14) em PRs de teste; evidências (links) no PR da 002 (SC-002, SC-003, SC-006)

**Checkpoint**: portão e proteção ativos — nenhum merge sem veredito válido.

---

## Phase 4: US2 — Gemini revisa os PRs do Claude (P1)

**Independent Test**: PR `autor:claude` com float para dinheiro proposital → MUDANÇAS NECESSÁRIAS citando III → corrigir → `/gemini review` → APROVADO.

- [ ] T026 [P] [US2] Teste que valida `.gemini/config.yaml` (parse com `yaml`: `comment_severity_threshold: LOW`, `max_review_comments: -1`, `include_drafts: false`, `summary: true`, `code_review: true`, `memory_config.disabled: true`) e que `.gemini/styleguide.md` contém o modelo do bloco exatamente como em `contracts/veredito.md` — `tests/unit/review/gemini-config.test.ts` (FR-014)
- [ ] T027 [US2] `.gemini/config.yaml` (research R-01) até T026 passar (FR-014, FR-015)
- [ ] T028 [US2] Atualizar `.gemini/styleguide.md`: terminar toda review com o bloco `prumo:veredito`, re-revisão com "Achados anteriores" considerando o comentário `prumo:respostas`, português, ler só o pacote equivalente (FR-014, FR-016, FR-020)
- [ ] T029 [P] [US2] Atualizar `docs/review-checklist.md` (formato com marcador, "Achados anteriores", "Insumos lidos", resposta do autor) mantendo-o fonte única do formato (FR-016, FR-019)
- [ ] T030 [US2] Teste de aceite da US2 em PR real; medir latência (SC-004) e registrar no PR da 002 (FR-015)

---

## Phase 5: US3 — Claude em contexto limpo revisa os PRs do Gemini (P2)

**Independent Test**: PR `autor:gemini` de teste com FR sem teste → `/revisar-pr <n>` → comentário de `prumo-revisor[bot]` apontando o FR, com "Insumos lidos" ⊆ manifest.

### Testes
- [ ] T031 [P] [US3] Teste de `appJwt` (gera par RSA no teste; header RS256; `iat` = now − 60; `exp` ≤ now + 600; `iss` = client id; assinatura verificável) — `tests/unit/review/app-jwt.test.ts` (FR-009)
- [ ] T032 [P] [US3] Teste de `buildBundlePlan` (arquivos da spec do head, checklist/constitution/ADRs da `main`, ausentes marcados `ausente`, sha256 no manifest, recusa `autor:claude` exit 3 / `autor:doug`) — `tests/unit/review/bundle.test.ts` (FR-017, FR-018)
- [ ] T033 [P] [US3] Teste de `formatPublication` (insere marcador `head=`, substitui "Insumos lidos" pelo manifest, rejeita veredito fora do formato, recusa head divergente exit 4) — `tests/unit/review/publish-format.test.ts` (FR-017, FR-018)

### Implementação
- [ ] T034 [US3] `src/review/app-jwt.ts` (`node:crypto`) até T031 passar
- [ ] T035 [US3] `src/review/bundle.ts` + `scripts/review/bundle.ts` (`gh`, `git fetch origin pull/<n>/head`, `.review/<n>/`) até T032 passar
- [ ] T036 [US3] `src/review/publish-format.ts` + `scripts/review/publish.ts` (lê `.env.review.local`, token de instalação restrito, `POST issues/<n>/comments`; nunca loga o token) até T033 passar
- [ ] T037 [P] [US3] `.claude/agents/revisor-limpo.md` (tools: Read, Glob, Grep; postura do checklist; ler somente `.review/<n>/`; gravar `veredito.md`)
- [ ] T038 [US3] `.claude/skills/revisar-pr/SKILL.md` (`/revisar-pr <n>`: bundle → subagente → publish; a sessão principal não lê o pacote)
- [ ] T039 [US3] ⚠️ Doug cria e instala o GitHub App `prumo-revisor` (quickstart §1.2) e preenche `.env.review.local`
- [ ] T040 [US3] Aceite: quickstart §2 cenários 9 e 10; medir SC-005

---

## Phase 6: US4 — Template de PR e rótulos (P2)

**Independent Test**: PR novo vem com o template; sem rótulo de autor → failure.

- [ ] T041 [P] [US4] Teste de `planLabels(existing, desired)` (cria faltantes, atualiza cor/descrição, nunca apaga; marcos idem) — `tests/unit/review/labels.test.ts` (FR-022)
- [ ] T042 [P] [US4] `.github/pull_request_template.md`: Feature (`NNN · Nome`), Artefatos (links spec/plan/tasks), Tipo, Rótulos, Checklist do autor, "Motivo da emergência:" (só se `emergencia`), Respostas aos achados (exemplo do bloco `prumo:respostas`) (FR-021)
- [ ] T043 [US4] `src/review/labels.ts` + `scripts/review/labels.ts` (`--dry-run`) até T041 passar (FR-022)
- [ ] T044 [US4] ⚠️ Doug executa `npm run gh:labels` (rótulos e 11 marcos do data-model §5)
- [ ] T045 [US4] Aceite: PR novo exibe o template; quickstart §2 cenário 6

---

## Phase 7: US5 — Ciclo achado → resposta → nova revisão (P3)

**Independent Test**: veredito com 3 achados, resposta para 2 → "achados sem resposta: #3"; responder o terceiro → segue.

- [ ] T046 [P] [US5] Teste do ciclo completo em `evaluateGate` (MUDANÇAS → respostas parciais → APROVADO = failure; respostas somadas = success; `corrigido` com sha fora do PR = não conta; re-revisão sem "Achados anteriores" = fora do formato) — `tests/unit/review/review-cycle.test.ts` (FR-019, FR-020)
- [ ] T047 [US5] Ajustar `src/review/evaluate-gate.ts`/`parse-responses.ts` até T046 passar
- [ ] T048 [US5] Aceite: quickstart §2 cenário 12 (SC-007)

---

## Phase 8: Emergência e transversais

- [ ] T049 [P] Teste do modo agendado do `mainGuard` (pendente, fechada ao achar veredito pós-merge, `VENCIDA —` após 7 dias, idempotência) — `tests/unit/review/emergency.test.ts` (FR-024)
- [ ] T050 Gatilho `schedule` (11:00 UTC) em `.github/workflows/main-guard.yml` + modo agendado em `scripts/review/main-guard.ts` até T049 passar (FR-024)
- [ ] T051 Aceite: quickstart §2 cenário 13 (FR-024)
- [ ] T052 [P] `docs/gemini-handoff.md` (seção "Revisões pendentes" passa a apontar a busca de PRs `autor:claude` com status pending) e seção "Revisão de PRs" no `README.md` com custo R$ 0 (Gemini consumer, App, Actions ≈ 700/2.000 min) (FR-023, FR-025, SC-008)
- [ ] T053 Rodar o `quickstart.md` inteiro do zero e corrigir divergências
- [ ] T054 Atualizar `docs/roadmap.md` (002 → `review`) e abrir PR `002 · Revisor de PR independente` (`autor:claude`, `iniciativa:0`, milestone `0 · Plataforma`); último PR sob bootstrap — Doug revisa manualmente `.github/workflows/**` (não coberto pelo Gemini)

---

## Dependencies & Execution Order

- T001 (D1) bloqueia tudo. Phase 1 → Phase 2 → histórias. T010 (spike) bloqueia US2 e o uso real do portão.
- **US1** depende da Phase 2. **US2** depende de T010 e US1 (para ver o status). **US3** depende da Phase 2 (parsers) e de T016; aceite (T040) depende de US1.
- **US4** independente após Phase 1 (T042 pode sair cedo); T045 depende de US1.
- **US5** depende de US1 (T015).
- Phase 8 depende de T018.

## Parallel Opportunities

- Phase 1: T003, T004, T005 juntos. Phase 2: T006, T007, T008 juntos.
- US1: T011–T014 juntos; T020 e T021 em paralelo com T015–T019.
- US3 (T031–T033, T037) e US4 (T041, T042) em paralelo com US1 (arquivos disjuntos).

## Implementation Strategy

1. D1 + spike (T001, T010) primeiro — são as duas incertezas que podem mudar a spec.
2. MVP = Phases 1–2 + US1 + US2: PRs do Claude (maioria do roadmap) passam a ter portão.
3. US3 antes da onda 3 (primeira feature do Gemini é a 010).
4. US4, US5, Phase 8; PR final sob a exceção de bootstrap.

## Rastreabilidade FR → Tasks

| FR | Tasks | | FR | Tasks |
|---|---|---|---|---|
| 001 | T001, T012, T014, T018, T020, T023, T025 | | 014 | T026, T027, T028 |
| 002 | T011, T012, T015, T017, T019, T023 | | 015 | T027, T030 |
| 003 | T014, T019, T022 | | 016 | T006, T010, T028, T029 |
| 004 | T014, T019, T021 | | 017 | T032, T033, T035, T036, T038 |
| 005 | T018, T021, T023 | | 018 | T032, T033, T037, T040 |
| 006 | T011, T017 | | 019 | T007, T029, T046, T047 |
| 007 | T006, T011, T015 | | 020 | T006, T028, T046 |
| 008 | T011, T015, T017 | | 021 | T042 |
| 009 | T011, T013, T016, T031 | | 022 | T041, T043, T044 |
| 010 | T006, T011, T015 | | 023 | T024, T052 |
| 011 | T008, T009, T011 | | 024 | T011, T049, T050, T051 |
| 012 | T008, T009, T011 | | 025 | T052 |
| 013 | T008, T011 | | | |

Critérios de sucesso: SC-001 (T018, T025) · SC-002 (T018, T025) · SC-003 (T025) · SC-004 (T010, T030) ·
SC-005 (T040) · SC-006 (T017, T025) · SC-007 (T048) · SC-008 (T052).
