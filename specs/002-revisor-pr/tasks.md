# Tasks: Revisor de PR Independente

**Input**: `specs/002-revisor-pr/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.
Fixtures 100% sintéticas no formato da API do GitHub (`contracts/github-api.openapi.yaml`);
nenhum teste usa rede.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto · ⚠️ = ação externa (confirmar com Doug)
- IDs estáveis: T001–T054 da versão original; T055+ criadas na remediação pós-analyze e no
  Gate 2 (2026-10-05) e **posicionadas na ordem de execução** (o ID não indica ordem). Tasks
  removidas mantêm o ID com a marca "Removida".

---

## Phase 1: Setup

- [ ] T055 ⚠️ **Bloqueante — pré-requisitos** (plan §Pré-requisitos): emenda da constitution **v1.1.0** e emenda **v1.2.0** integradas na `main` — a v1.2.0 traz, no Princípio VIII, a exceção de emergência **com a trava** (não vale para PR que altera a constitution ou os mecanismos de revisão) e a descrição do insumo real de cada revisor (resolve C4); 001, 004, 003 e 006 integradas (ordem D-D: 004 → 003 → 006 → 002); rebase da branch `002-revisor-pr` na `main`. Sem a v1.2.0 nenhuma task de emergência (T011 regras 8–9, T012, T049–T051) pode ser implementada
- [x] T056 `docs/roadmap.md`: 002 → `impl` (fluxo normal)
- [x] T001 ⚠️ Decisão D1 = **A · repositório público** (Doug, Gate 2, 2026-10-05; já aplicado). Spec atualizada nesta mesma revisão (Clarifications "Decisões do Gate 2", FR-005, FR-026, US1 cenários 6 e 8, SC-003); FR-001/002/003 valem no servidor como escritos; FR-004 mantém as camadas
- [x] T002 Conferir o `ci.yml` da `main` após o rebase: anotar no PR os jobs sem `if` (verificações de PR — inclui os da 003/006, se houver) e os jobs com `if` (`deploy-db`); esses nomes alimentam as fixtures de T059 e o ruleset
- [x] T003 [P] `.gitignore` (+ `.review/`; `.env.review.local` já é coberto por `.env.*`) e scripts em `package.json`: `review:bundle`, `review:publish`, `pr:merge`, `gh:labels`, `gh:repo-settings`, `gh:ruleset`, `review:main-guard`
- [x] T004 [P] `src/review/catalog.ts` e `src/review/types.ts` conforme data-model §1–§2 (sem lista fixa de checks; com `OWNER_LOGIN`, `REPO_FULL_NAME`, `ACTIONS_INTEGRATION_ID`, `MIRROR_PATH`)
- [x] T005 [P] Fixtures sintéticas em `tests/unit/review/fixtures/` (reviews/comentários/commits/arquivos no formato do OpenAPI: Gemini com e sem bloco, selos inline, prumo-revisor com `head=`, comentário da conta do Doug, comentário de terceiro, PR de fork e de autor externo, comentário `prumo:avisos`, trailers Claude/Gemini/nenhum, patch de constitution, respostas de compare com e sem `patch`, check runs de `github-actions` e de outro app, `ci.yml` de exemplo, workflows inseguros de exemplo para T061, respostas de erro 403/404/422/429/5xx)
- [ ] T057 *Removida (D1 = A, 2026-10-05)* — teste de `scripts/setup-hooks.mjs`: sem hook local, o `prepare` não existe
- [ ] T058 *Removida (D1 = A, 2026-10-05)* — `scripts/setup-hooks.mjs` + `prepare`

## Phase 2: Foundational (bloqueia todas as histórias)

- [x] T006 [P] Teste de `parseVerdict` cobrindo todas as linhas da tabela "Regras de parsing" de `contracts/veredito.md` §1 (marcador, cabeçalho, tabelas, severidades com/sem acento, # repetido, `head=` e "Insumos lidos" do Claude, parse da seção "Achados anteriores" e situações inválidas, selos inline → severidade, marcador `prumo:avisos` ignorado) — `tests/unit/review/parse-verdict.test.ts` (FR-007, FR-010, FR-016, FR-020)
- [x] T007 [P] Teste de `parseResponses` (`corrigido` com sha 7–40 hex, `justificado` ≥ 20 caracteres, ações inválidas, autor ≠ `dougueta` ignorado, união de várias respostas) — `tests/unit/review/parse-responses.test.ts` (FR-019)
- [x] T008 [P] Teste de `authorship` (trailers → agente, mistos, nenhum ⇒ doug; `isExternal` para autor ≠ `dougueta`, `head.repo` de outro repositório ou `null`) e `classifyPr` (feature/processo/emenda, `PROCESS_PATHS`, `touchesGate` para **cada** item de `GATE_SELF_PATHS` incluindo `.gemini/styleguide.md`, `.claude/settings.json`, `docs/review-checklist.md`, `tests/unit/review/__snapshots__/workflows.md`; branch `^\d{3}-…`) — `tests/unit/review/authorship.test.ts`, `tests/unit/review/classify-pr.test.ts` (FR-011, FR-012, FR-013, FR-026)
- [x] T059 [P] Teste de `requiredChecksFromCi` (jobs sem `if` entram; `deploy-db`/`main-guard` com `if` ficam fora; job sem `name` ⇒ erro; e, lendo o `.github/workflows/ci.yml` real do repositório, o resultado contém os 4 jobs da 001 e nenhum job com `if`) — `tests/unit/review/ci-checks.test.ts` (FR-002)
- [x] T060 [P] Teste de `patchFingerprint` (ignora números dos cabeçalhos de hunk, independe da ordem dos arquivos, muda quando muda uma linha `+`/`-` ou o contexto, `null` sem `patch` ou com ≥ 300 arquivos, renomeação considera `previous_filename`) — `tests/unit/review/fingerprint.test.ts` (FR-007)
- [x] T009 Implementar `src/review/parse-verdict.ts`, `parse-responses.ts`, `authorship.ts`, `classify-pr.ts`, `ci-checks.ts`, `fingerprint.ts` até T006–T008, T059 e T060 passarem
- [ ] T010 ⚠️ Spike Gemini (risco alto, plan "Riscos"): Doug instala o Gemini Code Assist (consumer) só em `dougueta/prumo`; branch de teste com rascunho de `.gemini/config.yaml` + styleguide exigindo o bloco `prumo:veredito`; 3 PRs de teste; registrar em `specs/002-revisor-pr/research.md` R-01: (a) taxa de vereditos no formato; (b) de qual ref o Gemini lê config/styleguide (base ou head); (c) latência (SC-004); (d) se revisa sozinho ao passar de rascunho para pronto (FR-015) ou só na abertura; (e) se a re-revisão via `/gemini review` produz "Achados anteriores" coerente com a resposta `prumo:respostas` (FR-020); (f) se comenta uma mudança proposital no espelho `tests/unit/review/__snapshots__/workflows.md` (C5). Se (a) < 3/3 após ajuste do styleguide, ou (f) falhar → parar e levar ao Doug

**Checkpoint**: parsers prontos e viabilidade do veredito do Gemini (e do espelho) confirmada.

---

## Phase 3: US1 — Nada entra na `main` sem revisão independente (P1) 🎯 MVP

**Independent Test**: roteiro do quickstart §2, cenários 1, 2, 3, 5, 6, 7, 8, 11, 14, 15, 16, 17, 19, 20.

### Testes (escrever primeiro — todos vermelhos antes de T015–T024)
- [ ] T011 [P] [US1] Teste de `evaluateGate`: uma asserção por linha (0–14) da tabela de decisão de `contracts/review-gate.md`, ordem de precedência (regra 0 antes de rascunho e rótulos; trava da regra 9 para kind=emenda e `touchesGate`), regra 11 com e sem equivalência por impressão (rebase neutro → success com " (rebase neutro)"; impressão `null` → pending), re-revisão sem "Achados anteriores" completos desconsiderada, avisos (agente errado, fora do formato, incoerente, altera o portão), `reason` ≤ 140, mensagens só com textos do catálogo (título/corpo/branch do PR nunca aparecem) — `tests/unit/review/evaluate-gate.test.ts` (FR-002, FR-006–FR-013, FR-020, FR-024, FR-026)
- [ ] T012 [P] [US1] Teste de `mainGuard` (push): não-squash; sem PR; check obrigatório (derivado do `ci.yml`) ausente ou ≠ success; check run de app ≠ `github-actions` não conta; **status "Revisão independente" = success mas `evaluateGate` recalculado ≠ success ⇒ violação** (status forjado); PR externo integrado ⇒ violação; ok; PR `emergencia` gera issue pendente — `tests/unit/review/main-guard.test.ts` (FR-002, FR-004, FR-006, FR-024, FR-026)
- [ ] T013 [P] [US1] Teste de contrato do montador de `PrSnapshot` com `fetch` falso conforme `contracts/github-api.openapi.yaml` (headers `Accept`/`X-GitHub-Api-Version`/`Authorization`, paginação por `Link`, `user.login` e `head.repo.full_name` (inclusive `null`), associação `pull_request_review_id` → review, `specExists` via contents 404/200, patch da constitution, `fingerprints` via compare para head e para cada `headSha` de veredito, `ci.yml` lido com `ref=main`, check runs; política de erro: 403/429 com espera e 1 nova tentativa, 5xx, 422, 404 inesperado) — `tests/unit/review/github.test.ts` (FR-002, FR-007, FR-009, FR-026)
- [ ] T014 [P] [US1] Teste de `mergeReadiness` (exit 6 por check ou por `evaluateGate` recalculado, 7 por `behind_by > 0`, 8 sem TTY, 9 sem confirmação `revisei`/`emergencia` do `contracts/review-cli.md`) — `tests/unit/review/merge-readiness.test.ts` (FR-002, FR-003, FR-004)
- [ ] T061 [P] [US1] Teste dos workflows e da postura de repositório público (parse com `yaml`), para **todo** `.github/workflows/*.yml` da 002 (`review-gate.yml`, `main-guard.yml`, job `main-guard` do `ci.yml`): nenhum gatilho `pull_request`; nenhum `secrets.*` além de `GITHUB_TOKEN`; nenhum `environment`; todo `actions/checkout` com `ref: main` e `persist-credentials: false` (nunca `head.sha`/`head.ref`/`refs/pull`); nenhuma expressão `github.event.*` textual (`title`, `body`, `head.ref`, `head.label`, `comment.body`, `review.body`) em `run:` — só `…number` via `env`; `permissions: {}` no topo e permissões por job iguais às do contrato; `redispatch` só `actions: write` e sem checkout; gatilhos exatos e `concurrency` por PR no `review-gate.yml`; `ci.yml` com `main-guard` em `if` de push na `main` e `deploy-db.needs` contendo `main-guard`, nomes dos jobs de PR preservados; `main-guard.yml` só `schedule` (11:00 UTC) + `workflow_dispatch`. Inclui fixtures de workflows inseguros que o verificador precisa reprovar — `tests/unit/review/workflows.test.ts` (FR-001, FR-006, FR-024, FR-026)
- [ ] T072 [P] [US1] Teste do espelho dos workflows (C5): `tests/unit/review/__snapshots__/workflows.md` contém, em blocos nomeados por arquivo, o conteúdo exato de cada `.github/workflows/*.yml` (inclusive `ci.yml` e `keepalive.yml` da 001) e nenhum bloco de arquivo inexistente — `tests/unit/review/workflows-mirror.test.ts` (FR-014, FR-016)
- [ ] T062 [P] [US1] Teste de contrato de `scripts/review/gate.ts` com `fetch` falso: lê só `PR_NUMBER` (inteiro; inválido ⇒ exit 1); `POST statuses` com `context`, `state`, `description` ≤ 140 e `target_url`; comentário `prumo:avisos` criado/atualizado/apagado (idempotente, sem texto vindo do PR); erro de API → status pending "não foi possível avaliar…" + exit 1 — `tests/unit/review/gate-script.test.ts` (FR-006, FR-008, FR-010, FR-026)
- [ ] T063 [P] [US1] Teste de contrato de `scripts/review/main-guard.ts` (modo push) com `fetch` falso: cria issue `violacao-main` atribuída a `dougueta` só se não houver aberta com o mesmo título; exit 1 na violação; issue "Revisão pós-merge pendente" para `emergencia`; nada criado quando ok — `tests/unit/review/main-guard-script.test.ts` (FR-004, FR-024)
- [ ] T064 [P] [US1] Teste de `scripts/review/merge.ts` com `exec`/TTY/`prompt` falsos: chama `gh pr merge <n> --squash --delete-branch` somente quando `mergeReadiness` = pronto; nunca chama em qualquer exit ≠ 0; pede `revisei` quando `touchesGate` e `emergencia` quando emergência — `tests/unit/review/merge-script.test.ts` (FR-003, FR-004)
- [ ] T065 [P] [US1] Teste das configurações dos agentes: `.claude/settings.json` (`permissions.deny`) e `.gemini/settings.json` (`excludeTools`) contêm padrões que casam — com um casador que replica o curinga de prefixo — cada comando da lista de `contracts/review-cli.md` §Negação (`gh pr merge`, `npm run pr:merge`, `npm run review:publish`, `npm run gh:ruleset`, `gh api` merge/statuses/labels/rulesets, `gh pr edit … emergencia`, `gh repo edit`, leitura de `~/.prumo/**`) e **não** casam `git push origin 002-revisor-pr` nem `gh pr create` — `tests/unit/review/agent-settings.test.ts` (FR-004, FR-005, FR-009, FR-024)
- [ ] T066 [P] [US1] Teste de `buildRuleset` + `scripts/review/ruleset.ts` (corpo igual ao schema `Ruleset` do OpenAPI e ao data-model §7: `bypass_actors: []`, `deletion`, `non_fast_forward`, `required_linear_history`, `pull_request` com `allowed_merge_methods: ["squash"]`, `required_status_checks` estrito com `requiredChecksFromCi` + "Revisão independente", todos com `integration_id` 15368; `PUT` quando já existe "main protegida", `POST` senão; `--dry-run` sem escrita; 422 ⇒ exit 1) e de `scripts/review/repo-settings.ts` (corpo do `PATCH /repos` igual ao schema; `--dry-run` sem escrita) — `tests/unit/review/ruleset.test.ts`, `tests/unit/review/repo-settings.test.ts` (FR-001, FR-002, FR-003, FR-005)
- [ ] T067 [P] [US1] Teste dos documentos de processo: `docs/workflow.md`, `AGENTS.md`, `CLAUDE.md` e `GEMINI.md` contêm "exceção de bootstrap encerrada em AAAA-MM-DD", o trailer `Co-Authored-By: Gemini <noreply@google.com>` (AGENTS/GEMINI), a exigência dos rótulos `autor:*` + `iniciativa:N`, `npm run pr:merge`, "atualize o espelho dos workflows" e "rode `npm run gh:ruleset` ao mudar jobs do CI"; `docs/gemini-handoff.md` tem a seção "Revisões pendentes"; `README.md` tem a seção "Revisão de PRs" com custo R$ 0; `docs/adr/0007-protecao-main-repo-publico.md` existe, está no índice e tem as seções "Análise de ameaça — repositório público" e "Riscos residuais" — `tests/unit/review/process-docs.test.ts` (FR-023, FR-025, FR-026)

### Implementação
- [ ] T015 [US1] `src/review/evaluate-gate.ts` + `src/review/warnings-comment.ts` (algoritmo do plan) até T011 passar
- [ ] T016 [US1] `scripts/review/github.ts` (cliente mínimo, `fetch` injetável, `GITHUB_TOKEN`/`gh auth token`, política de erro do OpenAPI) até T013 passar
- [ ] T017 [US1] `scripts/review/gate.ts` (snapshot → `evaluateGate` → `POST statuses` + comentário de avisos + job summary) e `.github/workflows/review-gate.yml` (contrato review-gate), atualizando o espelho, até T061 (parte review-gate), T062 e T072 passarem (FR-006, FR-008, FR-010, FR-026)
- [ ] T018 [US1] `src/review/main-guard.ts` + `scripts/review/main-guard.ts` (modo push) + job `main-guard` ("Guarda da main") em `.github/workflows/ci.yml` com `deploy-db.needs: [..., main-guard]`, atualizando o espelho, até T012, T061 (parte ci.yml), T063 e T072 passarem (FR-002, FR-004, FR-005)
- [ ] T019 [US1] `src/review/merge-readiness.ts` + `scripts/review/merge.ts` (recalcula `evaluateGate`, check runs, `behind_by`, TTY, confirmações) até T014 e T064 passarem (FR-002, FR-003, FR-004)
- [ ] T020 *Removida (D1 = A, 2026-10-05)* — hook `.githooks/pre-push`: o ruleset recusa push direto no servidor
- [ ] T021 [P] [US1] `.claude/settings.json` (`permissions.deny`) e `.gemini/settings.json` (`excludeTools`; desativar shell interativo/PTY se a versão instalada oferecer) até T065 passar (FR-004, FR-005, FR-009)
- [ ] T022 [US1] `scripts/review/repo-settings.ts` com `--dry-run` até T066 (parte repo-settings) passar; ⚠️ Doug executa (FR-003)
- [ ] T023 [US1] `src/review/ruleset.ts` + `scripts/review/ruleset.ts` com `--dry-run` até T066 (parte ruleset) passar; ⚠️ Doug executa `npm run gh:ruleset` depois que o `review-gate` já publicou o status em ao menos um PR (senão o contexto não existe) (FR-001, FR-002, FR-005)
- [ ] T024 [US1] Documentação até T067 passar (exceto README, em T052): `docs/adr/0007-protecao-main-repo-publico.md` (D1 = A; ruleset; camadas mantidas e removidas com justificativa; **análise de ameaça do repositório público** do plan, incluindo os ajustes já aplicados em 2026-10-05; riscos residuais — status forjado por workflow da versão do PR, deny rules contornáveis/PTY, agente integrando PR já aprovado com o token do Doug, deploy de produção da Vercel sem esperar o `main-guard`; segredo de ferramenta local cifrado como interpretação do Princípio II) + índice em `docs/adr/README.md`; `docs/workflow.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`: fim da exceção de bootstrap com data, trailer `Co-Authored-By: Gemini <noreply@google.com>`, rótulos obrigatórios (`autor:*` + `iniciativa:N` + marco), `npm run pr:merge`, rebase neutro, emergência só pelo Doug e nunca em PR de constitution/mecanismos de revisão, espelho dos workflows, `gh:ruleset` ao mudar jobs do CI, PRs de terceiros não aceitos (FR-023, FR-026)
- [ ] T073 ⚠️ [US1] Auditoria do repositório público (Doug + Claude, registrada no ADR 0007): 0 alertas abertos de secret scanning (histórico inteiro); `.env.example` sem valores reais; `tests/fixtures/**` só sintéticos; nenhum dado financeiro real em docs/specs (Constitution II); environment `production` restrito à `main` e aprovação de workflows externos confirmados; proteção de PR de fork da Vercel ativa (FR-026)
- [ ] T025 [US1] Roteiro de aceite (quickstart §2, cenários 1, 2, 3, 5, 6, 7, 8, 11, 14, 15, 16, 17, 19, 20) em PRs de teste; para o SC-006, o Doug abre cada PR de teste e cronometra até identificar "pode integrar? / motivo" (≤ 1 min em 100% dos casos); evidências (links) no PR da 002 (SC-001, SC-002, SC-003, SC-006)

**Checkpoint**: ruleset e portão ativos — nenhum merge sem veredito válido; violações detectadas.

---

## Phase 4: US2 — Gemini revisa os PRs do Claude (P1)

**Independent Test**: PR `autor:claude` com float para dinheiro proposital → MUDANÇAS NECESSÁRIAS citando III → corrigir → `/gemini review` → APROVADO.

- [ ] T026 [P] [US2] Teste que valida `.gemini/config.yaml` (parse com `yaml`: `have_fun: false`, `memory_config.disabled: true`, `ignore_patterns` = R-01, `code_review.comment_severity_threshold: LOW`, `max_review_comments: -1`, `pull_request_opened: {code_review: true, summary: true, include_drafts: false, help: false}`; o espelho `tests/unit/review/__snapshots__/**` **não** está em `ignore_patterns`) e que `.gemini/styleguide.md` contém o modelo do bloco exatamente como em `contracts/veredito.md`, a instrução de "Achados anteriores" na re-revisão e a de revisar o espelho como se fossem os workflows — `tests/unit/review/gemini-config.test.ts` (FR-014, FR-015, FR-016, FR-020)
- [ ] T027 [US2] `.gemini/config.yaml` (research R-01) até T026 passar (FR-014, FR-015)
- [ ] T028 [US2] Atualizar `.gemini/styleguide.md`: terminar toda review com o bloco `prumo:veredito`, re-revisão com "Achados anteriores" cobrindo todos os # do veredito anterior e considerando o comentário `prumo:respostas`, português, não usar justificativas do corpo do PR antes de formar o veredito (insumo descrito na v1.2.0), revisar o espelho dos workflows, até T026 passar (FR-014, FR-016, FR-020)
- [ ] T029 [P] [US2] Atualizar `docs/review-checklist.md` (formato com marcador, "Achados anteriores", "Insumos lidos", resposta do autor em comentário) mantendo-o fonte única do formato; T006 usa os exemplos dele como fixture (FR-016, FR-019)
- [ ] T030 [US2] Teste de aceite da US2 em PR real (quickstart §2 cenário 4); medir latência na abertura e após `/gemini review` (SC-004) e registrar no PR da 002 (FR-015)

---

## Phase 5: US3 — Claude em contexto limpo revisa os PRs do Gemini (P2)

**Independent Test**: PR `autor:gemini` de teste com FR sem teste → `/revisar-pr <n>` + publicação pelo Doug → comentário de `prumo-revisor[bot]` apontando o FR, com "Insumos lidos" ⊆ manifest.

### Testes
- [ ] T031 [P] [US3] Teste de `appJwt` (gera par RSA no teste e cifra a chave PKCS#8 com senha; senha correta → JWT com header RS256, `iat` = now − 60, `exp` ≤ now + 600, `iss` = client id, assinatura verificável; senha incorreta → erro tipado) — `tests/unit/review/app-jwt.test.ts` (FR-009, FR-017)
- [ ] T032 [P] [US3] Teste de `buildBundlePlan` (spec/plan/tasks/data-model/contracts do head; checklist/constitution/ADRs da `main`; ausentes marcados `ausente`; sha256 no manifest; re-revisão inclui `anteriores/veredito.md` e `anteriores/respostas.md` só com tabelas `prumo:respostas`; nunca comentários livres; recusa `autor:claude`, `autor:doug`, rótulo ausente/ambíguo e autor externo/fork com exit 3) — `tests/unit/review/bundle.test.ts` (FR-017, FR-018, FR-020, FR-026)
- [ ] T033 [P] [US3] Teste de `formatPublication` (insere marcador `head=`, substitui "Insumos lidos" pelo manifest, rejeita veredito fora do formato com exit 2, recusa head divergente exit 4) — `tests/unit/review/publish-format.test.ts` (FR-017, FR-018)
- [ ] T068 [P] [US3] Teste de contrato de `scripts/review/publish.ts` com `fetch`/TTY/`prompt` falsos: `GET /repos/{repo}/installation` com JWT, `POST access_tokens` com corpo exatamente `{repositories:["prumo"], permissions:{pull_requests:"write"}}`, `POST issues/<n>/comments` com o token de instalação; senha, chave e token nunca aparecem em stdout/stderr (espiões); exit 5 sem `.env.review.local`/chave, exit 8 sem TTY, exit 9 senha incorreta — `tests/unit/review/publish-script.test.ts` (FR-009, FR-017)
- [ ] T069 [P] [US3] Teste de `scripts/review/bundle.ts` com `exec` falso (`gh pr view`, `git fetch`, `git diff`, `git show main:<arquivo>`): exits 0/1/3 do contrato, grava `.review/<n>/` e o manifest, nunca executa arquivo do PR — `tests/unit/review/bundle-script.test.ts` (FR-017, FR-018)

### Implementação
- [ ] T034 [US3] `src/review/app-jwt.ts` (`node:crypto`, chave cifrada + senha) até T031 passar
- [ ] T035 [US3] `src/review/bundle.ts` + `scripts/review/bundle.ts` (`gh`, `git fetch origin pull/<n>/head`, `.review/<n>/`) até T032 e T069 passarem
- [ ] T036 [US3] `src/review/publish-format.ts` + `scripts/review/publish.ts` (lê `.env.review.local`, exige TTY, pede a senha sem eco, token de instalação restrito, `POST issues/<n>/comments`; nunca loga segredos) até T033 e T068 passarem
- [ ] T037 [P] [US3] `.claude/agents/revisor-limpo.md` (tools: Read, Glob, Grep; postura do checklist; ler somente `.review/<n>/`; em re-revisão preencher "Achados anteriores" a partir de `anteriores/`; gravar `veredito.md`) (FR-018, FR-020)
- [ ] T038 [US3] `.claude/skills/revisar-pr/SKILL.md` (`/revisar-pr <n>`: bundle → subagente → instrui o Doug a rodar `npm run review:publish -- <n>` no terminal dele; a sessão principal não lê o pacote) (FR-017)
- [ ] T039 [US3] ⚠️ Doug cria e instala o GitHub App `prumo-revisor` (quickstart §1.2), cifra a chave com senha e preenche `.env.review.local`
- [ ] T040 [US3] Aceite: quickstart §2 cenários 9, 10 e 18; medir SC-005

---

## Phase 6: US4 — Template de PR e rótulos (P2)

**Independent Test**: PR novo vem com o template; sem rótulo de autor → failure.

- [ ] T070 [P] [US4] Teste do template: `.github/pull_request_template.md` contém as seções do FR-021 (Feature `NNN · Nome`, Artefatos com links spec/plan/tasks, Tipo feature·processo·emenda, Rótulos `autor:*` + `iniciativa:N`, Checklist do autor com os 5 itens + "espelho dos workflows atualizado" + "`gh:ruleset` reexecutado se mudou job do CI", "Motivo da emergência:", "Respostas aos achados" explicando que a resposta vai em comentário e com um exemplo de bloco `prumo:respostas` que `parseResponses` aceita) — `tests/unit/review/pr-template.test.ts` (FR-021, FR-024)
- [ ] T041 [P] [US4] Teste de `planLabels(existing, desired)` (cria faltantes, atualiza cor/descrição, nunca apaga; marcos idem) e de `scripts/review/labels.ts` com `fetch` falso (`--dry-run` sem escrita; 422 "já existe" tratado como atualização) — `tests/unit/review/labels.test.ts` (FR-022)
- [ ] T042 [US4] `.github/pull_request_template.md` até T070 passar (FR-021)
- [ ] T043 [US4] `src/review/labels.ts` + `scripts/review/labels.ts` (`--dry-run`) até T041 passar (FR-022)
- [ ] T044 [US4] ⚠️ Doug executa `npm run gh:labels` (rótulos e 11 marcos do data-model §5)
- [ ] T045 [US4] Aceite: PR novo exibe o template; quickstart §2 cenário 6 (FR-021)

---

## Phase 7: US5 — Ciclo achado → resposta → nova revisão (P3)

**Independent Test**: veredito com 3 achados, resposta para 2 → "achados sem resposta: #3"; responder o terceiro → segue.

- [ ] T046 [P] [US5] Teste do ciclo de ponta a ponta em `evaluateGate`, **apenas casos não cobertos por T011**: duas rodadas de MUDANÇAS seguidas (só a mais recente conta); respostas espalhadas em vários comentários; resposta publicada antes do veredito que pretende cobrir não conta; `corrigido` com sha fora dos commits do PR não conta; resposta de conta ≠ `dougueta` não conta; justificativa aceita × permanece em "Achados anteriores" — `tests/unit/review/review-cycle.test.ts` (FR-019, FR-020)
- [ ] T047 [US5] Ajustar `src/review/evaluate-gate.ts`/`parse-responses.ts` até T046 passar (se T046 já nascer verde em algum caso, registrar no commit que a cobertura veio de T015)
- [ ] T048 [US5] Aceite: quickstart §2 cenário 12 (SC-007)

---

## Phase 8: Emergência e transversais

- [ ] T049 [P] Teste do modo agendado do `mainGuard` (pendente, fechada ao achar veredito pós-merge, `VENCIDA —` após 7 dias, idempotência) — `tests/unit/review/emergency.test.ts` (FR-024)
- [ ] T050 `.github/workflows/main-guard.yml` (só `schedule` 11:00 UTC + `workflow_dispatch`) + modo agendado em `scripts/review/main-guard.ts`, atualizando o espelho, até T049, T061 (parte main-guard.yml) e T072 passarem (FR-024)
- [ ] T051 Aceite: quickstart §2 cenário 13 — emergência numa branch `NNN-slug` de feature já integrada; e trava (cenário 13b) (FR-024)
- [ ] T071 [P] Teste de custo zero: `package.json` não contém `@octokit/*`, `jsonwebtoken`, `@anthropic-ai/*` nem dependências além das existentes antes da 002 (lista registrada no teste); nenhum workflow usa `anthropics/claude-code-action` nem segredos de API paga (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) — `tests/unit/review/cost.test.ts` (FR-025, SC-008)
- [ ] T052 [P] `docs/gemini-handoff.md` (seção "Revisões pendentes" apontando a busca de PRs `autor:claude` com status pending; R5 marcada como substituída pela research da 002) e seção "Revisão de PRs" no `README.md` com custo R$ 0 (Gemini consumer, App, Actions gratuito em repo público) até T067 e T071 passarem (FR-023, FR-025, SC-008)
- [ ] T053 Rodar o `quickstart.md` inteiro do zero e corrigir divergências
- [ ] T054 Atualizar `docs/roadmap.md` (002 → `review`) e abrir PR `002 · Revisor de PR independente` com o template, rótulos `autor:claude` + `iniciativa:0` e milestone `0 · Plataforma`; último PR sob bootstrap (merge depois de 004, 003 e 006); o Gemini revisa os workflows pelo espelho

---

## Dependencies & Execution Order

- **T055 (pré-requisitos) bloqueia tudo** (T001 já decidida). Phase 1 → Phase 2 → histórias. T010 (spike) bloqueia US2 e o uso real do portão.
- Dentro de cada fase, **todo teste (T011–T014, T059–T072) precede a implementação que ele cobre** (indicada em "até T0xx passar").
- **US1** depende da Phase 2; T023 (`gh:ruleset`) depois de o `review-gate` publicar o status ao menos uma vez. **US2** depende de T010 e US1. **US3** depende da Phase 2 e de T016; aceite (T040) depende de US1.
- **US4** independente após Phase 1 (T070 → T042 pode sair cedo); T045 depende de US1.
- **US5** depende de US1 (T015).
- Phase 8 depende de T018.

## Parallel Opportunities

- Phase 1: T003, T004, T005 juntos. Phase 2: T006, T007, T008, T059, T060 juntos.
- US1: T011–T014 e T061–T067, T072 juntos; T021 em paralelo com T015–T019.
- US3 (T031–T033, T068, T069, T037) e US4 (T070, T041) em paralelo com US1 (arquivos disjuntos).

## Implementation Strategy

1. Pré-requisitos + spike (T055, T010) primeiro.
2. MVP = Phases 1–2 + US1 + US2: PRs do Claude (maioria do roadmap) passam a ter portão e ruleset.
3. US3 antes da onda 3 (primeira feature do Gemini é a 010).
4. US4, US5, Phase 8; PR final sob a exceção de bootstrap.

## Rastreabilidade FR → Tasks → Testes (100%)

| FR | Tasks (implementação/ação) | Testes |
|---|---|---|
| 001 | T001, T017, T018, T023, T025 | T061, T066 |
| 002 | T009, T015, T017, T018, T019, T023 | T011, T012, T013, T014, T059, T066 |
| 003 | T019, T022, T023 | T014, T064, T066 |
| 004 | T018, T019, T021 | T012, T014, T063, T064, T065 |
| 005 | T018, T021, T023 | T065, T066 |
| 006 | T015, T017, T018 | T011, T012, T061, T062 |
| 007 | T009, T015 | T006, T011, T013, T060 |
| 008 | T015, T017 | T011, T062 |
| 009 | T016, T021, T034, T036 | T011, T013, T031, T065, T068 |
| 010 | T015, T017 | T006, T011, T062 |
| 011 | T009, T015 | T008, T011 |
| 012 | T009, T015 | T008, T011 |
| 013 | T009, T015 | T008, T011 |
| 014 | T017, T018, T027, T028, T050 | T026, T072 |
| 015 | T027, T030 | T026 |
| 016 | T010, T028, T029 | T006, T026, T072 |
| 017 | T035, T036, T038, T039 | T031, T032, T033, T068, T069 |
| 018 | T035, T037, T040 | T032, T033, T069 |
| 019 | T009, T029, T047 | T007, T046 |
| 020 | T015, T028, T037, T047 | T006, T011, T026, T032, T046 |
| 021 | T042, T045 | T070 |
| 022 | T043, T044 | T041 |
| 023 | T024, T052 | T067 |
| 024 | T015, T018, T050, T051 | T011, T012, T049, T061, T063, T065, T070 |
| 025 | T052 | T067, T071 |
| 026 | T009, T015, T016, T017, T024, T073 | T008, T011, T012, T013, T032, T061, T062, T067 |

Critérios de sucesso: SC-001 (T018, T025; teste T012) · SC-002 (T023, T025; T066) ·
SC-003 (T025) · SC-004 (T010, T030) · SC-005 (T040) · SC-006 (T017, T025) · SC-007 (T048; T046) ·
SC-008 (T052; T071).

Tasks sem FR direto (setup/processo): T002, T003, T004, T005, T053, T054, T055, T056.
Removidas (D1 = A): T020, T057, T058.
