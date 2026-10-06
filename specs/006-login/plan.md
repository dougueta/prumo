# Implementation Plan: Login

**Branch**: `006-login` | **Date**: 2026-10-02 (remediação pós-analyze: 2026-10-05) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-login/spec.md` (aprovada no Gate 1)
**Integração**: ordem de merge da onda 1 = 004 → 003 → **006** → 002. A 006 é rebaseada sobre
004 e 003 já integradas e consome: `DEMO_OWNER_ID`, `prumo_demo_sid`, `OwnerContextProvider`,
`getCoreStore().bootstrap()` (004); route group `(app)`, `AppShell`, `ConfirmDialog`, toaster,
tokens e `@axe-core/playwright` (003). Decisões transversais: `onda1-decisoes` (2026-10-05).

## Summary

Substituir a trava Basic Auth provisória da 001 por autenticação real e single-user: identidade
pelo **Supabase Auth** (Google OAuth como principal + código de 6 dígitos por e-mail como
reserva garantida, cadastro desligado, allowlist só no servidor), **sessões controladas pelo
app** (`app_sessions`: 30 dias renováveis, máximo absoluto de 90, revogação imediata) e
**bloqueio após 15 min sem uso** desfeito por **WebAuthn de plataforma vinculado ao
dispositivo** (biometria/PIN do aparelho), imposto no servidor. Todo o fluxo roda no servidor
(sem cliente Supabase no navegador, cookies HttpOnly por uma única fábrica de opções). Eventos
de acesso auditáveis com rate limit sobre eles. Modo demonstração com `DemoAuthService` sobre a
sessão demo da 004. Detalhes em [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdado da 001)
**Primary Dependencies**: Next.js 16.3.8 (`proxy.ts`, Server Actions, Route Handlers), React 19.2,
@supabase/supabase-js 2.117.2, **@supabase/ssr 0.12.7**, **@simplewebauthn/server 14.0.3**,
**@simplewebauthn/browser 14.0.0**, zod 4.6; dev: **msw 3.0.2**; `@axe-core/playwright` já
introduzido e justificado pela 003 (não reintroduzido aqui)
**Storage**: Supabase Postgres — `app_sessions`, `webauthn_credentials`, `access_events`
(dona: 006) + `auth.users` (Supabase Auth); `pg_cron` para retenção
**Testing**: Vitest 5 — projetos `unit`, `contract` (novo; MSW, sem rede) e `integration`
(Supabase local/CI); Playwright 1.63 (E2E com Mailpit do Supabase CLI e autenticador WebAuthn
virtual do Chromium via CDP), sempre em `http://localhost:<porta>`
**Target Platform**: somente web — navegadores desktop e mobile (Safari, Chrome, Edge,
Firefox) e o PWA instalável da 001 (Safari iOS 16+ na tela inicial, Chrome Android); sem app nativo
**Project Type**: web app Next.js único (estrutura da 001)
**Performance Goals**: reabrir com sessão ativa ≤ 2 s até a tela inicial (SC-004); verificação
de sessão por requisição ≤ 1 consulta ao banco (memoizada); resposta de pedido de código com
piso fixo de 1.500 ms e falha de verificação com piso de 1.000 ms (SC-002)
**Constraints**: custo R$ 0; nenhum segredo/token acessível a JS do navegador; preview sem
banco; mesmo build serve `local`/`preview`/`production` (sem `NEXT_PUBLIC_SUPABASE_*`)
**Scale/Scope**: 1 usuário, ≤ 5 dispositivos; ~7 telas/rotas novas; base de autorização para
todas as features de dados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 006 aprovada (Gate 1, 2026-10-02) + remediação pós-analyze registrada em Clarifications; branch `006-login` | ✅ |
| II. Privacidade | Allowlist e segredos só em env de servidor; cookies HttpOnly/Secure por `authCookieOptions()` em **todos** os adaptadores (inclusive proxy); sem cliente Supabase no browser; IP e e-mails de terceiros só como HMAC/mascarados; rate limit sem oráculo de enumeração; nenhum token/código em eventos ou logs do app (logger com redação + lint); RLS + FORCE em todas as tabelas novas; guarda por página + no `getDataClient()` (nunca só no layout); bundle do cliente verificado contra segredos; e-mail real nunca no repositório | ✅ |
| III. Dinheiro exato | N/A — sem valores monetários | ✅ |
| IV. Rastreabilidade | `access_events` somente-inserção (gatilho bloqueia UPDATE/DELETE fora da retenção; FKs `RESTRICT`); sessões encerradas mantêm motivo | ✅ |
| V. Test-first | Toda task de implementação tem teste vermelho antes (inclusive Phase 2: env, puros, cookies, eventos, proxy, DAL, scripts); contratos (DAL, proxy, Server Actions, Route Handlers, OwnerContextProvider) com teste de contrato; E2E de login (OTP via Mailpit), bloqueio, WebAuthn virtual; CI roda `unit`, `contract`, `integration` e `e2e` (T056); nenhum teste contra Google/SMTP reais | ✅ |
| VI. IA assistente | N/A — sem IA | ✅ |
| VII. Donos de dados / demo | 006 é dona de `app_sessions`, `webauthn_credentials`, `access_events`; só referencia `auth.users` (RESTRICT); não toca tabelas da 004; usa `DEMO_OWNER_ID`/`prumo_demo_sid` da 004 (não redefine); não recria `(app)` da 003 | ✅ |
| VIII. Revisão independente | PR `autor:claude` + `iniciativa:1` → Gemini; foco do revisor: §Riscos de segurança | ✅ |
| IX. Qualidade dos artefatos | data-model tipado com RLS/CHECKs, contracts (OpenAPI + fluxos + DAL), máquina de estados, algoritmos, Gherkin com checagem no banco, rastreabilidade FR → task → **teste automatizado** (100%; verificações manuais não contam) | ✅ |
| X. Simplicidade | Sem Redis/serviço de rate limit (contagem sobre `access_events`); sem lib de UA; sem hook de Auth; 4 dependências justificadas (research R-15) | ✅ |
| Custo R$ 0 | Supabase Free (Auth 50k MAU, pg_cron), Google OAuth gratuito, SMTP Resend free (3.000/mês, 100/dia) **ou** SMTP padrão (2/h) — ⚠️ escolha do Doug (R-07); Vercel Hobby (cabeçalhos de geo gratuitos); workflow de smoke do preview em GitHub Actions gratuito | ✅ |

