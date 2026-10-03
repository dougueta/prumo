# Implementation Plan: Login

**Branch**: `006-login` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-login/spec.md` (aprovada no Gate 1)

## Summary

Substituir a trava Basic Auth provisória da 001 por autenticação real e single-user: identidade
pelo **Supabase Auth** (Google OAuth como principal + código de 6 dígitos por e-mail como
reserva, cadastro desligado, allowlist só no servidor), **sessões controladas pelo app**
(`app_sessions`: 30 dias renováveis, máximo absoluto de 90, revogação imediata) e **bloqueio
após 15 min sem uso** desfeito por **WebAuthn de plataforma** (biometria/PIN do aparelho),
imposto no servidor. Todo o fluxo roda no servidor (sem cliente Supabase no navegador, cookies
HttpOnly). Eventos de acesso auditáveis com rate limit sobre eles. Modo demonstração com
`DemoAuthService` em memória. Detalhes em [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdado da 001)
**Primary Dependencies**: Next.js 16.3 (`proxy.ts`, Server Actions, Route Handlers), React 19.2,
@supabase/supabase-js 2.117, **@supabase/ssr 0.12.7**, **@simplewebauthn/server 14.0.3**,
**@simplewebauthn/browser 14.0.0**, zod 4.6; dev: **msw 3.0.2**
**Storage**: Supabase Postgres — `app_sessions`, `webauthn_credentials`, `access_events`
(dona: 006) + `auth.users` (Supabase Auth); `pg_cron` para retenção
**Testing**: Vitest 5 (unit/integração com Supabase local/CI), Playwright 1.63 (E2E com Mailpit
do Supabase CLI e autenticador WebAuthn virtual do Chromium via CDP)
**Target Platform**: PWA — Safari iOS 16+ (tela inicial), Chrome Android, desktop
**Project Type**: web app Next.js único (estrutura da 001)
**Performance Goals**: reabrir com sessão ativa ≤ 2 s até a tela inicial (SC-004); verificação
de sessão por requisição ≤ 1 consulta ao banco (memoizada); resposta de pedido de código com
piso fixo de 1.500 ms (SC-002)
**Constraints**: custo R$ 0; nenhum segredo/token acessível a JS do navegador; preview sem
banco; mesmo build serve `local`/`preview`/`production` (sem `NEXT_PUBLIC_SUPABASE_*`)
**Scale/Scope**: 1 usuário, ≤ 5 dispositivos; ~6 telas/rotas novas; base de autorização para
todas as features de dados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 006 aprovada (Gate 1, 2026-10-02); branch `006-login` | ✅ |
| II. Privacidade | Allowlist e segredos só em env de servidor; cookies HttpOnly/Secure; sem cliente Supabase no browser; IP e e-mails de terceiros só como HMAC/mascarados; nenhum token/código em eventos ou logs; RLS + FORCE em todas as tabelas novas; e-mail real nunca no repositório (provisionamento por script lendo env) | ✅ |
| III. Dinheiro exato | N/A — sem valores monetários | ✅ |
| IV. Rastreabilidade | `access_events` somente-inserção (gatilho bloqueia UPDATE/DELETE fora da retenção); sessões encerradas mantêm motivo | ✅ |
| V. Test-first | Tasks teste → implementação; contrato de callback/OTP com MSW; E2E de login (OTP via Mailpit), bloqueio e WebAuthn virtual; nenhum teste contra Google/SMTP reais | ✅ |
| VI. IA assistente | N/A — sem IA | ✅ |
| VII. Donos de dados / demo | 006 é dona de `app_sessions`, `webauthn_credentials`, `access_events`; só referencia `auth.users`; não toca tabelas da 004; `DemoAuthService` em memória para `preview` | ✅ |
| VIII. Revisão independente | PR `autor:claude` → Gemini; foco do revisor: §Riscos de segurança abaixo | ✅ |
| IX. Qualidade dos artefatos | data-model tipado com RLS, contracts (OpenAPI + fluxos + DAL), máquina de estados, algoritmos, Gherkin com checagem no banco, rastreabilidade FR → tasks | ✅ |
| X. Simplicidade | Sem Redis/serviço de rate limit (contagem sobre `access_events`); sem lib de UA; sem hook de Auth; 3 dependências justificadas (research R-15) | ✅ |
| Custo R$ 0 | Supabase Free (Auth 50k MAU, pg_cron), Google OAuth gratuito, SMTP Resend free (3.000/mês, 100/dia) **ou** SMTP padrão (2/h) — ⚠️ escolha do Doug (R-07); Vercel Hobby (cabeçalhos de geo gratuitos) | ✅ |

**Re-check pós-design**: ✅ sem violações. Complexity Tracking vazio.

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
├── proxy.ts                         # REESCRITO: refresh Supabase + redirect otimista (auth-flows §2)
├── app/
│   ├── layout.tsx                   # + <SessionGuard/> (cliente)
│   ├── (public)/entrar/
│   │   ├── page.tsx                 # Google + e-mail
│   │   ├── codigo/page.tsx          # 6 dígitos
│   │   └── actions.ts               # requestCode, verifyCode, signInWithGoogle
│   ├── (app)/
│   │   ├── layout.tsx               # requireSession() — guarda de todas as páginas internas
│   │   ├── page.tsx                 # tela inicial (movida de app/page.tsx)
│   │   ├── desbloquear/page.tsx     # requireSession({allowLocked}) + botão WebAuthn
│   │   └── seguranca/
│   │       ├── page.tsx             # sessões ativas + histórico + biometria
│   │       └── actions.ts           # signOut, signOutEverywhere
│   ├── auth/callback/route.ts       # OAuth PKCE
│   └── api/auth/
│       ├── status/route.ts
│       └── webauthn/{register,unlock}/{options,verify}/route.ts
├── lib/
│   ├── env.ts                       # + SUPABASE_PUBLISHABLE_KEY, AUTH_*, APP_ORIGIN; − PRODUCTION_GATE_*
│   ├── production-gate.ts           # REMOVIDO (FR-028)
│   └── auth/
│       ├── dal.ts                   # requireSession, getDataClient (contrato dal.md)
│       ├── service.ts               # interface AuthService + getAuthService()
│       ├── supabase-service.ts      # implementação real
│       ├── demo-service.ts          # implementação demo (memória)
│       ├── supabase-clients.ts      # createAuthClient (ssr, cookies HttpOnly), admin client
│       ├── session-state.ts         # evaluateSession() — PURO (máquina de estados)
│       ├── rate-limit.ts            # evaluateRateLimit() — PURO
│       ├── allowlist.ts             # normalizeEmail, isAllowed — PURO
│       ├── crypto.ts                # hmacHex, maskEmail — PURO
│       ├── safe-next.ts             # safeNext — PURO
│       ├── device.ts                # describeDevice(ua), geoFromHeaders — PURO
│       ├── neutral-timing.ts        # withFloor(ms, fn)
│       ├── otp-classify.ts          # classifyOtpFailure(events, now) — PURO
│       ├── events.ts                # recordEvent (service_role), listEvents
│       ├── sessions.ts              # establishSession, endSession, endAllSessions, listSessions
│       └── webauthn.ts              # opções/verificação (SimpleWebAuthn)
├── components/auth/
│   ├── session-guard.tsx            # "use client": visibilitychange/pageshow → /api/auth/status
│   ├── unlock-button.tsx            # "use client": startAuthentication()
│   ├── enroll-biometrics.tsx        # "use client": startRegistration()
│   └── use-auth-aware-action.ts     # trata SESSION_EXPIRED / LOCKED (FR-013)
scripts/auth-provision.mjs           # cria o usuário do Doug a partir de AUTH_ALLOWED_EMAILS
supabase/
├── config.toml                      # [auth] conforme data-model §8
├── templates/codigo.html            # e-mail só com {{ .Token }}
└── migrations/<ts>_auth_sessions_events.sql
tests/
├── unit/auth/                       # session-state, rate-limit, allowlist, crypto, safe-next,
│                                    # device, otp-classify, env, demo-isolation, protected-surface
├── contract/auth/                   # callback, requestCode/verifyCode com MSW (Supabase Auth simulado)
├── integration/auth/                # RLS, gatilho somente-inserção, sessions/events no Supabase do CI
└── e2e/auth/                        # login-otp, refused, rate-limit, session-lock (WebAuthn virtual),
                                     # logout-all, back-button, demo
```

