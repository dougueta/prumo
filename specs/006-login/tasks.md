# Tasks: Login

**Input**: `specs/006-login/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação
que o faz passar; toda task de implementação cita o teste vermelho que a precede ("até TNNN
passar"). Verificações manuais (⚠️, checklist pós-merge) **não** contam como teste de requisito.
**Pré-requisito**: branch rebaseada sobre a `main` com 001, emenda da constitution v1.1.0, **004**
e **003** integradas (ordem de merge da onda 1: 004 → 003 → 006 → 002).
**Remediação pós-analyze (2026-10-05)**: IDs T001–T055 preservados; tasks novas a partir de T056 (T074 e T076 não usados; T036 e T053 movidas para o checklist pós-merge; T078 acrescentada no Gate 2 — FR-003 somente web).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto
- ⚠️ = ação externa: confirmar com Doug no momento

---

## Phase 1: Setup

- [ ] T072 Atualizar o status da 006 em `docs/roadmap.md` para `impl` (fluxo normal)
- [ ] T001 Adicionar dependências fixadas `@supabase/ssr@0.12.7`, `@simplewebauthn/server@14.0.3`, `@simplewebauthn/browser@14.0.0` e dev `msw@3.0.2`; registrar justificativa no PR (research R-15). `@axe-core/playwright` já vem da 003 — não reinstalar — `package.json`, `package-lock.json`
- [ ] T002 [P] Criar projeto Vitest `contract` (MSW, sem rede) e pasta `tests/contract/auth/`; script `test:contract`, incluído em `check` — `vitest.config.ts`, `package.json`
- [ ] T003 [P] Configurar `[auth]` do Supabase local conforme data-model §8 (cadastro desligado, OTP 6 dígitos/600 s, `max_frequency 60s`, `site_url` `http://localhost:3000`, redirects para portas 3000 e 3100, `rate_limit.sign_in_sign_ups`/`token_verifications` = 1000 só em local, senha **não** desligada, Google via `env(...)` opcional) e template `supabase/templates/codigo.html` só com `{{ .Token }}` — `supabase/config.toml` (FR-001, FR-003, FR-004)
- [ ] T004 [P] Playwright: webServer local com `APP_ORIGIN=http://localhost:3100` (nunca IP); projeto `mobile-chrome` passa a incluir `auth/login.spec.ts`; novos projetos `webkit` (Desktop Safari) e `mobile-safari` (iPhone) para `auth/google.spec.ts` e `auth/login.spec.ts`; helper que lê o último código do Mailpit (`:57324`), helper de autenticador WebAuthn virtual via CDP (`WebAuthn.addVirtualAuthenticator`, `isUserVerified: true`) e helper `auth-session.ts` (login por OTP → `storageState`) — `playwright.config.ts`, `tests/e2e/helpers/{mailpit,webauthn,auth-session}.ts`
- [ ] T057 [P] Teste do CI: `ci.yml` sem `mailpit` em `SUPABASE_EXCLUDE`; job "Testes de contrato" rodando `npm run test:contract`; nomes dos jobs da 001 preservados; job `e2e` instala `chromium` e `webkit`; jobs `integration`/`e2e` exportam `SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS` sintético (`@example.test`), `AUTH_HASH_SECRET` aleatório e rodam `auth:provision` antes dos testes; `preview-protection.yml` existe — `tests/unit/ci-config.test.ts` (FR-027, FR-022; Constitution V)
- [ ] T056 Atualizar `.github/workflows/ci.yml` e `scripts/ci-supabase-env.mjs` (mesmo nome `SUPABASE_PUBLISHABLE_KEY` usado pela 004; valores mascarados; e-mails sintéticos; segredo aleatório por execução; `npm run auth:provision`) até T057 passar
- [ ] T058 [P] Unit: `buildDemoEnv(source)` remove/zera **todas** as `SUPABASE_*`, `AUTH_*` e `APP_ORIGIN` (inclusive as que o Next leria de `.env.local`) e define `APP_ENV=preview`; `parseEnv(buildDemoEnv(envLocalCompleto))` não falha — `tests/unit/start-demo.test.ts` (FR-024, FR-026)
- [ ] T059 Refatorar `scripts/start-demo.mjs` para usar `buildDemoEnv` (exportado de `scripts/demo-env.mjs`) até T058 passar

## Phase 2: Foundational (bloqueia todas as histórias)