**Re-check pós-design (2026-10-05)**: ✅ sem violações após remediação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/006-login/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (auth-flows.md · auth-api.openapi.yaml · dal.md)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── proxy.ts                         # REESCRITO: decideProxy + refresh Supabase; preserva prumo_demo_sid (004)
├── instrumentation.ts               # + registerOwnerContextProvider(provider da 006)
├── app/
│   ├── layout.tsx                   # + <SessionGuard/> (cliente); DemoBadge continua aqui (todas as telas)
│   ├── (public)/entrar/
│   │   ├── page.tsx                 # Google + e-mail (fora do shell); ACTIVE ⇒ redirect(next)
│   │   ├── codigo/page.tsx          # 6 dígitos
│   │   └── actions.ts               # requestCode, verifyCode, signInWithGoogle
│   ├── desbloquear/
│   │   ├── page.tsx                 # fora do shell; requireSession({allowLocked}) + botão WebAuthn
│   │   └── actions.ts               # signOut ("Entrar novamente")
│   ├── (app)/                       # CRIADO PELA 003 — a 006 não recria layout/page
│   │   ├── page.tsx                 # (003) + requireSession() acrescentado pela 006
│   │   └── mais/seguranca/
│   │       ├── page.tsx             # requireSession(); sessões + histórico + biometria
│   │       └── actions.ts           # signOut, signOutEverywhere, restartForEnrollment
│   ├── auth/
│   │   ├── callback/route.ts        # OAuth PKCE
│   │   └── sair/route.ts            # limpa cookies de sessão encerrada (sem laço)
│   └── api/auth/
│       ├── status/route.ts
│       └── webauthn/{register,unlock}/{options,verify}/route.ts
├── lib/
│   ├── env.ts                       # + SUPABASE_PUBLISHABLE_KEY, AUTH_*, APP_ORIGIN; − PRODUCTION_GATE_*
│   ├── log.ts                       # NOVO: logger único com redação (FR-019)
│   ├── production-gate.ts           # REMOVIDO (FR-028)
│   ├── supabase/server.ts           # (001) createServerClient → createServiceClient (único cliente secreto)
│   └── auth/
│       ├── dal.ts                   # requireSession, getDataClient (contrato dal.md)
│       ├── owner-context.ts         # OwnerContextProvider da 004 (user | demo)
│       ├── service.ts               # interface AuthService + getAuthService()
│       ├── supabase-service.ts      # implementação real
│       ├── demo-service.ts          # implementação demo (memória por prumo_demo_sid)
│       ├── supabase-clients.ts      # createAuthClient (ssr; cookies() e proxy)
│       ├── cookie-options.ts        # authCookieOptions(appEnv) — PURO (FR-023)
│       ├── proxy-decision.ts        # decideProxy() — PURO
│       ├── session-state.ts         # evaluateSession() — PURO (máquina de estados)
│       ├── rate-limit.ts            # evaluateRateLimit() — PURO
│       ├── allowlist.ts             # normalizeEmail, isAllowed — PURO
│       ├── crypto.ts                # hmacHex, maskEmail — PURO
│       ├── safe-next.ts             # safeNext — PURO
│       ├── device.ts                # describeDevice(ua), geoFromHeaders — PURO
│       ├── neutral-timing.ts        # withFloor(ms, fn)
│       ├── otp-classify.ts          # classifyOtpFailure(events, now) — PURO
│       ├── events.ts                # recordEvent (service), listEvents
│       ├── sessions.ts              # establishSession, endSession, endAllSessions, listSessions
│       └── webauthn.ts              # opções/verificação (SimpleWebAuthn), vinculadas a device_id
├── components/auth/
│   ├── session-guard.tsx            # "use client": visibilitychange/pageshow → /api/auth/status
│   ├── unlock-button.tsx            # "use client": startAuthentication()
│   ├── enroll-biometrics.tsx        # "use client": startRegistration()
│   └── use-auth-aware-action.ts     # trata SESSION_EXPIRED / LOCKED (FR-013)
scripts/
├── auth-provision.mjs               # cria o(s) usuário(s) de AUTH_ALLOWED_EMAILS
├── auth-age-session.mjs             # só local: recua last_active_at/created_at
├── start-demo.mjs                   # (001) passa a zerar SUPABASE_*, AUTH_*, APP_ORIGIN
└── ci-supabase-env.mjs              # (001/004) + SUPABASE_PUBLISHABLE_KEY, AUTH_* sintéticos
.github/workflows/
├── ci.yml                           # mailpit ligado; job "Testes de contrato"; provisionamento
└── preview-protection.yml           # NOVO: smoke de FR-027 em cada deploy de Preview
supabase/
├── config.toml                      # [auth] conforme data-model §8
├── templates/codigo.html            # e-mail só com {{ .Token }}
└── migrations/<ts>_auth_sessions_events.sql
tests/
├── unit/auth/                       # cookie-options, proxy-decision, session-state, rate-limit,
│                                    # allowlist, crypto, safe-next, device, otp-classify, events,
│                                    # env, demo-isolation, protected-surface, log-redaction, scripts
├── contract/auth/                   # dal, owner-context, request/verify-code, callback, sair,
│                                    # webauthn, cookies (MSW: Supabase Auth simulado)
├── integration/auth/                # RLS, gatilho, sessions/events, neutral-timing, revogação
├── e2e/helpers/                     # mailpit, webauthn, auth-session (storageState)
└── e2e/auth/                        # login, session-lock, mid-action, logout, demo, client-bundle
```

**Structure Decision**: mantém o projeto único da 001. Auth isolado em `src/lib/auth/` com
funções puras (testáveis sem rede) e duas implementações de `AuthService` (Constitution VII).
Route group `(app)` e shell pertencem à 003; a 006 só acrescenta guardas.

## Design Detalhado

### Máquina de estados — Sessão (`evaluateSession(row, now, hasDeviceCredential)`)

```
            login ok (Google/OTP + allowlist)
  NONE ─────────────────────────────────────▶ ACTIVE ◀──────────────┐
                                               │  │                 │ asserção WebAuthn válida de
                         now−last_active>15min │  │                 │ credencial DESTE dispositivo
                                               ▼  │                 │ (unlock_failures := 0)
                                             LOCKED ────────────────┘
                                               │  │
           5ª falha de desbloqueio, ou         │  │ logout / logout_all
           "Entrar novamente" (signOut)        │  │
                                               ▼  ▼
                                   ENDED (end_reason)          EXPIRED (idle_30d | absolute_90d)