**Structure Decision**: mantém o projeto único da 001. Auth isolado em `src/lib/auth/` com
funções puras (testáveis sem rede) e duas implementações de `AuthService` (Constitution VII).

## Design Detalhado

### Máquina de estados — Sessão (`evaluateSession(row, now, hasCredential)`)

```
            login ok (Google/OTP + allowlist)
  NONE ─────────────────────────────────────▶ ACTIVE ◀──────────────┐
                                               │  │                 │ asserção WebAuthn válida
                         now−last_active>15min │  │                 │ (unlock_failures := 0)
                                               ▼  │                 │
                                             LOCKED ────────────────┘
                                               │  │
           5ª falha de desbloqueio ou sem      │  │ logout / logout_all
           credencial + usuário escolhe        │  │
           "entrar de novo"                    ▼  ▼
                                   ENDED (end_reason)          EXPIRED (idle_30d | absolute_90d)
```

Regras de avaliação (ordem fixa, servidor):
1. Sem linha ou `ended_at` não nulo ⇒ `ENDED`.
2. `now ≥ absolute_expires_at` ⇒ `EXPIRED(absolute_90d)`.
3. `now − last_active_at ≥ 30 d` ⇒ `EXPIRED(idle_30d)`.
4. E-mail do JWT ∉ allowlist ⇒ `ENDED(allowlist_removed)`.
5. `now − last_active_at > 15 min` ⇒ `LOCKED` (`canUnlock = hasCredential`).
6. Senão `ACTIVE`.

