# Tasks: Login

**Input**: `specs/006-login/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto
- ⚠️ = ação externa: confirmar com Doug no momento

---

## Phase 1: Setup

- [ ] T001 Adicionar dependências fixadas `@supabase/ssr@0.12.7`, `@simplewebauthn/server@14.0.3`, `@simplewebauthn/browser@14.0.0` e dev `msw@3.0.2`; registrar justificativa no PR (research R-15) — `package.json`, `package-lock.json`
- [ ] T002 [P] Criar projeto Vitest `contract` (MSW, sem rede) e pasta `tests/contract/auth/`; script `test:contract` incluído em `check` — `vitest.config.ts`, `package.json`
- [ ] T003 [P] Configurar `[auth]` do Supabase local conforme data-model §8 (cadastro desligado, OTP 6 dígitos/600 s, `max_frequency 60s`, `site_url`/redirect `http://127.0.0.1:3000`, Google via `env(...)` opcional) e template `supabase/templates/codigo.html` só com `{{ .Token }}` — `supabase/config.toml` (FR-001, FR-003, FR-004)
- [ ] T004 [P] Playwright: projeto `auth` usando `127.0.0.1`, helper que lê o último código do Mailpit (`:57324`) e helper de autenticador WebAuthn virtual via CDP (`WebAuthn.addVirtualAuthenticator`, `isUserVerified: true`) — `playwright.config.ts`, `tests/e2e/helpers/mailpit.ts`, `tests/e2e/helpers/webauthn.ts`

## Phase 2: Foundational (bloqueia todas as histórias)

### Testes (escrever primeiro)
- [ ] T005 [P] Unit de `parseEnv()`: novos campos (`SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS` ≥ 1 e-mail válido normalizado, `AUTH_HASH_SECRET` ≥ 32, `APP_ORIGIN` URL), `PRODUCTION_GATE_*` não exigidos mais, `preview` falha se houver `AUTH_*`/`APP_ORIGIN`; mensagem só com nomes — `tests/unit/env.test.ts` (FR-022, FR-028)
- [ ] T006 [P] Unit das funções puras: `normalizeEmail`/`isAllowed` (maiúsculas/espaços), `hmacHex`, `maskEmail` (vetores do plan), `safeNext` (`//evil`, `/\evil`, `https://x`, `/entrar`, > 512 ⇒ `/`), `describeDevice` (iPhone/Android/Windows/macOS), `geoFromHeaders` — `tests/unit/auth/pure.test.ts` (FR-001, FR-006, FR-018)
- [ ] T007 [P] Unit de `evaluateSession()`: todos os estados e a ordem das regras; transições proibidas do plan; limites exatos (15 min, 30 d, 90 d) com relógio injetado — `tests/unit/auth/session-state.test.ts` (FR-010, FR-011, FR-012)
- [ ] T008 [P] Unit de `evaluateRateLimit()` e `classifyOtpFailure()`: limiares 5/15 min por e-mail e IP, 60 s, 5/h, 10/h por IP, janela deslizante, `login_blocked` não conta como falha; `expired`/`used`/`wrong_code` — `tests/unit/auth/rate-limit.test.ts`, `tests/unit/auth/otp-classify.test.ts` (FR-004, FR-005)
- [ ] T009 [P] Integração (Supabase local/CI): migração cria as 3 tabelas com RLS+FORCE; `anon` não lê nada; `authenticated` só lê as próprias linhas; nenhum papel faz UPDATE/DELETE em `access_events` (gatilho) exceto com `prumo.retention = on`; constraints de `app_sessions` (90 d, `ended_at`/`end_reason`); job `pg_cron` registrado — `tests/integration/auth/schema.int.test.ts` (FR-019, FR-020, FR-021)