### Testes (escrever primeiro)
- [ ] T005 [P] Unit de `parseEnv()`: novos campos (`SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS` ≥ 1 e-mail válido normalizado, `AUTH_HASH_SECRET` ≥ 32, `APP_ORIGIN` URL sem IP literal), `PRODUCTION_GATE_*` não exigidos mais, `preview` falha se houver `AUTH_*`/`APP_ORIGIN`/`SUPABASE_*`; mensagem só com nomes — `tests/unit/env.test.ts` (FR-022, FR-027, FR-028)
- [ ] T006 [P] Unit das funções puras: `normalizeEmail`/`isAllowed` (maiúsculas/espaços), `hmacHex`, `maskEmail` (vetores do plan), `safeNext` (`//evil`, `/\evil`, `https://x`, `/entrar`, `/auth/sair`, > 512 ⇒ `/`), `describeDevice` (iPhone/Android/Windows/macOS), `geoFromHeaders` — `tests/unit/auth/pure.test.ts` (FR-001, FR-006, FR-018)
- [ ] T007 [P] Unit de `evaluateSession()`: todos os estados e a ordem das regras; transições proibidas do plan (inclusive credencial de outro dispositivo); `canUnlock` só com credencial do mesmo `device_id`; limites exatos (15 min, 30 d, 90 d) com relógio injetado — `tests/unit/auth/session-state.test.ts` (FR-010, FR-011, FR-012)
- [ ] T008 [P] Unit de `evaluateRateLimit()` e `classifyOtpFailure()`: limiares 5/15 min por e-mail e IP **contando só `otp_failed`**, 60 s, 5/h; `email_refused` e `login_blocked` não contam; vetor de neutralidade (4 recusados + autorizado ⇒ mesma decisão que 4 recusados + recusado); `expired`/`used` (exige `email_hash` em `login_succeeded`)/`wrong_code` — `tests/unit/auth/rate-limit.test.ts`, `tests/unit/auth/otp-classify.test.ts` (FR-002, FR-004, FR-005, SC-007)
- [ ] T009 [P] Integração (Supabase local/CI): migração cria as 3 tabelas com RLS+FORCE, CHECKs e FKs `RESTRICT`; `anon` não lê nada; `authenticated` só lê as próprias linhas; nenhum papel faz UPDATE/DELETE em `access_events` (gatilho) exceto com `prumo.retention = on`; constraints de `app_sessions` (90 d, `ended_at`/`end_reason`, `device_id`); job `pg_cron` registrado — `tests/integration/auth/schema.int.test.ts` (FR-019, FR-020, FR-021)
- [ ] T060 [P] Unit de `decideProxy()`: tabela de auth-flows §2 (pública/protegida × página/API × com/sem cookie × `preview`), rotas públicas da 001 sem desafio Basic Auth, `/entrar` com cookie **não** redireciona para `/`, `preview` preserva emissão de `prumo_demo_sid` — `tests/unit/auth/proxy-decision.test.ts` (FR-007, FR-008, FR-009, FR-028)
- [ ] T061 [P] Unit de `authCookieOptions(appEnv)`: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` ≠ local, `maxAge` ≤ 90 d (400 d só para `prumo_device`); o adaptador do proxy e o de `cookies()` sobrescrevem as opções vindas do `@supabase/ssr` — `tests/unit/auth/cookie-options.test.ts` (FR-023)
- [ ] T062 [P] Unit de `recordEvent()` com cliente falso: aplica HMAC/máscara/geo/device; assinatura não aceita campos `token`/`code`/`password`; `email_hash` obrigatório nos tipos de data-model §4; erro de gravação não propaga detalhes — `tests/unit/auth/events.test.ts` (FR-017, FR-018, FR-019)
- [ ] T066 [P] Unit dos scripts: `auth-provision` idempotente com Admin API simulada (`email_confirm: true`, não cria duplicado, saída só com e-mails mascarados); `auth-age-session` recusa `APP_ENV ≠ local` — `tests/unit/auth/scripts.test.ts` (FR-001)
- [ ] T071 [P] Teste de guarda do bundle (roda no job E2E após `next build`): nenhum arquivo em `.next/static/**` contém o valor de `AUTH_ALLOWED_EMAILS`, `AUTH_HASH_SECRET`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` nem `SUPABASE_URL` — `tests/e2e/auth/client-bundle.spec.ts` (FR-022)

### Implementação
- [ ] T010 Atualizar `src/lib/env.ts` + `.env.example` + `tests/unit/env-example.test.ts` (catálogo data-model §7) e `scripts/dev-setup.mjs` (preenche `SUPABASE_PUBLISHABLE_KEY`, `AUTH_HASH_SECRET` aleatório, `APP_ORIGIN=http://localhost:3000`) até T005 passar (FR-022)
- [ ] T011 [P] Implementar puros em `src/lib/auth/{allowlist,crypto,safe-next,device}.ts` até T006 passar
- [ ] T012 [P] Implementar `src/lib/auth/session-state.ts` até T007 passar
- [ ] T013 [P] Implementar `src/lib/auth/{rate-limit,otp-classify,neutral-timing}.ts` até T008 passar
- [ ] T014 Migração `supabase/migrations/<ts>_auth_sessions_events.sql` (tipos, tabelas, CHECKs, FKs RESTRICT, índices, RLS, gatilho somente-inserção, `pg_cron` de retenção — data-model §1–§6) até T009 passar
- [ ] T015 `src/lib/auth/cookie-options.ts` + `src/lib/auth/supabase-clients.ts`: `createAuthClient()` com `@supabase/ssr` para `cookies()` do Next **e** para `NextRequest/NextResponse` (proxy), ambos com `authCookieOptions()` até T061 passar (FR-023)
- [ ] T016 `src/lib/auth/service.ts` (interface `AuthService`, `getAuthService()` só por `loadEnv().APP_ENV`) + `src/lib/auth/events.ts` (`recordEvent`) até T062 passar (FR-017, FR-018, FR-019)
- [ ] T017 Scripts `scripts/auth-provision.mjs` (`npm run auth:provision`) e `scripts/auth-age-session.mjs` (`npm run auth:age-session -- --minutes N | --days N`) até T066 passar (FR-001)

**Checkpoint**: configuração, CI, banco e lógica pura prontos.

---

## Phase 3: US1 — Entrar e manter tudo fechado (P1) 🎯 MVP

**Independent Test**: sem sessão toda rota interna vai para `/entrar`; e-mail autorizado entra com código; e-mail estranho recebe resposta neutra e não ganha sessão.

### Testes (escrever primeiro)
- [ ] T018 [P] [US1] Contrato (MSW simulando Supabase Auth): `requestCode` — formato inválido, autorizado (chama `/otp` com `create_user: false`), não autorizado (não chama), bloqueado, provedor com erro (resposta continua neutra); mesmos cookies/redirect/status; piso de 1.500 ms em todos os ramos; eventos gravados deixam os contadores do rate limit iguais para autorizado e não autorizado — `tests/contract/auth/request-code.test.ts` (FR-002, FR-005, SC-002)
- [ ] T019 [P] [US1] Contrato: `verifyCode` — formato, `WRONG_CODE` (autorizado e não autorizado com o mesmo evento e piso de 1.000 ms), `EXPIRED_OR_USED`, `TOO_MANY`, `UNAVAILABLE`, sucesso ⇒ `establishSession` (linha com `device_id`, evento com `email_hash`, chamada a `bootstrap()`) e `redirect(safeNext)` — `tests/contract/auth/verify-code.test.ts` (FR-002, FR-003, FR-004, FR-005, FR-006)
- [ ] T020 [P] [US1] Contrato: `/auth/callback` — sucesso autorizado, e-mail fora da lista (sessão revogada, `erro=recusado`), erro "signup disabled" do Supabase (mesma recusa), `code` ausente/provedor fora (`erro=indisponivel`, página oferece "Entrar com código por e-mail"), `prumo_next` respeitado só se seguro — `tests/contract/auth/callback.test.ts` (FR-001, FR-002, FR-003, FR-006)
- [ ] T021 [P] [US1] Unit estático `protected-surface`: todo `page.tsx`, `route.ts` e arquivo `"use server"` em `src/app/` fora da lista pública de auth-flows §1 importa e chama `requireSession` (ou `getDataClient`); nenhum `layout.tsx` é a única guarda; nenhum arquivo fora de `src/lib/auth/` lê cookies `sb-*`; `@/lib/supabase/server` só importado nos caminhos permitidos (dal.md) — `tests/unit/auth/protected-surface.test.ts` (FR-007, FR-022, SC-001)
- [ ] T063 [P] [US1] Contrato do DAL e de `/auth/sair`: matriz de `dal.md` (página/Server Action/Route Handler × sem sessão/JWT inválido/encerrada/expirada/LOCKED/allowlist removida/banco indisponível/ACTIVE) com relógio e Supabase simulados; `getDataClient()` chama `requireSession()` e falha em sessão encerrada; `session_expired` gravado uma vez; ação protegida não executa o callback de gravação; `/auth/sair` não desloga sessão `ACTIVE`/`LOCKED` e limpa cookies de sessão encerrada — `tests/contract/auth/dal.test.ts` (FR-007, FR-011, FR-013)
- [ ] T064 [P] [US1] Contrato do `OwnerContextProvider` (contracts da 004): sessão real ⇒ `{ kind: "user", ownerId = sub, client com JWT }`; preview ⇒ `{ kind: "demo", sessionId = prumo_demo_sid }` com `DEMO_OWNER_ID` importado de `@/data/core`; sem sessão ⇒ redirect/401 antes de `owner_required`; provider registrado em `register()` de `src/instrumentation.ts` — `tests/contract/auth/owner-context.test.ts` (FR-007, FR-024)
- [ ] T067 [P] [US1] Contrato de cookies: todo `Set-Cookie` emitido por `requestCode`, `verifyCode`, `/auth/callback`, `/auth/sair`, rotas WebAuthn e pelo adaptador do proxy (refresh) tem `HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` com `APP_ENV=production` — `tests/contract/auth/cookies.test.ts` (FR-023)
- [ ] T022 [P] [US1] E2E (projetos `chromium` e `mobile-chrome`): login por código via Mailpit até a tela inicial em ≤ 60 s e volta ao `next`; cookies do contexto com `httpOnly: true`; código antigo recusado após novo pedido; e-mail não autorizado ⇒ mensagem neutra e Mailpit vazio; 5 códigos errados ⇒ bloqueio; código expirado (envelhecido via SQL) ⇒ mensagem; varredura de rotas internas e `/api/auth/status` sem cookie ⇒ `/entrar`/401; rotas públicas da 001 (`/api/health`, manifesto, `/sw.js`, `/~offline`, ícones) respondem sem sessão e sem Basic Auth; sessão encerrada com JWT válido termina em `/entrar` sem laço — `tests/e2e/auth/login.spec.ts` (FR-001–FR-008, FR-023, FR-028, SC-001, SC-003, SC-007)
- [ ] T078 [P] [US1] E2E do login com Google no navegador (projetos `chromium`, `mobile-chrome`, `webkit`, `mobile-safari`): "Entrar com Google" redireciona para `<SUPABASE_URL>/auth/v1/authorize?provider=google` com `code_challenge` e `redirect_to=APP_ORIGIN/auth/callback`, com verifier PKCE e `prumo_next` em cookies HttpOnly; interceptando a ida ao provedor, o retorno a `/auth/callback` com erro ou sem `code` leva a `/entrar?erro=indisponivel` com a oferta "Entrar com código por e-mail"; a conclusão (troca do `code` + `establishSession`) é coberta por T020 — `tests/e2e/auth/google.spec.ts` (FR-003)
- [ ] T023 [P] [US1] Integração de tempo: 50 pedidos para 50 e-mails autorizados sintéticos distintos (allowlist de teste) × 50 não autorizados distintos, cada um com `x-forwarded-for` distinto, chamando `requestCode` contra o Supabase local (rate limit da 006 e do Supabase não disparam); diferença média < 100 ms e textos idênticos — `tests/integration/auth/neutral-timing.int.test.ts` (FR-002, SC-002)

### Implementação
- [ ] T024 [US1] `src/lib/auth/sessions.ts` (`establishSession` com `prumo_device`, `email_hash`, `bootstrap()`) e `src/lib/auth/dal.ts` (`requireSession`, `getDataClient`, falha fechada) usando `evaluateSession` até T063 passar (FR-007, FR-011, FR-013)
- [ ] T073 [US1] Route Handler `src/app/auth/sair/route.ts` até T063 passar (FR-007, FR-009)
- [ ] T065 [US1] `src/lib/auth/owner-context.ts` + registro em `src/instrumentation.ts` até T064 passar (FR-007)
- [ ] T025 [US1] `src/lib/auth/supabase-service.ts`: `requestCode`, `verifyCode`, `startGoogle`, `completeGoogle` conforme auth-flows §4 até T018–T020 passarem (FR-002–FR-005)
- [ ] T026 [US1] Server Actions `src/app/(public)/entrar/actions.ts` + páginas `entrar/page.tsx` (ACTIVE ⇒ `redirect(next)`; oferta do código por e-mail sempre visível, destacada no modo PWA instalado do iOS) e `entrar/codigo/page.tsx` (pt-BR, mobile, claro/escuro com tokens da 003, `inputmode="numeric"`, `autocomplete="one-time-code"`), fora do shell, até T018/T019/T022/T078 passarem (FR-003, FR-029)
- [ ] T027 [US1] Route Handler `src/app/auth/callback/route.ts` até T020/T078 passarem (FR-003)
- [ ] T075 [US1] Renomear `createServerClient` (001) para `createServiceClient` em `src/lib/supabase/server.ts` e atualizar `src/app/api/health/route.ts`; acrescentar `requireSession()` em `src/app/(app)/page.tsx` e demais `page.tsx` do `(app)` criados pela 003 (sem recriar layout/página) até T021 passar (FR-007)
- [ ] T028 [US1] Reescrever `src/proxy.ts` sobre `decideProxy` (preservando o tratamento de `prumo_demo_sid` da 004) e **remover** `src/lib/production-gate.ts` + `tests/unit/production-gate.test.ts`; `Cache-Control: private, no-store` em rotas protegidas até T060/T067/T022 passarem (FR-007, FR-008, FR-009, FR-023, FR-028)
- [ ] T068 [US1] Ajustar E2E da 001 para o login: `tests/e2e/home.spec.ts` e `tests/e2e/pwa.spec.ts` usam `storageState` do helper `auth-session` para rotas protegidas e continuam verdes em `chromium`/`mobile-chrome` (FR-007, FR-008)
- [ ] T029 [US1] Atualizar contrato da 001: marcar `specs/001-setup-projeto/contracts/production-gate.md` como substituído por `specs/006-login/contracts/auth-flows.md` (nota no topo) (FR-028)

**Checkpoint**: produção pode ser protegida pelo login (MVP de segurança).

---

## Phase 4: US2 — Continuar logado no celular com segurança (P1)

**Independent Test**: com sessão ativa reabrir vai direto; após 15 min sem uso pede biometria/PIN deste aparelho; após 30 d sem uso ou 90 d totais pede entrada completa.

### Testes
- [ ] T030 [P] [US2] Contrato das rotas WebAuthn (`register/options|verify`, `unlock/options|verify`, `/api/auth/status`) contra `contracts/auth-api.openapi.yaml`: janela de cadastro de 10 min, credencial gravada com `device_id`, `allowCredentials` só do dispositivo, credencial de outro dispositivo recusada, desafio de uso único/expirado, 409 sem credencial no dispositivo, 5ª falha ⇒ 401 e `end_reason unlock_failures`, `Origin` diferente de `APP_ORIGIN` ⇒ 403, 503 com banco indisponível — `tests/contract/auth/webauthn.test.ts` (FR-012)
- [ ] T031 [P] [US2] E2E com autenticador virtual: cadastrar biometria após login; reabrir com sessão ativa até a tela inicial em ≤ 2 s; `auth:age-session --minutes 16` ⇒ `/desbloquear`; desbloquear ⇒ volta ao `next`, `absolute_expires_at` inalterado; segundo contexto (outro `prumo_device`) bloqueado ⇒ só "Entrar novamente"; sessão idle 31 d e absoluta 91 d ⇒ `/entrar` com evento único `session_expired` — `tests/e2e/auth/session-lock.spec.ts` (FR-010, FR-011, FR-012, SC-004, SC-009)
- [ ] T032 [P] [US2] E2E: em `/mais/seguranca` no contexto A, sessão encerrada por "Sair de todos" no contexto B; em A "Sair de todos" ⇒ `SESSION_EXPIRED`, nenhum `logout_all` novo, mensagem "Sua sessão expirou…", volta a `/mais/seguranca` após entrar; SessionGuard cobre a tela ao voltar de 15 min oculta (relógio do Playwright) — `tests/e2e/auth/mid-action.spec.ts` (FR-009, FR-013, SC-009)

### Implementação
- [ ] T033 [US2] `src/lib/auth/webauthn.ts` + Route Handlers `src/app/api/auth/webauthn/{register,unlock}/{options,verify}/route.ts` e `src/app/api/auth/status/route.ts` (validação de `Origin`, vínculo a `device_id`) até T030 passar (FR-012)
- [ ] T034 [US2] Página `src/app/desbloquear/page.tsx` (fora do shell) + `actions.ts` (`signOut` para "Entrar novamente") + `src/components/auth/unlock-button.tsx` (WebAuthn só por gesto do usuário) e `src/components/auth/enroll-biometrics.tsx` (oferta após login e em `/mais/seguranca`, com `restartForEnrollment` fora da janela) até T031 passar (FR-012, FR-029)
- [ ] T035 [US2] `src/components/auth/session-guard.tsx` no `layout.tsx` raiz e `src/components/auth/use-auth-aware-action.ts` até T032 passar (FR-009, FR-013)

**Checkpoint**: uso diário no celular viável e seguro.

---

## Phase 5: US3 — Sair e encerrar sessões em outros dispositivos (P2)

**Independent Test**: dois contextos logados; "Sair de todos" em A ⇒ B perde acesso na próxima ação.

### Testes
- [ ] T037 [P] [US3] E2E: "Sair" ⇒ `/entrar`, botão voltar (inclusive bfcache) não mostra dados, evento `logout`; dois contextos ⇒ `signOutEverywhere` com confirmação (`ConfirmDialog` da 003) ⇒ B recebe 401 em < 1 min, todas as linhas `logout_all`; lista de sessões em `/mais/seguranca` com a atual marcada — `tests/e2e/auth/logout.spec.ts` (FR-009, FR-014, FR-015, FR-016, SC-005)
- [ ] T077 [P] [US3] Integração: após `endSession` o refresh token da sessão é recusado pelo Supabase (`scope: local`); após `endAllSessions` os refresh tokens de todas as sessões são recusados (`scope: global`) e o DAL nega todas em < 1 min — `tests/integration/auth/revocation.int.test.ts` (FR-014, FR-015, SC-005)

### Implementação
- [ ] T038 [US3] `endSession`, `endAllSessions` (+ `auth.admin.signOut`), `listSessions` em `src/lib/auth/sessions.ts` e Server Actions `src/app/(app)/mais/seguranca/actions.ts` até T077 passar (FR-014, FR-015)
- [ ] T039 [US3] Seção "Dispositivos conectados" em `src/app/(app)/mais/seguranca/page.tsx` (descrição, início, último uso, "este dispositivo", botão com `ConfirmDialog`) + entrada "Segurança" no menu "Mais" da 003 até T037 passar (FR-016, FR-029)

---

## Phase 6: US4 — Consultar o histórico de acessos (P2)

**Independent Test**: gerar cada tipo de evento e vê-lo no histórico em ordem, sem segredos.

### Testes
- [ ] T040 [P] [US4] Integração: cada tipo de FR-017 é gravado por seu fluxo; nenhuma coluna contém código, `code` OAuth, token, `session_id` de cookie ou e-mail não autorizado completo (varredura por regex nos valores); `listEvents` retorna 90 dias em ordem decrescente, incluindo eventos com `owner_id` nulo — `tests/integration/auth/events.int.test.ts` (FR-017–FR-021, SC-006)
- [ ] T041 [P] [US4] Unit: `src/lib/log.ts` redige chaves `token`, `code`, `authorization`, `cookie`, `password`, `email` (mascara) e mensagens de erro do provedor; regra ESLint proíbe `console.*` em `src/` fora de `log.ts` — `tests/unit/auth/log-redaction.test.ts` (FR-019, SC-006)

### Implementação
- [ ] T042 [US4] `listEvents()` em `src/lib/auth/events.ts` + seção "Histórico de acessos" em `/mais/seguranca` (tipo em pt-BR, data/hora `America/Sao_Paulo` via `src/lib/format.ts`, método, dispositivo, local aproximado) até T040 passar (FR-018, FR-020)
- [ ] T043 [US4] Criar `src/lib/log.ts` (logger único com redação) + regra `no-console` em `eslint.config.mjs` e migrar usos existentes até T041 passar (FR-019)

---

## Phase 7: US5 — Pré-visualizações em modo demonstração (P3)

**Independent Test**: preview entra direto como "Usuário Demonstração" com selo; nada disso é ativável em produção.

### Testes
- [ ] T044 [P] [US5] Unit `demo-isolation`: com `APP_ENV=production`/`local`, `getAuthService()` é Supabase para qualquer cookie (`prumo_demo_out`, `prumo_demo_sid`), header ou query; `DemoAuthService` não é importado por nenhum caminho de produção sem passar por `getAuthService` — `tests/unit/auth/demo-isolation.test.ts` (FR-026, SC-008)
- [ ] T045 [P] [US5] E2E projeto `demo`: entrada automática com selo; "Sair" ⇒ `/entrar` simulada **com selo**; `demo@prumo.invalid` + `246810` entra; outro e-mail neutro; `111111` expirado; 5 erros ⇒ bloqueio; `/mais/seguranca` com sessões/eventos fictícios ligados ao `prumo_demo_sid` (outro contexto não os vê); Google "Indisponível na demonstração" — `tests/e2e/auth/demo.spec.ts` (FR-024, FR-025, SC-008)
- [ ] T069 [P] [US5] Unit de `checkPreviewProtection(response)`: 401/redirect para login da Vercel ⇒ protegido; 200 com HTML do app ⇒ falha — `tests/unit/preview-protection.test.ts` (FR-027)

### Implementação
- [ ] T046 [US5] `src/lib/auth/demo-service.ts` (data-model §9; `DEMO_OWNER_ID` de `@/data/core`; estado por `prumo_demo_sid`; eventos sintéticos determinísticos) até T044/T045 passarem (FR-024, FR-025, FR-026)
- [ ] T070 [US5] `scripts/check-preview-protection.mjs` + workflow `.github/workflows/preview-protection.yml` (evento `deployment_status` de Preview bem-sucedido: requisição sem bypass ⇒ `checkPreviewProtection`; falha marca o check vermelho) até T069 passar (FR-027)
- [ ] T047 [US5] ⚠️ Confirmar com Doug que o ambiente Preview da Vercel continua com Vercel Authentication e **sem** `AUTH_*`/`APP_ORIGIN`/`SUPABASE_*` (FR-027; o teste automatizado é T069/T070)

---

## Phase 8: Polish, ações externas pré-merge e PR

- [ ] T048 [P] E2E de acessibilidade das telas de auth com `@axe-core/playwright` (da 003): `/entrar`, `/entrar/codigo`, `/desbloquear`, `/mais/seguranca` × claro/escuro × 360/1280 px ⇒ 0 violações; rótulos e foco — `tests/e2e/auth/a11y.spec.ts` (FR-029)
- [ ] T049 ⚠️ Google Cloud (confirmar com Doug): projeto `prumo`, consentimento externo publicado com escopos básicos, cliente OAuth do tipo **Web** (o Prumo é somente web; nenhum cliente iOS/Android) com redirect do Supabase de produção; credenciais no painel do Supabase (FR-003)
- [ ] T050 ⚠️ SMTP (confirmar com Doug a opção da research R-07): conta Resend gratuita com o e-mail autorizado + SMTP no Supabase, **ou** manter SMTP padrão (2/h) e registrar o limite no README (FR-004, FR-005)
- [ ] T051 ⚠️ Supabase produção (confirmar com Doug): cadastro desligado, Site URL/redirects, OTP 6 dígitos/600 s, template do código, `pg_cron` habilitado; `npm run auth:provision` contra produção (FR-001, FR-004, FR-020)
- [ ] T052 ⚠️ Vercel produção (confirmar com Doug): adicionar `SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS`, `AUTH_HASH_SECRET`, `APP_ORIGIN` **antes** do merge (valem a partir do deploy do merge); `PRODUCTION_GATE_*` removidas logo após o deploy verde (o código novo não as lê) (FR-022, FR-028)
- [ ] T054 [P] README: seção "Login" (variáveis novas, provisionamento, Mailpit, `localhost`, limites de SMTP e custo R$ 0) e `quickstart.md` validado num clone limpo
- [ ] T055 Abrir PR `006 · Login` (rótulos `autor:claude` + `iniciativa:1`, milestone `1 · Autenticação`, template de PR da 002 se já existir), com nota para o revisor apontando "Riscos de segurança" e "Riscos aceitos" do plan; status `review` no roadmap

---

## Checklist pós-merge (não conta como teste de requisito)

Executado após o merge na `main` e o deploy de produção verde (sequência em plan §Ações externas).
- [ ] T053 Verificação em produção: sem sessão ⇒ `/entrar` (não mais Basic Auth); login Google e código; `/api/health` continua público; keepalive da 001 segue verde; `PRODUCTION_GATE_*` removidas da Vercel (FR-008, FR-028)
- [ ] T036 ⚠️ Observação manual em aparelho real (confirmar com Doug; sem efeito de aceite): iPhone no Safari e com o PWA instalado na tela inicial, e Android no Chrome — login por código, login Google no navegador e, no PWA instalado do iOS, registrar se o Google conclui ou se a oferta do código aparece (risco aceito do plan), cadastro de Face ID/digital, desbloqueio após 15 min, reabrir em ≤ 2 s; evidência sem dados num comentário do PR mergeado/issue (FR-003, FR-012)

---

## Dependencies & Execution Order

- Pré-requisito: 004 e 003 integradas (consumo de `DEMO_OWNER_ID`, `prumo_demo_sid`, `OwnerContextProvider`, `(app)`, `ConfirmDialog`, axe).
- Phase 1 → Phase 2 → histórias. T056 (CI) antes de qualquer PR verde. T014 (migração) bloqueia T024+.
- Em cada fase, os testes listados vêm antes das implementações que os citam ("até TNNN passar").
- **US1** depende só da Phase 2. **US2** depende de US1 (DAL, sessão). **US3** e **US4** dependem
  de US1 e podem rodar em paralelo entre si e com US2. **US5** depende da interface de T016 e
  das telas de US1/US3/US4 (para simulá-las) — pode começar `demo-service` após T016.
- T068 depende de T004 (helper) e T026 (login funcionando).
- T049–T052 antes do merge; T055 (PR) depois de todo o resto exceto o checklist pós-merge.
- T053 e T036 só após merge + deploy verde.

## Parallel Opportunities

- Phase 1: T002, T003, T004, T057, T058 juntos.
- Phase 2 testes: T005–T009, T060–T062, T066, T071 juntos; implementações T011, T012, T013 juntas.
- US1 testes T018–T023, T063, T064, T067, T078 juntos.
- Após US1: US2, US3 e US4 em paralelo (arquivos disjuntos, exceto `sessions.ts` — US3 só
  acrescenta funções).
- Ações externas T049–T051 podem ser feitas pelo Doug em paralelo ao desenvolvimento.

## Implementation Strategy

1. MVP de segurança: Phases 1–2 + US1 ⇒ login por código/Google e todas as rotas fechadas.
2. US2 (uso diário no celular) — necessário antes de liberar ao Doug como app diário.
3. US3 + US4 em paralelo; US5 para a revisão na demo.
4. Ações externas pré-merge, PR (T055) ⇒ revisão Gemini + Gate 3 ⇒ merge ⇒ checklist pós-merge.

## Rastreabilidade FR → Tasks → Testes automatizados

| Req. | Implementação | Testes (automatizados) |
|---|---|---|
| FR-001 | T003, T011, T017, T025, T051 | T006, T020, T022, T066 |
| FR-002 | T013, T025 | T008, T018, T019, T020, T022, T023 |
| FR-003 | T003, T025, T026, T027, T049 | T019, T020, T022, T078 |
| FR-004 | T003, T013, T025, T050 | T008, T019, T022 |
| FR-005 | T013, T025 | T008, T018, T019, T022 |
| FR-006 | T011, T026, T027 | T006, T019, T020, T022 |
| FR-007 | T024, T028, T065, T068, T073, T075 | T021, T022, T060, T063, T064 |
| FR-008 | T028, T068 | T022, T060 |
| FR-009 | T028, T035, T073 | T032, T037, T060 |
| FR-010 | T012, T024 | T007, T031 |
| FR-011 | T012, T024 | T007, T031, T063 |
| FR-012 | T012, T033, T034 | T007, T030, T031 |
| FR-013 | T024, T035 | T032, T063 |
| FR-014 | T038 | T037, T077 |
| FR-015 | T038 | T037, T077 |
| FR-016 | T038, T039 | T037 |
| FR-017 | T016 | T040, T062 |
| FR-018 | T016, T042 | T006, T040, T062 |
| FR-019 | T016, T043 | T009, T040, T041, T062 |
| FR-020 | T014, T042, T051 | T009, T040 |
| FR-021 | T014 | T009, T040 |
| FR-022 | T010, T056, T075 | T005, T021, T057, T071 |
| FR-023 | T015, T028 | T061, T067, T022 |
| FR-024 | T046, T059 | T045, T058, T064 |
| FR-025 | T046 | T045 |
| FR-026 | T016, T046, T059 | T044, T058 |
| FR-027 | T047, T056, T070 | T005, T057, T069 |
| FR-028 | T010, T028, T029, T052 | T005, T022, T060 |
| FR-029 | T026, T034, T039 | T048 |
| SC-001 | — | T021, T022 |
| SC-002 | — | T018, T023 |
| SC-003 | — | T022 (≤ 60 s) |
| SC-004 | — | T031 (≤ 2 s) |
| SC-005 | — | T037, T077 |
| SC-006 | — | T040, T041 |
| SC-007 | — | T008, T022 |
| SC-008 | — | T044, T045 |
| SC-009 | — | T031, T032 |

Testes de infraestrutura sem FR próprio: T057 (CI — Constitution V). Tasks de processo sem FR:
T001, T002, T004, T054, T055, T072.