Transições **proibidas** (testadas): `ENDED/EXPIRED → ACTIVE` (sempre nova sessão);
`LOCKED → ACTIVE` sem asserção verificada no servidor; desbloqueio alterar
`absolute_expires_at`; requisição `LOCKED` atualizar `last_active_at`; servir dados em
`LOCKED`; reativar sessão após `logout_all`.
Efeitos: ao detectar `EXPIRED`/`ENDED` por avaliação, gravar `ended_at`/`end_reason` (se ainda
nulos), evento `session_expired` uma única vez, `auth.admin.signOut(jwt,"local")`, limpar cookies.

### Algoritmo — `establishSession(method)` (após Google callback ou `verifyOtp`)
1. `claims = getClaims()`; exigir `claims.email` verificado e `isAllowed(claims.email)`; senão
   `signOut` + evento `email_refused` ⇒ `/entrar?erro=recusado`.
2. `INSERT app_sessions (id = claims.session_id, owner_id = claims.sub, method, device_label,
   absolute_expires_at = now() + 90 d)` `ON CONFLICT (id) DO NOTHING`.
3. Evento `login_succeeded` (method, device, geo, session_id).
4. Cookie `prumo_enroll_until = now + 10 min` (HttpOnly) — habilita a oferta de cadastro da
   biometria se `navigator.credentials` existir e o usuário ainda não tiver credencial neste
   dispositivo.

### Algoritmo — `requireSession({ allowLocked })` (DAL, memoizado com `cache()`)
1. `preview` ⇒ `DemoAuthService.current()` (ou redirect `/entrar` se `prumo_demo_out=1`).
2. `claims = await supabase.auth.getClaims()` (JWT verificado; inválido ⇒ UNAUTHENTICATED).
3. `row = SELECT … FROM app_sessions WHERE id = claims.session_id` (service_role, 1 consulta,
   junto com `EXISTS webauthn_credentials`).
4. `state = evaluateSession(row, now, hasCredential)`; aplicar efeitos/respostas de `dal.md`.
5. `ACTIVE` e `now − last_active_at > 60 s` ⇒ `UPDATE last_active_at = now()` (throttle).

### Algoritmo — Rate limit (`evaluateRateLimit(counts, now)`, puro; contagens por SQL)
Entradas (uma consulta agregada sobre `access_events`):
- `fe` = falhas (`otp_failed`, `email_refused`) com `email_hash = e` em `[now−15 min, now]`;
- `fi` = mesmas falhas com `ip_hash = i` na mesma janela;
- `re1` = `otp_requested` com `email_hash = e` em `[now−60 s, now]`; `re60` em `[now−60 min, now]`;
- `ri60` = `otp_requested` com `ip_hash = i` em `[now−60 min, now]`.
Decisão:
1. `fe ≥ 5` ⇒ `BLOCKED(rate_email)`; `fi ≥ 5` ⇒ `BLOCKED(rate_ip)`.
2. Só para `requestCode`: `re1 ≥ 1` ou `re60 ≥ 5` ou `ri60 ≥ 10` ⇒ `BLOCKED(throttle_request)`.
3. Senão `ALLOWED`.
`BLOCKED` gera `login_blocked` (não conta como falha ⇒ o bloqueio expira 15 min após a 5ª falha
mais recente, janela deslizante). Normalização antes do HMAC: `trim().toLowerCase()`; IP do
cabeçalho `x-forwarded-for` (primeiro valor, fornecido pela Vercel) ou `"local"`.

### Algoritmo — Resposta neutra de `requestCode` (FR-002, SC-002)
`withFloor(1500, async () => { …passos de auth-flows §4… })`: mede o tempo; se < 1.500 ms,
aguarda o restante. Mesmo texto, mesmo status, mesmo redirect, mesmos cookies para qualquer
e-mail válido em formato. Falha do provedor nunca muda a resposta.