### Implementação
- [ ] T010 Atualizar `src/lib/env.ts` + `.env.example` + `tests/unit/env-example.test.ts` (catálogo data-model §7) e `scripts/dev-setup.mjs` (preenche `SUPABASE_PUBLISHABLE_KEY`, `AUTH_HASH_SECRET` aleatório, `APP_ORIGIN`) até T005 passar (FR-022)
- [ ] T011 [P] Implementar puros em `src/lib/auth/{allowlist,crypto,safe-next,device}.ts` até T006 passar
- [ ] T012 [P] Implementar `src/lib/auth/session-state.ts` até T007 passar
- [ ] T013 [P] Implementar `src/lib/auth/{rate-limit,otp-classify,neutral-timing}.ts` até T008 passar
- [ ] T014 Migração `supabase/migrations/<ts>_auth_sessions_events.sql` (tipos, tabelas, índices, RLS, gatilho somente-inserção, `pg_cron` de retenção — data-model §1–§6) até T009 passar
- [ ] T015 `src/lib/auth/supabase-clients.ts`: `createAuthClient()` com `@supabase/ssr` + `cookies()` do Next, forçando `httpOnly`, `secure` (≠ local), `sameSite: "lax"`, `maxAge` ≤ 90 d; `createAdminClient()` (chave secreta, `server-only`) (FR-023)
- [ ] T016 `src/lib/auth/service.ts` (interface `AuthService`, `getAuthService()` só por `loadEnv().APP_ENV`) + `src/lib/auth/events.ts` (`recordEvent` com hash/máscara/geo/device; nunca recebe token/código) (FR-017, FR-018, FR-019)
- [ ] T017 Script `scripts/auth-provision.mjs` (`npm run auth:provision`): cria/garante o(s) usuário(s) de `AUTH_ALLOWED_EMAILS` com `email_confirm: true`, idempotente, sem imprimir e-mails completos; e `scripts/auth-age-session.mjs` (`npm run auth:age-session`, recusa fora de `local`) (FR-001)

**Checkpoint**: configuração, banco e lógica pura prontos.

---

## Phase 3: US1 — Entrar e manter tudo fechado (P1) 🎯 MVP

**Independent Test**: sem sessão toda rota interna vai para `/entrar`; e-mail autorizado entra com código; e-mail estranho recebe resposta neutra e não ganha sessão.

### Testes (escrever primeiro)
- [ ] T018 [P] [US1] Contrato (MSW simulando Supabase Auth): `requestCode` — formato inválido, autorizado (chama `/otp` com `create_user: false`), não autorizado (não chama), bloqueado, provedor com erro (resposta continua neutra); mesmos cookies/redirect; piso de 1.500 ms — `tests/contract/auth/request-code.test.ts` (FR-002, FR-005, SC-002)
- [ ] T019 [P] [US1] Contrato: `verifyCode` — formato, `WRONG_CODE`, `EXPIRED_OR_USED`, `TOO_MANY`, sucesso ⇒ `establishSession` (linha + evento) e `redirect(safeNext)` — `tests/contract/auth/verify-code.test.ts` (FR-004, FR-005, FR-006)
- [ ] T020 [P] [US1] Contrato: `/auth/callback` — sucesso autorizado, e-mail fora da lista (sessão revogada, `erro=recusado`), erro "signup disabled" do Supabase (mesma recusa), `code` ausente/provedor fora (`erro=indisponivel`), `prumo_next` respeitado só se seguro — `tests/contract/auth/callback.test.ts` (FR-001, FR-002, FR-003, FR-006)
- [ ] T021 [P] [US1] Unit estático `protected-surface`: todo `route.ts` e todo arquivo `"use server"` em `src/app/` fora da lista pública de `auth-flows §1` importa e chama `requireSession`; nenhum arquivo fora de `src/lib/auth/` lê cookies `sb-*` ou importa `createAdminClient` — `tests/unit/auth/protected-surface.test.ts` (FR-007, SC-001)
- [ ] T022 [P] [US1] E2E: login por código via Mailpit até a tela inicial e volta ao `next`; e-mail não autorizado ⇒ mensagem neutra e Mailpit vazio; 5 códigos errados ⇒ bloqueio; código expirado (envelhecido via SQL) ⇒ mensagem; varredura de rotas internas e `/api/auth/status` sem cookie ⇒ `/entrar`/401 — `tests/e2e/auth/login.spec.ts` (FR-001–FR-008, SC-001, SC-003, SC-007)
- [ ] T023 [P] [US1] Integração de tempo: 50 pedidos autorizados × 50 não autorizados contra o Supabase local; diferença média < 100 ms — `tests/integration/auth/neutral-timing.int.test.ts` (SC-002)

