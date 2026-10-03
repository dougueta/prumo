# Tasks: Setup do Projeto Prumo

**Input**: `specs/001-setup-projeto/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto

---

## Phase 1: Setup (infraestrutura compartilhada)

- [x] T001 Inicializar app Next.js 16 + TS 5.9 strict + Tailwind 4 (sem exemplos) na raiz; `package.json` com `engines.node >=24`, `.nvmrc` = 24 — `package.json`, `tsconfig.json`, `next.config.ts`
- [x] T002 [P] Configurar ESLint 10 flat (`eslint-config-next`, `typescript-eslint` type-checked, regra proibindo `process.env` fora de `src/lib/env.ts`) e Prettier 3.9 — `eslint.config.mjs`, `prettier.config.mjs`
- [x] T003 [P] Configurar Vitest 5 (+ Testing Library, `TZ=America/Sao_Paulo`, projetos `unit` e `integration`) — `vitest.config.ts`, `tests/setup.ts`
- [x] T004 [P] Configurar Playwright 1.63 (projetos `chromium`, `mobile-chrome`, `demo` com `APP_ENV=preview`; webServer `next start`) — `playwright.config.ts`
- [x] T005 [P] Inicializar Supabase CLI (`supabase init`, projeto `prumo`, porta padrão) — `supabase/config.toml`
- [x] T006 Scripts npm: `dev`, `dev:setup`, `dev:demo`, `build`, `start`, `lint`, `format`, `typecheck`, `check`, `test:unit`, `test:integration`, `test:e2e`, `synthetic`; `dev:setup` em Node (multiplataforma) roda `supabase start`, aplica migrações e escreve `.env.local` — `package.json`, `scripts/dev-setup.mjs` (FR-001, FR-005)

## Phase 2: Foundational (bloqueia todas as histórias)

- [x] T007 [P] Teste unit de `loadEnv()`: schemas local/preview/production, proteção cruzada `VERCEL_ENV`, mensagem lista só nomes e nunca valores — `tests/unit/env.test.ts` (FR-003)
- [x] T008 Implementar `src/lib/env.ts` (zod 4) e `src/lib/app-env.ts` (`getAppEnv`, `isDemo`) até T007 passar (FR-003)
- [x] T009 [P] Criar `.env.example` com o catálogo do data-model §3 (descrições, sem valores reais) e teste que garante que todo campo do schema está no exemplo — `.env.example`, `tests/unit/env-example.test.ts` (FR-004)
- [x] T010 Validar env no boot via `src/instrumentation.ts` (falha imediata) (FR-003)
- [x] T011 [P] `src/lib/format.ts` (moeda/data `pt-BR`, `America/Sao_Paulo`) com testes — `tests/unit/format.test.ts` (FR-021)

**Checkpoint**: configuração validada; histórias podem começar.

---

## Phase 3: US1 — Rodar o app localmente com um comando (P1) 🎯 MVP

**Independent Test**: máquina limpa → `quickstart.md` → tela "Prumo" + `/api/health` ok.

### Testes (escrever primeiro)
- [x] T012 [P] [US1] Teste unit de `checkHealth()`: ok, degraded (erro/timeout 3 s), demo, sem vazamento de mensagem de erro — `tests/unit/health.test.ts` (FR-002)
- [x] T013 [P] [US1] Teste de integração: `health_ping()` no Supabase local e `GET /api/health` real valida contra `contracts/health.openapi.yaml` — `tests/integration/health.int.test.ts` (FR-002)
- [x] T014 [P] [US1] E2E: home exibe "Prumo" em `lang=pt-BR`; health 200 — `tests/e2e/home.spec.ts` (FR-001, FR-021)

### Implementação
- [x] T015 [US1] Migração `supabase/migrations/<ts>_health_ping.sql` conforme data-model §1
- [x] T016 [US1] `src/lib/supabase/server.ts` (`server-only`, chave secreta) 
- [x] T017 [US1] `src/lib/health.ts` (`checkHealth` puro, injetável) até T012 passar
- [x] T018 [US1] `src/app/api/health/route.ts` (`Cache-Control: no-store`, 503 em degraded) até T013 passar
- [x] T019 [US1] `src/app/layout.tsx` + `src/app/page.tsx` mínimos ("Prumo", tema por sistema) até T014 passar
- [x] T020 [US1] Seção "Início rápido" no `README.md` espelhando `quickstart.md` + validar em Windows Git Bash (FR-001, FR-005, SC-001)

**Checkpoint**: US1 funcional e testada.

---

## Phase 4: US2 — Mudanças quebradas não chegam à `main` (P1)

**Independent Test**: PR com erro de tipo proposital falha; corrigido, passa em ≤ 10 min.

- [x] T021 [US2] Workflow `ci.yml`: gatilhos `pull_request` + `push main`; jobs paralelos `quality` (lint, format:check, typecheck), `unit`, `integration` (setup-cli + `supabase start` + migrações), `e2e` (build + Playwright + upload do relatório); caches de npm, Playwright e Docker — `.github/workflows/ci.yml` (FR-006, FR-007, FR-008)
- [x] T022 [US2] Garantir que nenhum teste usa rede externa: `tests/setup.ts` bloqueia `fetch` para hosts não-locais — com teste que comprova o bloqueio — `tests/unit/no-external-network.test.ts` (FR-008)
- [ ] T023 [US2] PR de verificação: branch temporária com erro de tipo → CI vermelho; registrar evidência no PR da 001 e apagar branch (FR-007, SC-002, SC-003)

**Checkpoint**: rede de segurança ativa.

---

## Phase 5: US3 — Doug vê cada mudança antes de aprovar (P2)

**Independent Test**: PR muda texto da home → link de preview com selo demo; merge → produção atualizada.

### Testes
- [ ] T024 [P] [US3] Teste unit da trava: 401 sem/ com credencial errada, passa com correta, rotas isentas, comparação em tempo constante — `tests/unit/production-gate.test.ts` (FR-013)
- [ ] T025 [P] [US3] E2E projeto `demo`: selo "Demonstração — dados fictícios" visível e `/api/health` com `data.status=demo` — `tests/e2e/demo.spec.ts` (FR-011)

### Implementação
- [ ] T026 [US3] `src/components/demo-badge.tsx` no layout quando `isDemo()` até T025 passar (FR-011)
- [ ] T027 [US3] `src/proxy.ts` (trava Basic Auth só em `production`) até T024 passar (FR-013)
- [ ] T028 [US3] ⚠️ Ação externa (confirmar com Doug): criar projeto Supabase gratuito `prumo` (sa-east-1, org `doug_lab`); aplicar migrações (FR-012)
- [ ] T029 [US3] ⚠️ Ação externa (confirmar com Doug): criar projeto Vercel `prumo` (time `doug-lab`) ligado ao repo; envs: Preview = `APP_ENV=preview` sem `SUPABASE_*`; Production = Supabase + `PRODUCTION_GATE_*`; habilitar Vercel Authentication para previews (FR-010, FR-011, FR-012, FR-013)
- [ ] T030 [US3] Job `deploy-db` no `ci.yml` (só `main`): `supabase db push` com segredos do GitHub; documentar segredos necessários no README (FR-012)
- [ ] T031 [US3] Verificação ponta a ponta: PR de teste mostra link de preview em ≤ 5 min; dois previews independentes; merge atualiza produção; produção pede credenciais (SC-004)

**Checkpoint**: ciclo PR → preview → produção funcionando.

---

## Phase 6: US4 — Dados sintéticos realistas (P2)

**Independent Test**: mesma semente ⇒ JSON idêntico; outra semente ⇒ diferente e válido.

### Testes
- [ ] T032 [P] [US4] Teste unit do PRNG (`mulberry32` determinístico) — `tests/unit/synthetic/prng.test.ts`
- [ ] T033 [P] [US4] Teste das invariantes do data-model §5 (inteiros, pares de transferência somam 0, parcelas consecutivas, contagens mínimas, `synthetic: true`, sem dados reais) + determinismo byte a byte + desempenho ≤ 30 s — `tests/unit/synthetic/generate.test.ts` (FR-014, FR-015, FR-018, SC-006)
- [ ] T034 [P] [US4] Testes dos exportadores CSV (`;`, vírgula decimal, BOM) e OFX 2.x (XML válido, `FITID` estável) — `tests/unit/synthetic/exporters.test.ts` (FR-016)
- [ ] T035 [P] [US4] Teste da CLI: recusa com exit 2 em `APP_ENV=production`; exit 1 com `--months 11` — `tests/unit/synthetic/cli.test.ts` (FR-017)

### Implementação
- [ ] T036 [US4] `src/synthetic/prng.ts` até T032 passar
- [ ] T037 [US4] `src/synthetic/profile.ts` + `src/synthetic/generate.ts` (algoritmo do plan) até T033 passar
- [ ] T038 [P] [US4] `src/synthetic/export-csv.ts` e `src/synthetic/export-ofx.ts` até T034 passar
- [ ] T039 [US4] `src/synthetic/cli.ts` + script `npm run synthetic` até T035 passar
- [ ] T040 [US4] Gerar e versionar `tests/fixtures/synthetic/` (seed 42) + teste de CI que regenera e compara (fixture nunca fica desatualizada)

**Checkpoint**: dados sintéticos disponíveis para todas as features.

---

## Phase 7: US5 — App instalável no celular (P3)

**Independent Test**: instalar em Android/iOS a partir da produção; modo avião → página offline.

- [ ] T041 [P] [US5] E2E: `/manifest.webmanifest` válido (nome "Prumo", `display: standalone`, ícones 192/512/maskable), service worker registrado, navegação offline cai em `/~offline` — `tests/e2e/pwa.spec.ts` (FR-019, FR-020)
- [ ] T042 [US5] Ícones em `public/icons/` (192, 512, maskable, apple-touch) e `src/app/manifest.ts`
- [ ] T043 [US5] Service worker `public/sw.js` (precache `/~offline`, navegação network-first com fallback) + registro em `src/components/sw-register.tsx` + `src/app/~offline/page.tsx` ("Você está sem conexão") até T041 passar
- [ ] T044 [US5] Verificação manual em Android (Chrome) e iOS (Safari) — evidência (prints sem dados) no PR (SC-007)

---

## Phase 8: Polish & transversais

- [ ] T045 [P] Workflow `keepalive.yml` (cron diário 12:00 UTC → `GET $PRODUCTION_URL/api/health`, falha se ≠ 200 `ok`) (FR-023)
- [ ] T046 [P] Teste do keepalive com `act`/dry-run documentado ou script `scripts/keepalive-check.mjs` testado em unit — `tests/unit/keepalive.test.ts` (FR-023)
- [ ] T047 Registrar custo R$ 0 no README (planos usados e limites: Vercel Hobby, Supabase Free, Actions 2.000 min) (FR-022)
- [ ] T048 Rodar `quickstart.md` do zero num clone limpo e corrigir divergências (SC-001)
- [ ] T049 Atualizar `docs/roadmap.md` (001 → `review`) e abrir PR `001 · Setup do projeto` com rótulos `autor:claude`, milestone `0 · Plataforma`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → histórias. US1 e US2 (P1) primeiro; US2 depende de US1 existir para ter o que testar no CI.
- US3 depende de US1 (health) e US2 (CI); T028–T029 exigem confirmação do Doug.
- US4 depende só da Phase 2 — **pode rodar em paralelo com US1–US3**.
- US5 depende de US1; T044 depende de T029 (produção no ar).
- Phase 8 depende de US3 (URL de produção).

## Parallel Opportunities

- Phase 1: T002, T003, T004, T005 juntos.
- US1: T012, T013, T014 juntos (testes).
- US4 inteira em paralelo com US1–US3 (subagente/worktree próprio dentro da mesma feature não é necessário: arquivos disjuntos em `src/synthetic/`).
- US4: T032–T035 juntos; T038 em paralelo com T037.

## Implementation Strategy

1. MVP: Phases 1–2 + US1 + US2 → base local testável com CI.
2. US4 em paralelo (desbloqueia testes das features 004+).
3. US3 (publicação) após confirmação das ações externas.
4. US5 e Polish; PR para revisão (Gemini) + Gate 3.

## Rastreabilidade FR → Tasks

| FR | Tasks | | FR | Tasks |
|---|---|---|---|---|
| 001 | T006, T014, T020 | | 013 | T024, T027, T029 |
| 002 | T012, T013, T017, T018 | | 014 | T033, T037 |
| 003 | T007, T008, T010 | | 015 | T033 |
| 004 | T009 | | 016 | T034, T038 |
| 005 | T006, T020 | | 017 | T035, T039 |
| 006 | T021 | | 018 | T033 |
| 007 | T021, T023 | | 019 | T041, T042 |
| 008 | T021, T022 | | 020 | T041, T043 |
| 009 | T012–T014 | | 021 | T011, T014 |
| 010 | T029, T031 | | 022 | T047 |
| 011 | T025, T026, T029 | | 023 | T045, T046 |
| 012 | T028, T030 | | | |