### Algoritmo — `classifyOtpFailure(events, now)` (R-06)
1. `req` = último `otp_requested` do `email_hash`. Nenhum ou `now − req > 10 min` ⇒ `expired`.
2. Existe `login_succeeded` do mesmo `email_hash`/method `email_otp` após `req` ⇒ `used`.
3. Senão `wrong_code`.

### Algoritmo — Desbloqueio WebAuthn
1. `options`: exige estado `LOCKED` (ou `ACTIVE` para teste do botão); sem credencial ⇒ 409;
   gera desafio (32 bytes), grava em `app_sessions.webauthn_challenge` (+5 min);
   `allowCredentials` = credenciais do dono; `rpID = new URL(APP_ORIGIN).hostname`;
   `userVerification: "required"`.
2. `verify`: desafio válido e não expirado (consumido — zera a coluna); `verifyAuthenticationResponse`
   com `expectedOrigin = APP_ORIGIN`, `requireUserVerification: true`; `sign_count` novo > antigo
   (ou ambos 0); sucesso ⇒ `last_active_at = now()`, `unlock_failures = 0`, evento
   `session_unlocked`; falha ⇒ `unlock_failures + 1`, evento `unlock_failed`; ao chegar a 5 ⇒
   encerrar (`unlock_failures`) ⇒ 401.
3. Cadastro: só com estado `ACTIVE` e cookie `prumo_enroll_until` válido (≤ 10 min após entrada
   completa); `authenticatorAttachment: "platform"`, `residentKey: "discouraged"`; evento
   `unlock_enrolled`.

### Algoritmo — `maskEmail(email)`
`local` ⇒ 2 primeiros caracteres + `***` (ou 1 + `***` se ≤ 2); domínio ⇒ 1º caractere + `***`
+ TLD final (`.com`, `.com.br`). Ex.: `fulano@gmail.com` ⇒ `fu***@g***.com`.

### SessionGuard (cliente) — FR-009, FR-012
- `visibilitychange` para `hidden` grava `hiddenAt` em memória; ao voltar `visible` com
  `now − hiddenAt ≥ 15 min` ⇒ cobre a tela (overlay opaco) **antes** de consultar
  `/api/auth/status`; `locked` ⇒ `location.replace("/desbloquear?next=…")`; `401` ⇒
  `/entrar?next=…`; `active` ⇒ remove overlay.
- `pageshow` com `event.persisted` ⇒ mesma consulta (página vinda do bfcache).
- Nunca guarda dados em `localStorage`/`sessionStorage`.

### Padrões e bibliotecas
- **Permitidas**: as do Technical Context + `server-only`.
- **Proibidas**: cliente Supabase no navegador (`createBrowserClient`); `NEXT_PUBLIC_SUPABASE_*`;
  ler cookies de auth fora de `src/lib/auth/`; usar o cliente com chave secreta para dados de
  usuário fora de `src/lib/auth/` (exceto testes); `jsonwebtoken`/assinatura própria de JWT;
  libs de rate limit externas; `localStorage` para estado de auth.
- Funções puras injetáveis (`evaluateSession`, `evaluateRateLimit`, `classifyOtpFailure`,
  `safeNext`, `maskEmail`, `describeDevice`) — 100% cobertas por unit.

### Riscos de segurança (foco do revisor)
| Risco | Mitigação |
|---|---|
| Enumeração de e-mail | mensagem/tempo/cookies idênticos; provedor nunca chamado para e-mail fora da lista; SC-002 testado |
| Open redirect via `next` | `safeNext` + teste com vetores (`//evil`, `/\evil`, `https:`) |
| Sessão roubada após logout | linha `app_sessions` checada em toda requisição; revogação também no Supabase |
| Demo ativável em produção | `getAuthService()` depende só de `loadEnv()` (proteção cruzada `VERCEL_ENV`); teste `demo-isolation` |
| Força bruta de OTP | 5 falhas/15 min por e-mail e IP; Supabase também limita verificações por IP |
| Desbloqueio forjado no cliente | estado `LOCKED` imposto no DAL; desafio de uso único no servidor; `userVerification` obrigatório |
| CSRF | Server Actions do Next checam `Origin`; cookies `SameSite=Lax`; Route Handlers POST validam `Origin = APP_ORIGIN` |

### Critérios de aceite (Gherkin, com verificação no banco)