### Implementação
- [ ] T024 [US1] `src/lib/auth/sessions.ts` (`establishSession`) e `src/lib/auth/dal.ts` (`requireSession`, `getDataClient`, contrato `dal.md`) usando `evaluateSession` (FR-007, FR-011)
- [ ] T025 [US1] `src/lib/auth/supabase-service.ts`: `requestCode`, `verifyCode`, `startGoogle`, `completeGoogle` conforme `auth-flows §4` (FR-002–FR-005)
- [ ] T026 [US1] Server Actions `src/app/(public)/entrar/actions.ts` + páginas `entrar/page.tsx` e `entrar/codigo/page.tsx` (pt-BR, mobile, claro/escuro, `inputmode="numeric"`, `autocomplete="one-time-code"`) até T018/T019 passarem (FR-003, FR-029)
- [ ] T027 [US1] Route Handler `src/app/auth/callback/route.ts` até T020 passar (FR-003)
- [ ] T028 [US1] Reescrever `src/proxy.ts` (auth-flows §2) e **remover** `src/lib/production-gate.ts` + `tests/unit/production-gate.test.ts`; mover a home para `src/app/(app)/page.tsx` com `src/app/(app)/layout.tsx` chamando `requireSession()`; `Cache-Control: private, no-store` em páginas protegidas até T021/T022 passarem (FR-007, FR-008, FR-009, FR-028)
- [ ] T029 [US1] Atualizar contrato da 001: marcar `specs/001-setup-projeto/contracts/production-gate.md` como substituído por `specs/006-login/contracts/auth-flows.md` (nota no topo) (FR-028)

**Checkpoint**: produção pode ser protegida pelo login (MVP de segurança).

---

## Phase 4: US2 — Continuar logado no celular com segurança (P1)

**Independent Test**: com sessão ativa reabrir vai direto; após 15 min sem uso pede biometria/PIN; após 30 d sem uso ou 90 d totais pede entrada completa.

### Testes
- [ ] T030 [P] [US2] Contrato das rotas WebAuthn (`register/options|verify`, `unlock/options|verify`, `/api/auth/status`) contra `contracts/auth-api.openapi.yaml`: janela de cadastro de 10 min, desafio de uso único/expirado, 409 sem credencial, 5ª falha ⇒ 401 e `end_reason unlock_failures`, `Origin` diferente de `APP_ORIGIN` ⇒ 403 — `tests/contract/auth/webauthn.test.ts` (FR-012)
- [ ] T031 [P] [US2] E2E com autenticador virtual: cadastrar biometria após login; `auth:age-session --minutes 16` ⇒ `/desbloquear`; desbloquear ⇒ volta ao `next`, `absolute_expires_at` inalterado; sem credencial ⇒ "Entrar novamente"; sessão idle 31 d e absoluta 91 d ⇒ `/entrar` com evento único `session_expired` — `tests/e2e/auth/session-lock.spec.ts` (FR-010, FR-011, FR-012, SC-004, SC-009)
- [ ] T032 [P] [US2] E2E: Server Action protegida com sessão encerrada no meio ⇒ nada gravado, mensagem "Sua sessão expirou…", volta à mesma tela após entrar; SessionGuard cobre a tela ao voltar de 15 min oculta (relógio do Playwright) — `tests/e2e/auth/mid-action.spec.ts` (FR-009, FR-013)

### Implementação
- [ ] T033 [US2] `src/lib/auth/webauthn.ts` + Route Handlers `src/app/api/auth/webauthn/{register,unlock}/{options,verify}/route.ts` e `src/app/api/auth/status/route.ts` (validação de `Origin`) até T030 passar (FR-012)
- [ ] T034 [US2] Página `src/app/(app)/desbloquear/page.tsx` + `src/components/auth/unlock-button.tsx` (WebAuthn só por gesto do usuário; fallback "Entrar novamente") e `src/components/auth/enroll-biometrics.tsx` (oferta após login e em `/seguranca`) até T031 passar (FR-012, FR-029)
- [ ] T035 [US2] `src/components/auth/session-guard.tsx` no `layout.tsx` raiz e `src/components/auth/use-auth-aware-action.ts` até T032 passar (FR-009, FR-013)
- [ ] T036 [US2] ⚠️ Verificação manual em aparelho real (confirmar com Doug): iPhone com Prumo instalado na tela inicial e Android Chrome — login Google, login por código, cadastro de Face ID/digital, desbloqueio após 15 min, reabrir em ≤ 2 s; evidência sem dados no PR (FR-003, FR-012, SC-003, SC-004)

**Checkpoint**: uso diário no celular viável e seguro.

---

## Phase 5: US3 — Sair e encerrar sessões em outros dispositivos (P2)

**Independent Test**: dois contextos logados; "Sair de todos" em A ⇒ B perde acesso na próxima ação.