```

Regras de avaliação (ordem fixa, servidor):
1. Sem linha ou `ended_at` não nulo ⇒ `ENDED`.
2. `now ≥ absolute_expires_at` ⇒ `EXPIRED(absolute_90d)`.
3. `now − last_active_at ≥ 30 d` ⇒ `EXPIRED(idle_30d)`.
4. E-mail do JWT ∉ allowlist ⇒ `ENDED(allowlist_removed)`.
5. `now − last_active_at > 15 min` ⇒ `LOCKED` (`canUnlock = hasDeviceCredential`, isto é,
   existe credencial com `device_id = row.device_id`).
6. Senão `ACTIVE`.

Transições **proibidas** (testadas em T007): `ENDED/EXPIRED → ACTIVE` (sempre nova sessão);
`LOCKED → ACTIVE` sem asserção verificada no servidor; `LOCKED → ACTIVE` com credencial de
outro dispositivo; desbloqueio alterar `absolute_expires_at`; requisição `LOCKED` atualizar
`last_active_at`; servir dados em `LOCKED`; reativar sessão após `logout_all`.
Efeitos: ao detectar `EXPIRED`/`ENDED` por avaliação, gravar `ended_at`/`end_reason` (se ainda
nulos), evento `session_expired` uma única vez, `auth.admin.signOut(jwt,"local")`; a limpeza de
cookies acontece só onde é permitida (Server Action, Route Handler, `/auth/sair`).

### Algoritmo — `establishSession(method)` (após Google callback ou `verifyOtp`)
1. `claims = getClaims()`; exigir `claims.email` e `isAllowed(claims.email)`; senão `signOut` +
   evento `email_refused` ⇒ `/entrar?erro=recusado`.
2. `deviceId` = cookie `prumo_device` ou novo UUID (cookie gravado com `authCookieOptions`, 400 d).
3. `INSERT app_sessions (id = claims.session_id, owner_id = claims.sub, device_id, method,
   device_label, absolute_expires_at = now() + 90 d)` `ON CONFLICT (id) DO NOTHING`.
4. Evento `login_succeeded` (method, **email_hash**, device, geo, session_id).
5. `(await getCoreStore()).bootstrap()` (idempotente, 004); erro ⇒ log redigido, não bloqueia.
6. Cookie `prumo_enroll_until = now + 10 min` — habilita a oferta de cadastro da biometria se
   `navigator.credentials` existir e **este dispositivo** ainda não tiver credencial.

### Algoritmo — `requireSession({ allowLocked })` (DAL, memoizado com `cache()`)
1. `preview` ⇒ `DemoAuthService.current()` (`DEMO_OWNER_ID`, `sessionId = prumo_demo_sid`; ou
   redirect `/entrar` se `prumo_demo_out=1`).
2. `claims = await supabase.auth.getClaims()` (JWT verificado; inválido ⇒ UNAUTHENTICATED).
3. `row = SELECT … FROM app_sessions WHERE id = claims.session_id` (cliente de serviço, 1
   consulta, junto com `EXISTS webauthn_credentials WHERE owner_id = row.owner_id AND
   device_id = row.device_id`).
4. `state = evaluateSession(row, now, hasDeviceCredential)`; aplicar efeitos/respostas de
   `dal.md` (páginas com sessão encerrada ⇒ `/auth/sair`, nunca `/entrar` direto — sem laço).
5. `ACTIVE` e `now − last_active_at > 60 s` ⇒ `UPDATE last_active_at = now()` (throttle).
6. Qualquer erro de banco ⇒ falha fechada (`UNAVAILABLE`), nunca contexto.
`getDataClient()` chama `requireSession()` (mesma memoização) antes de criar o cliente.

### Algoritmo — Rate limit (`evaluateRateLimit(counts, now)`, puro; contagens por SQL)
Entradas (uma consulta agregada sobre `access_events`):
- `fe` = `otp_failed` com `email_hash = e` em `[now−15 min, now]` (**só** verificações falhas;
  `email_refused` não conta — remediação H1);
- `fi` = `otp_failed` com `ip_hash = i` na mesma janela;
- `re1` = `otp_requested` com `email_hash = e` em `[now−60 s, now]`; `re60` em `[now−60 min, now]`.
Decisão:
1. `fe ≥ 5` ⇒ `BLOCKED(rate_email)`; `fi ≥ 5` ⇒ `BLOCKED(rate_ip)`.
2. Só para `requestCode`: `re1 ≥ 1` ou `re60 ≥ 5` ⇒ `BLOCKED(throttle_request)`.
3. Senão `ALLOWED`.
Neutralidade: `otp_requested` é gravado para qualquer e-mail e `otp_failed` é gravado do mesmo
jeito para e-mail autorizado ou não (contracts §4) ⇒ os contadores evoluem igual nos dois casos.
`BLOCKED` gera `login_blocked` (não conta como falha ⇒ o bloqueio expira 15 min após a 5ª falha
mais recente, janela deslizante). Normalização antes do HMAC: `trim().toLowerCase()`; IP do
cabeçalho `x-forwarded-for` (primeiro valor, fornecido pela Vercel) ou `"local"`.

### Algoritmo — Resposta neutra (FR-002, SC-002)
`requestCode`: `withFloor(1500, …)` sobre todos os passos (inclusive inválido/bloqueado).
`verifyCode`: falhas com `withFloor(1000, …)`. Mesmo texto, status, redirect e cookies para
qualquer e-mail válido em formato. Falha do provedor nunca muda a resposta de `requestCode`.

### Algoritmo — `classifyOtpFailure(events, now)` (R-06)
1. `req` = último `otp_requested` do `email_hash`. Nenhum ou `now − req > 10 min` ⇒ `expired`.
2. Existe `login_succeeded` com o mesmo `email_hash` e method `email_otp` após `req` ⇒ `used`.
3. Senão `wrong_code`.

### Algoritmo — Desbloqueio WebAuthn (vinculado ao dispositivo)
1. `options`: exige estado `LOCKED` (ou `ACTIVE` para teste do botão); sem credencial **com
   `device_id` deste dispositivo** ⇒ 409 `NO_CREDENTIAL`; gera desafio (32 bytes), grava em
   `app_sessions.webauthn_challenge` (+5 min); `allowCredentials` = só credenciais do dono com
   esse `device_id`; `rpID = new URL(APP_ORIGIN).hostname`; `userVerification: "required"`.
2. `verify`: desafio válido e não expirado (consumido — zera a coluna); credencial pertence ao
   dono **e** ao `device_id` da sessão; `verifyAuthenticationResponse` com
   `expectedOrigin = APP_ORIGIN`, `requireUserVerification: true`; `sign_count` novo > antigo
   (ou ambos 0); sucesso ⇒ `last_active_at = now()`, `unlock_failures = 0`, evento
   `session_unlocked`; falha ⇒ `unlock_failures + 1`, evento `unlock_failed`; ao chegar a 5 ⇒
   encerrar (`unlock_failures`) ⇒ 401.
3. Cadastro: só com estado `ACTIVE` e cookie `prumo_enroll_until` válido (≤ 10 min após entrada
   completa); grava `device_id`; `authenticatorAttachment: "platform"`, `residentKey:
   "discouraged"`; evento `unlock_enrolled`. Fora da janela, `/mais/seguranca` oferece
   "Entrar de novo para ativar" (`restartForEnrollment`).

### Algoritmo — `maskEmail(email)`
`local` ⇒ 2 primeiros caracteres + `***` (ou 1 + `***` se ≤ 2); domínio ⇒ 1º caractere + `***`
+ TLD final (`.com`, `.com.br`). Ex.: `fulano@gmail.com` ⇒ `fu***@g***.com`.

### SessionGuard (cliente) — FR-009, FR-012
- `visibilitychange` para `hidden` grava `hiddenAt` em memória; ao voltar `visible` com
  `now − hiddenAt ≥ 15 min` ⇒ cobre a tela (overlay opaco) **antes** de consultar
  `/api/auth/status`; `locked` ⇒ `location.replace("/desbloquear?next=…")`; `401` ⇒
  `/auth/sair?next=…`; `active` ⇒ remove overlay.
- `pageshow` com `event.persisted` ⇒ mesma consulta (página vinda do bfcache).
- Nunca guarda dados em `localStorage`/`sessionStorage`.

### Padrões e bibliotecas
- **Permitidas**: as do Technical Context + `server-only`.
- **Proibidas**: cliente Supabase no navegador (`createBrowserClient`); `NEXT_PUBLIC_SUPABASE_*`;
  ler cookies de auth fora de `src/lib/auth/`; importar `@/lib/supabase/server`
  (`createServiceClient`) fora de `src/lib/auth/**`, `src/app/api/health/route.ts` e
  `src/data/**`; gravar cookies sem `authCookieOptions()`; `console.*` em `src/` fora de
  `src/lib/log.ts` (regra ESLint); `jsonwebtoken`/assinatura própria de JWT; libs de rate limit
  externas; `localStorage` para estado de auth; guarda de auth só em `layout.tsx`.
- Funções puras injetáveis (`evaluateSession`, `evaluateRateLimit`, `classifyOtpFailure`,
  `safeNext`, `maskEmail`, `describeDevice`, `authCookieOptions`, `decideProxy`) — 100% cobertas
  por unit.

### Riscos de segurança (foco do revisor)
| Risco | Mitigação |
|---|---|
| Enumeração de e-mail | mensagem/tempo/cookies idênticos; provedor nunca chamado para e-mail fora da lista; contadores do rate limit evoluem igual (só `otp_failed` conta); pisos de tempo em pedir e verificar; SC-002 testado |
| Open redirect via `next` | `safeNext` + teste com vetores (`//evil`, `/\evil`, `https:`) |
| Sessão roubada após logout | linha `app_sessions` checada em toda requisição; revogação também no Supabase |
| Página sem guarda | `requireSession()` em cada `page.tsx` + dentro de `getDataClient()`; teste estático cobre `page.tsx` |
| Laço de redirect com JWT de sessão encerrada | proxy não redireciona `/entrar` → `/`; páginas mandam para `/auth/sair` |
| Demo ativável em produção | `getAuthService()` depende só de `loadEnv()` (proteção cruzada `VERCEL_ENV`); teste `demo-isolation` |
| Força bruta de OTP | 5 falhas/15 min por e-mail e IP; Supabase também limita verificações por IP |
| Desbloqueio forjado / de outro aparelho | estado `LOCKED` imposto no DAL; desafio de uso único; `userVerification` obrigatório; credencial vinculada a `device_id` |
| Cookies legíveis por JS | `authCookieOptions()` única, usada também no proxy; teste de contrato de todo `Set-Cookie` |
| CSRF | Server Actions do Next checam `Origin`; cookies `SameSite=Lax`; Route Handlers POST validam `Origin = APP_ORIGIN`; `/auth/sair` não desloga sessão ativa |

### Riscos aceitos e itens abertos

| Item | Tipo | Justificativa |
|---|---|---|
| `code` OAuth aparece no log de acesso da Vercel (`/auth/callback?code=`) — M13 | Risco aceito | Fora do controle do app (log da plataforma). O `code` é de uso único, expira em minutos e é inútil sem o `code_verifier` PKCE, que fica em cookie HttpOnly. Logs **do app** nunca o recebem (T041). |
| Janela entre deploy da Vercel e job `deploy-db` no merge — M12 | Risco aceito | O DAL falha fechado (`UNAVAILABLE`, nenhum dado) até a migração aplicar (minutos). Sequência documentada em §Ações externas; envs novas configuradas **antes** do merge. |
| Google no **modo PWA instalado** na tela inicial do iOS — M14 | Risco aceito (Gate 2, 2026-10-05) | Restrito a esse modo: o PWA de tela inicial do iOS tem armazenamento de cookies separado do Safari, e a ida ao Google pode não voltar ao PWA com o verifier PKCE. FR-003 é SHOULD ali; o código por e-mail é o caminho garantido e testado (T022), e a tela oferece o código quando o Google falha (T020, T078). No navegador (desktop e mobile, inclusive Safari no iPhone) o Google é MUST e tem teste automatizado (T078 + T020). Observação em aparelho real no pós-merge (T036), sem efeito de aceite. |
| `getClaims()` em local usa chave JWT simétrica (chamada de rede ao Auth) — L7 | Risco aceito | Projeto de produção novo usa chaves assimétricas (verificação local por JWKS). A meta "≤ 1 consulta" é medida em produção; em local só afeta latência de dev. |
| GUC `prumo.retention` ligável por quem tem a chave secreta | Risco aceito | A proteção do gatilho é contra bugs do app e papéis de usuário; a chave secreta já é confiança total (só servidor). |
| Bfcache de páginas `no-store` em navegadores recentes | Risco aceito | `SessionGuard` revalida em `pageshow.persisted` e cobre a tela; coberto por E2E (T037). |

### Critérios de aceite (Gherkin, com verificação no banco)

```gherkin
Funcionalidade: Entrada com allowlist
  Cenário: Doug entra com código por e-mail
    Dado o usuário provisionado a partir de AUTH_ALLOWED_EMAILS e nenhuma sessão
    Quando informo o e-mail autorizado em /entrar e digito o código recebido no Mailpit
    Então chego à tela inicial em menos de 60 segundos
    E existe 1 linha em app_sessions com method 'email_otp', ended_at nulo, device_id preenchido e
      absolute_expires_at = created_at + 90 dias
    E access_events contém 'otp_requested' e 'login_succeeded' com email_hash e sem o código em nenhuma coluna
    E todo cookie sb-* e prumo_* tem HttpOnly e SameSite=Lax

  Cenário: Novo pedido invalida o código anterior
    Dado que pedi um código e depois, após 60 s, pedi outro
    Quando digito o primeiro código
    Então vejo "Este código expirou ou já foi usado — peça um novo" ou "Código incorreto"
    E nenhuma linha nova em app_sessions

  Cenário: E-mail fora da lista
    Quando informo "estranho@exemplo.com" em /entrar
    Então vejo "Se este e-mail tiver acesso, você receberá um código de 6 dígitos."
    E nenhum e-mail chega ao Mailpit
    E access_events contém 'email_refused' com email_masked "es***@e***.com" e owner_id nulo
    E auth.users continua com o mesmo número de usuários

  Cenário: Pedidos para e-mails recusados não diferenciam e-mails
    Dado 4 pedidos de código para e-mails fora da lista vindos do mesmo IP
    Quando peço código para o e-mail autorizado e depois para outro e-mail fora da lista
    Então as duas respostas são iguais e nenhuma é "Muitas tentativas"

  Cenário: Código expirado
    Dado um código pedido há 11 minutos
    Quando o digito
    Então vejo "Este código expirou ou já foi usado — peça um novo"
    E access_events contém 'otp_failed' com reason 'expired'

  Cenário: Bloqueio por tentativas
    Dado 5 códigos errados para o e-mail autorizado nos últimos 15 minutos
    Quando digito o código correto
    Então vejo "Muitas tentativas. Tente novamente mais tarde."
    E nenhuma linha nova em app_sessions
    E access_events contém 'login_blocked' com reason 'rate_email'

  Cenário: Conta Google fora da lista
    Dado o Supabase Auth simulado devolvendo a identidade "outra@gmail.com"
    Quando /auth/callback é chamado com um code válido
    Então sou redirecionado para /entrar?erro=recusado sem cookie de sessão
    E access_events contém 'email_refused' com method 'google'

Funcionalidade: Proteção de rotas
  Cenário: Página interna sem sessão
    Quando abro "/mais/seguranca" sem cookies
    Então sou redirecionado para "/entrar?next=%2Fmais%2Fseguranca"
  Cenário: API sem sessão
    Quando faço GET /api/auth/status sem cookies
    Então recebo 401 com error "UNAUTHENTICATED" e nenhum dado
  Cenário: Sessão encerrada com JWT ainda válido não gera laço
    Dado uma sessão com ended_at preenchido e access token não expirado
    Quando abro "/"
    Então passo por "/auth/sair" e termino em "/entrar" sem cookies sb-*
  Cenário: Open redirect
    Quando entro com next "//evil.example"
    Então chego a "/"

Funcionalidade: Sessão e bloqueio
  Cenário: Bloqueio após 15 minutos
    Dado uma sessão com last_active_at há 16 minutos e credencial WebAuthn cadastrada neste dispositivo
    Quando abro "/"
    Então sou redirecionado para "/desbloquear?next=%2F"
    E last_active_at não muda no banco
  Cenário: Desbloqueio com biometria
    Dado o autenticador virtual com a credencial cadastrada neste dispositivo
    Quando toco em "Desbloquear"
    Então chego a "/" e last_active_at ≈ agora e unlock_failures = 0
    E absolute_expires_at não muda
    E access_events contém 'session_unlocked'
  Cenário: Credencial de outro dispositivo não desbloqueia
    Dado uma credencial cadastrada só no dispositivo A e uma sessão LOCKED no dispositivo B
    Quando abro "/desbloquear" em B
    Então vejo só "Entrar novamente" e unlock/options responde 409 NO_CREDENTIAL
  Cenário: Sessão de 30 dias sem uso
    Dado last_active_at há 31 dias
    Quando abro "/"
    Então sou levado a /entrar e app_sessions.end_reason = 'idle_30d'
    E access_events contém 'session_expired' exatamente uma vez
  Cenário: Sessão expira no meio de uma ação
    Dado a tela /mais/seguranca aberta em A e a sessão de A encerrada por "Sair de todos" em B
    Quando em A envio "Sair de todos os dispositivos"
    Então a ação retorna SESSION_EXPIRED sem gravar nenhum evento 'logout_all' novo
    E vejo "Sua sessão expirou — entre novamente; a última ação não foi salva"
    E após entrar volto a /mais/seguranca

Funcionalidade: Sair de todos
  Cenário: Revogação imediata
    Dado sessões ativas nos contextos A e B
    Quando em A confirmo "Sair de todos os dispositivos"
    Então toda linha de app_sessions do dono tem end_reason 'logout_all'
    E a próxima requisição de B recebe 401 em menos de 1 minuto
    E o refresh token de B é recusado pelo Supabase
    E access_events contém 'logout_all'

Funcionalidade: Modo demonstração
  Cenário: Entrada automática
    Dado APP_ENV=preview
    Quando abro "/"
    Então vejo a tela inicial como "Usuário Demonstração" e o selo "Demonstração — dados fictícios"
  Cenário: Selo também na entrada
    Dado APP_ENV=preview e que saí da demonstração
    Quando vejo /entrar
    Então o selo "Demonstração — dados fictícios" está visível
  Cenário: Demo impossível em produção
    Dado APP_ENV=production
    Quando envio cookie prumo_demo_out, header ou parâmetro "demo"
    Então getAuthService() é a implementação Supabase e não há sessão
```

## Ações externas e sequência de entrega (exigem confirmação do Doug no momento)

**Antes do merge** (tasks T049–T052):
1. **Google Cloud** (gratuito): criar projeto `prumo`, tela de consentimento externa publicada
   com escopos básicos, cliente OAuth "Web" com redirect `https://<ref>.supabase.co/auth/v1/callback`;
   colar client ID/secret no painel do Supabase (Auth → Providers → Google).
2. **SMTP** (R-07): criar conta **Resend** gratuita com o e-mail autorizado e configurar SMTP no
   Supabase (Auth → SMTP) — **ou** decidir manter o SMTP padrão (2 e-mails/h).
3. **Supabase produção**: desligar "Allow new users to sign up"; `Site URL` e redirect URLs =
   domínio de produção; OTP 6 dígitos / 600 s; template "Magic Link" com `{{ .Token }}`;
   habilitar `pg_cron`; rodar `npm run auth:provision` contra produção (só Admin API).
4. **Vercel produção**: adicionar `SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS`,
   `AUTH_HASH_SECRET`, `APP_ORIGIN` (valem só a partir do próximo deploy, que é o do merge).
   Preview continua sem essas variáveis e com Vercel Authentication (FR-027).

**Merge** (Gate 3): deploy da Vercel + job `deploy-db` aplicam código e migração; até a
migração terminar o app falha fechado (Riscos aceitos). Remover `PRODUCTION_GATE_*` da Vercel
logo após o deploy verde (FR-028: o código novo já não as lê).

**Pós-merge** (checklist T053 e T036 em tasks.md; não contam como teste de requisito).

## Complexity Tracking

Nenhuma violação.