```gherkin
Funcionalidade: Entrada com allowlist
  Cenário: Doug entra com código por e-mail
    Dado o usuário provisionado a partir de AUTH_ALLOWED_EMAILS e nenhuma sessão
    Quando informo o e-mail autorizado em /entrar e digito o código recebido no Mailpit
    Então chego à tela inicial
    E existe 1 linha em app_sessions com method 'email_otp', ended_at nulo e
      absolute_expires_at = created_at + 90 dias
    E access_events contém 'otp_requested' e 'login_succeeded' sem o código em nenhuma coluna

  Cenário: E-mail fora da lista
    Quando informo "estranho@exemplo.com" em /entrar
    Então vejo "Se este e-mail tiver acesso, você receberá um código de 6 dígitos."
    E nenhum e-mail chega ao Mailpit
    E access_events contém 'email_refused' com email_masked "es***@e***.com" e owner_id nulo
    E auth.users continua com exatamente 1 usuário

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
    Quando abro "/seguranca" sem cookies
    Então sou redirecionado para "/entrar?next=%2Fseguranca"
  Cenário: API sem sessão
    Quando faço GET /api/auth/status sem cookies
    Então recebo 401 com error "UNAUTHENTICATED" e nenhum dado
  Cenário: Open redirect
    Quando entro com next "//evil.example"
    Então chego a "/"

Funcionalidade: Sessão e bloqueio
  Cenário: Bloqueio após 15 minutos
    Dado uma sessão com last_active_at há 16 minutos e credencial WebAuthn cadastrada
    Quando abro "/"
    Então sou redirecionado para "/desbloquear?next=%2F"
    E last_active_at não muda no banco
  Cenário: Desbloqueio com biometria
    Dado o autenticador virtual com a credencial cadastrada
    Quando toco em "Desbloquear"
    Então chego a "/" e last_active_at ≈ agora e unlock_failures = 0
    E absolute_expires_at não muda
    E access_events contém 'session_unlocked'
  Cenário: Sessão de 30 dias sem uso
    Dado last_active_at há 31 dias
    Quando abro "/"
    Então sou levado a /entrar e app_sessions.end_reason = 'idle_30d'
    E access_events contém 'session_expired' exatamente uma vez
  Cenário: Sessão expira no meio de uma ação
    Dado uma sessão encerrada enquanto a tela está aberta
    Quando envio uma Server Action protegida
    Então ela retorna SESSION_EXPIRED sem gravar nada
    E vejo "Sua sessão expirou — entre novamente; a última ação não foi salva"

Funcionalidade: Sair de todos
  Cenário: Revogação imediata
    Dado sessões ativas nos contextos A e B
    Quando em A confirmo "Sair de todos os dispositivos"
    Então toda linha de app_sessions do dono tem end_reason 'logout_all'
    E a próxima requisição de B recebe 401 em menos de 1 minuto
    E access_events contém 'logout_all'

Funcionalidade: Modo demonstração
  Cenário: Entrada automática
    Dado APP_ENV=preview
    Quando abro "/"
    Então vejo a tela inicial como "Usuário Demonstração" e o selo "Demonstração — dados fictícios"
  Cenário: Demo impossível em produção
    Dado APP_ENV=production
    Quando envio cookie prumo_demo_out, header ou parâmetro "demo"
    Então getAuthService() é a implementação Supabase e não há sessão
```

## Ações externas na implementação (exigem confirmação do Doug no momento)
1. **Google Cloud** (gratuito): criar projeto `prumo`, tela de consentimento externa publicada
   com escopos básicos, cliente OAuth "Web" com redirect `https://<ref>.supabase.co/auth/v1/callback`;
   colar client ID/secret no painel do Supabase (Auth → Providers → Google).
2. **SMTP** (R-07): criar conta **Resend** gratuita com o e-mail autorizado e configurar SMTP no
   Supabase (Auth → SMTP) — **ou** decidir manter o SMTP padrão (2 e-mails/h).
3. **Supabase produção**: desligar "Allow new users to sign up"; `Site URL` e redirect URLs =
   domínio de produção; OTP 6 dígitos / 600 s; template "Magic Link" com `{{ .Token }}`;
   habilitar `pg_cron`.
4. **Vercel produção**: adicionar `SUPABASE_PUBLISHABLE_KEY`, `AUTH_ALLOWED_EMAILS`,
   `AUTH_HASH_SECRET`, `APP_ORIGIN`; remover `PRODUCTION_GATE_*` **no mesmo deploy** (FR-028);
   Preview continua sem essas variáveis e com Vercel Authentication (FR-027).
5. Rodar `npm run auth:provision` contra produção uma vez (cria o usuário do Doug).

## Complexity Tracking

Nenhuma violação.