### Testes
- [ ] T037 [P] [US3] E2E: "Sair" ⇒ `/entrar`, botão voltar não mostra dados, evento `logout`; dois contextos ⇒ `signOutEverywhere` com confirmação ⇒ B recebe 401 em < 1 min, todas as linhas `logout_all`; lista de sessões com a atual marcada — `tests/e2e/auth/logout.spec.ts` (FR-009, FR-014, FR-015, FR-016, SC-005)

### Implementação
- [ ] T038 [US3] `endSession`, `endAllSessions` (+ `auth.admin.signOut`), `listSessions` em `src/lib/auth/sessions.ts` e Server Actions `src/app/(app)/seguranca/actions.ts` (FR-014, FR-015)
- [ ] T039 [US3] Seção "Dispositivos conectados" em `src/app/(app)/seguranca/page.tsx` (descrição, início, último uso, "este dispositivo", botão com confirmação) até T037 passar (FR-016, FR-029)

---

## Phase 6: US4 — Consultar o histórico de acessos (P2)

**Independent Test**: gerar cada tipo de evento e vê-lo no histórico em ordem, sem segredos.

### Testes
- [ ] T040 [P] [US4] Integração: cada tipo de FR-017 é gravado por seu fluxo; nenhuma coluna contém código, `code` OAuth, token, `session_id` de cookie ou e-mail não autorizado completo (varredura por regex nos valores); `listEvents` retorna 90 dias em ordem decrescente, incluindo eventos com `owner_id` nulo — `tests/integration/auth/events.int.test.ts` (FR-017–FR-021, SC-006)
- [ ] T041 [P] [US4] Unit: logger do app nunca recebe cookies/tokens (wrapper redige chaves `token`, `code`, `authorization`, `cookie`) — `tests/unit/auth/log-redaction.test.ts` (FR-019)

### Implementação
- [ ] T042 [US4] `listEvents()` em `src/lib/auth/events.ts` + seção "Histórico de acessos" em `/seguranca` (tipo em pt-BR, data/hora `America/Sao_Paulo` via `src/lib/format.ts`, método, dispositivo, local aproximado) até T040 passar (FR-018, FR-020)
- [ ] T043 [US4] Redação de logs em `src/lib/log.ts` (ou no ponto único de log existente) até T041 passar (FR-019)

---

## Phase 7: US5 — Pré-visualizações em modo demonstração (P3)

**Independent Test**: preview entra direto como "Usuário Demonstração" com selo; nada disso é ativável em produção.

### Testes
- [ ] T044 [P] [US5] Unit `demo-isolation`: com `APP_ENV=production`/`local`, `getAuthService()` é Supabase para qualquer cookie (`prumo_demo_out`), header ou query; `DemoAuthService` não é importado por nenhum caminho de produção sem passar por `getAuthService` — `tests/unit/auth/demo-isolation.test.ts` (FR-026)
- [ ] T045 [P] [US5] E2E projeto `demo`: entrada automática com selo; "Sair" ⇒ `/entrar` simulada; `demo@prumo.invalid` + `246810` entra; outro e-mail neutro; `111111` expirado; 5 erros ⇒ bloqueio; `/seguranca` com sessões/eventos fictícios que somem ao recarregar; Google "Indisponível na demonstração" — `tests/e2e/auth/demo.spec.ts` (FR-024, FR-025, SC-008)

### Implementação
- [ ] T046 [US5] `src/lib/auth/demo-service.ts` (data-model §9; eventos sintéticos determinísticos) até T044/T045 passarem (FR-024, FR-025, FR-026)
- [ ] T047 [US5] ⚠️ Confirmar com Doug que o ambiente Preview da Vercel continua com Vercel Authentication e **sem** `AUTH_*`/`APP_ORIGIN`/`SUPABASE_*` (FR-027)

---

## Phase 8: Polish, produção e transversais

- [ ] T048 [P] Verificar acessibilidade/UX das telas de auth (rótulos, foco, contraste claro/escuro, 360 px) com teste axe no Playwright — `tests/e2e/auth/a11y.spec.ts` (FR-029)
- [ ] T049 ⚠️ Google Cloud (confirmar com Doug): projeto `prumo`, consentimento externo publicado com escopos básicos, cliente OAuth Web com redirect do Supabase de produção; credenciais no painel do Supabase (FR-003)
- [ ] T050 ⚠️ SMTP (confirmar com Doug a opção da research R-07): conta Resend gratuita com o e-mail autorizado + SMTP no Supabase, **ou** manter SMTP padrão (2/h) e registrar o limite no README (FR-004, FR-005)
- [ ] T051 ⚠️ Supabase produção (confirmar com Doug): cadastro desligado, Site URL/redirects, OTP 6 dígitos/600 s, template do código, `pg_cron` habilitado; migração aplicada pelo job `deploy-db` no merge (FR-001, FR-004, FR-020)
- [ ] T052 ⚠️ Vercel produção (confirmar com Doug): adicionar `SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS`, `AUTH_HASH_SECRET`, `APP_ORIGIN`; remover `PRODUCTION_GATE_*` no mesmo deploy; rodar `npm run auth:provision` contra produção (FR-022, FR-028)
- [ ] T053 Verificação pós-deploy em produção: sem sessão ⇒ `/entrar` (não mais Basic Auth); login Google e código; `/api/health` continua público; keepalive da 001 segue verde (FR-008, FR-028, SC-001)
- [ ] T054 [P] README: seção "Login" (variáveis novas, provisionamento, Mailpit, limites de SMTP e custo R$ 0) e `quickstart.md` validado num clone limpo
- [ ] T055 Abrir PR `006 · Login` (rótulos `autor:claude`, milestone `1 · Autenticação`), com nota para o revisor apontando "Riscos de segurança" do plan; atualizar status no roadmap pelo fluxo normal

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → histórias. T014 (migração) bloqueia T024+.
- **US1** depende só da Phase 2. **US2** depende de US1 (DAL, sessão). **US3** e **US4** dependem
  de US1 e podem rodar em paralelo entre si e com US2. **US5** depende da interface de T016 e
  das telas de US1/US3/US4 (para simulá-las) — pode começar `demo-service` após T016.
- T036 depende de T049–T052 (produção no ar). T053 depende de T049–T052.
- FR-028 (remover a trava) só vai para produção junto com T052, nunca antes.

## Parallel Opportunities

- Phase 1: T002, T003, T004 juntos.
- Phase 2 testes: T005–T009 juntos; implementações T011, T012, T013 juntas.
- US1 testes T018–T023 juntos.
- Após US1: US2, US3 e US4 em paralelo (arquivos disjuntos, exceto `sessions.ts` — US3 só
  acrescenta funções).
- Ações externas T049–T051 podem ser feitas pelo Doug em paralelo ao desenvolvimento.

## Implementation Strategy

1. MVP de segurança: Phases 1–2 + US1 ⇒ login por código/Google e todas as rotas fechadas.
2. US2 (uso diário no celular) — necessário antes de liberar ao Doug como app diário.
3. US3 + US4 em paralelo; US5 para a revisão na demo.
4. Ações externas, deploy coordenado (T052), verificação (T053), PR (T055) ⇒ revisão Gemini + Gate 3.

## Rastreabilidade FR → Tasks

| FR | Tasks | | FR | Tasks |
|---|---|---|---|---|
| 001 | T003, T006, T017, T020, T022, T051 | | 016 | T037, T039 |
| 002 | T018, T020, T022, T023, T025 | | 017 | T016, T040 |
| 003 | T003, T020, T025–T027, T036, T049 | | 018 | T006, T016, T040, T042 |
| 004 | T003, T008, T019, T025, T050 | | 019 | T009, T016, T040, T041, T043 |
| 005 | T008, T013, T018, T019, T022 | | 020 | T009, T014, T040, T042, T051 |
| 006 | T006, T019, T020, T022 | | 021 | T009, T014, T040 |
| 007 | T021, T022, T024, T028 | | 022 | T005, T010, T052 |
| 008 | T022, T028, T053 | | 023 | T015 |
| 009 | T028, T032, T035, T037 | | 024 | T045, T046 |
| 010 | T007, T012, T031 | | 025 | T045, T046 |
| 011 | T007, T024, T031 | | 026 | T044, T046 |
| 012 | T007, T030, T031, T033, T034, T036 | | 027 | T047 |
| 013 | T032, T035 | | 028 | T005, T028, T029, T052, T053 |
| 014 | T037, T038 | | 029 | T026, T034, T039, T048 |
| 015 | T037, T038 | | | |

SC-001 T021/T022/T053 · SC-002 T018/T023 · SC-003 T022/T036 · SC-004 T031/T036 · SC-005 T037 ·
SC-006 T040 · SC-007 T022 · SC-008 T045 · SC-009 T031.
