# Data Model — 006 · Login

Dona das tabelas: **006** (Constitution VII). Identidade em `auth.users` (Supabase Auth,
gerenciada pelo provedor). A 004 referencia `auth.users(id)` via `owner_id` e usa
`auth.uid()` no RLS — esta feature não altera tabelas da 004. Todas as FKs para `auth.users`
usam `ON DELETE RESTRICT`, como na 004 (owner-context.md §5: a 006 MUST NOT apagar usuários).

Entidades da spec sem tabela própria: **Pedido de código por e-mail** (o token vive no Supabase
Auth; criação/expiração/uso são derivados dos eventos `otp_requested`, `otp_failed`,
`login_succeeded`) e **Controle de tentativas** (contagem por janela sobre `access_events`,
plan §Rate limit). **Lista de autorizados** = variável `AUTH_ALLOWED_EMAILS` (§7).

Migração: `supabase/migrations/<timestamp>_auth_sessions_events.sql` (aditiva; `down` documentado
no fim do arquivo como comentário).

## 1. Tipos

```sql
CREATE TYPE public.access_event_type AS ENUM (
  'otp_requested',      -- pedido de código (autorizado ou não: neutro)
  'otp_failed',         -- reason: wrong_code | expired | used   (única "falha" do rate limit)
  'email_refused',      -- e-mail fora da allowlist (OTP ou Google)
  'login_succeeded',    -- method: google | email_otp
  'login_blocked',      -- reason: rate_email | rate_ip | throttle_request
  'provider_error',     -- reason: email_send | google_callback | auth_unavailable
  'unlock_enrolled',    -- credencial de biometria/PIN cadastrada
  'session_unlocked',
  'unlock_failed',      -- reason: assertion_invalid | no_credential
  'logout',
  'logout_all',
  'session_expired'     -- reason: idle_30d | absolute_90d | unlock_failures | allowlist_removed
);
CREATE TYPE public.auth_method AS ENUM ('google', 'email_otp', 'webauthn', 'none');
```

## 2. `public.app_sessions`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | = claim `session_id` do JWT do Supabase |
| `owner_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT` | |
| `device_id` | `UUID NOT NULL` | valor do cookie `prumo_device` (§10) |
| `method` | `public.auth_method NOT NULL` | `CHECK (method IN ('google','email_otp'))` |
| `device_label` | `VARCHAR(80) NOT NULL` | ex.: "iPhone · Safari" |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `absolute_expires_at` | `TIMESTAMPTZ NOT NULL` | `created_at + 90 days`; nunca muda |
| `last_active_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | só atualizado por requisição **desbloqueada** (throttle 60 s) |
| `unlock_failures` | `SMALLINT NOT NULL DEFAULT 0 CHECK (unlock_failures BETWEEN 0 AND 5)` | zera ao desbloquear |
| `webauthn_challenge` | `VARCHAR(128)` | desafio pendente (base64url) |
| `webauthn_challenge_expires_at` | `TIMESTAMPTZ` | `now() + 5 min` |
| `ended_at` | `TIMESTAMPTZ` | preenchido ao encerrar |
| `end_reason` | `VARCHAR(30)` | `CHECK (end_reason IN ('logout','logout_all','idle_30d','absolute_90d','unlock_failures','allowlist_removed'))` |

Constraints: `CHECK (absolute_expires_at <= created_at + interval '90 days')`;
`CHECK ((ended_at IS NULL) = (end_reason IS NULL))`;
`CHECK ((webauthn_challenge IS NULL) = (webauthn_challenge_expires_at IS NULL))`.
Índices: `(owner_id) WHERE ended_at IS NULL` (lista de sessões ativas); `(ended_at)` (limpeza).

### Estado derivado (não armazenado) — ver máquina de estados no plan
`ACTIVE` · `LOCKED` (`now − last_active_at > 15 min`) · `EXPIRED` · `ENDED`.

## 3. `public.webauthn_credentials`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `owner_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT` | |
| `device_id` | `UUID NOT NULL` | dispositivo em que foi cadastrada (FR-012: só desbloqueia ali) |
| `credential_id` | `VARCHAR(512) NOT NULL UNIQUE` | base64url |
| `public_key` | `BYTEA NOT NULL` | COSE |
| `sign_count` | `BIGINT NOT NULL DEFAULT 0 CHECK (sign_count >= 0)` | |
| `transports` | `VARCHAR(20)[] NOT NULL DEFAULT '{}'` | |
| `device_label` | `VARCHAR(80) NOT NULL` | |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `last_used_at` | `TIMESTAMPTZ` | |

Índices: `(owner_id)`; `(owner_id, device_id)`.
Chave pública não é segredo; nada de material privado é armazenado.

## 4. `public.access_events` (somente inserção)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | |
| `occurred_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | UTC; exibido em `America/Sao_Paulo` |
| `type` | `public.access_event_type NOT NULL` | |
| `reason` | `VARCHAR(30)` | `CHECK (reason IS NULL OR reason IN ('wrong_code','expired','used','rate_email','rate_ip','throttle_request','email_send','google_callback','auth_unavailable','assertion_invalid','no_credential','idle_30d','absolute_90d','unlock_failures','allowlist_removed'))` |
| `method` | `public.auth_method NOT NULL DEFAULT 'none'` | |
| `owner_id` | `UUID REFERENCES auth.users(id) ON DELETE RESTRICT` | nulo para tentativas anônimas/recusadas (RESTRICT: nenhuma ação de FK faz UPDATE na tabela somente-inserção) |
| `session_id` | `UUID` | referência lógica a `app_sessions.id` (sem FK: eventos sobrevivem à limpeza) |
| `email_hash` | `CHAR(64)` | HMAC-SHA256 hex do e-mail normalizado; **obrigatório** em `otp_requested`, `otp_failed`, `email_refused`, `login_blocked` e `login_succeeded` (base de `classifyOtpFailure`) |
| `email_masked` | `VARCHAR(80)` | ex.: `fu***@g***.com` — só quando o e-mail não é do dono |
| `ip_hash` | `CHAR(64)` | HMAC-SHA256 hex do IP; IP em claro nunca é gravado |
| `device_label` | `VARCHAR(80) NOT NULL` | |
| `geo` | `VARCHAR(80)` | "São Paulo, BR" a partir de cabeçalhos da plataforma; nulo se ausente |

Índices: `(occurred_at DESC)`; `(email_hash, occurred_at DESC)`; `(ip_hash, occurred_at DESC)`.
Proibido armazenar: código OTP, URL de callback, `code` OAuth, tokens, `session_id` do cookie,
e-mail completo de terceiros (FR-018, FR-019).

## 5. RLS (todas as tabelas: `ENABLE ROW LEVEL SECURITY` + `FORCE`)

| Tabela | `authenticated` | `anon` | Escrita |
|---|---|---|---|
| `app_sessions` | `SELECT USING (owner_id = (SELECT auth.uid()))` | nenhuma | só `service_role` (servidor) |
| `webauthn_credentials` | `SELECT USING (owner_id = (SELECT auth.uid()))` | nenhuma | só `service_role` |
| `access_events` | `SELECT USING (owner_id = (SELECT auth.uid()))` | nenhuma | só `service_role`; **sem UPDATE/DELETE** para qualquer papel exceto a rotina de retenção |

`REVOKE ALL ... FROM anon, authenticated` seguido dos `GRANT SELECT` necessários; a função de
gatilho é `SECURITY INVOKER` e `REVOKE EXECUTE` de `anon`/`authenticated`. Eventos com
`owner_id` nulo (recusas) são lidos pelo servidor via `service_role` **depois** de
`requireSession()` (o app é single-user). Gatilho `BEFORE UPDATE OR DELETE` em
`access_events` lança erro exceto quando `current_setting('prumo.retention', true) = 'on'`
(FR-021). **Limite aceito**: o GUC `prumo.retention` pode ser ligado por qualquer sessão com
privilégio de escrita (só `service_role`, que já é servidor); a proteção é contra erro do app e
contra papéis de usuário, não contra quem detém a chave secreta (plan §Riscos aceitos).

## 6. Retenção (pg_cron)

```sql
SELECT cron.schedule('prumo-auth-retention', '0 6 * * *', $$
  SET LOCAL prumo.retention = 'on';
  DELETE FROM public.access_events WHERE occurred_at < now() - interval '90 days';
  DELETE FROM public.app_sessions WHERE ended_at < now() - interval '90 days';
$$);  -- 06:00 UTC = 03:00 BRT
```

## 7. Configuração (adições ao catálogo da 001, `src/lib/env.ts`)

| Nome | Ambientes | Segredo | Regra |
|---|---|---|---|
| `SUPABASE_PUBLISHABLE_KEY` | local, production | não (mas só servidor) | não vazia; mesmo nome usado pela 004 nos testes (decisão transversal 10) |
| `AUTH_ALLOWED_EMAILS` | local, production | **sim** (dado pessoal) | lista separada por vírgula, ≥ 1 e-mail válido, normalizada (minúsculas, trim) |
| `AUTH_HASH_SECRET` | local, production | **sim** | ≥ 32 caracteres |
| `APP_ORIGIN` | local, production | não | URL `https://…` em produção; em local **`http://localhost:<porta>`** (nunca IP: WebAuthn não aceita IP como RP ID); define `rpID`, `expectedOrigin`, checagem de `Origin` e destino do OAuth |
| ~~`PRODUCTION_GATE_USER`~~ / ~~`PRODUCTION_GATE_PASSWORD`~~ | — | — | **removidas** (FR-028) |

Regras novas: em `preview`, `AUTH_*` e `APP_ORIGIN` MUST estar ausentes (falha de boot, como
`SUPABASE_*`). `scripts/start-demo.mjs` MUST zerar todas essas variáveis (inclusive as vindas de
`.env.local`). Em CI: `AUTH_ALLOWED_EMAILS` com e-mails sintéticos `@example.test`,
`AUTH_HASH_SECRET` aleatório por execução, `APP_ORIGIN` por servidor do Playwright. Credenciais Google e SMTP **não** são variáveis do app: ficam no Supabase
(painel em produção; `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_*)` no `config.toml` em local, opcional).

## 8. Supabase Auth (`supabase/config.toml` e painel de produção)

| Chave | Valor |
|---|---|
| `auth.enable_signup` / `auth.email.enable_signup` | `false` |
| `auth.site_url` | `APP_ORIGIN` (local: `http://localhost:3000`) |
| `auth.additional_redirect_urls` | `["<APP_ORIGIN>/auth/callback"]` (local: portas 3000 e 3100) |
| `auth.rate_limit.sign_in_sign_ups` / `token_verifications` (só local) | `1000` / `1000` — os testes (T023, E2E) fazem dezenas de chamadas do mesmo IP; produção mantém o padrão |
| `auth.email.otp_length` | `6` |
| `auth.email.otp_expiry` | `600` |
| `auth.email.max_frequency` | `"60s"` |
| `auth.email.template.magic_link` | `supabase/templates/codigo.html` — só `{{ .Token }}`, sem link |
| `auth.external.google` | `enabled = true` em produção; local só se as variáveis existirem |
| `auth.mfa.*`, `anonymous` | desligados |
| login por senha (`auth.email`) | **não** desligado em local: os testes de integração da 004 criam usuários pela Admin API e entram por senha; o app não oferece senha |

## 9. Modo demonstração (memória)

`DemoAuthService` mantém: usuário fixo `{ id: DEMO_OWNER_ID, email: "demo@prumo.invalid", name:
"Usuário Demonstração" }`, com `DEMO_OWNER_ID` **importado de `@/data/core` (dono: 004)** —
`00000000-0000-4000-8000-00000000d3e0`; a 006 não define outra constante. Sessão demo = cookie
`prumo_demo_sid` da 004 (TTL 2 h); `SessionContext.sessionId` = esse valor. Estado por
`prumo_demo_sid` (Map em memória, mesmo LRU/TTL da 004): 3 sessões fictícias ("iPhone · Safari"
atual, "Windows · Edge", "Android · Chrome"); 12 eventos sintéticos determinísticos dos
últimos 30 dias + eventos gerados nas simulações. Cookie próprio da 006 só `prumo_demo_out=1`
("saiu da demo"). E-mails de simulação: `demo@prumo.invalid` (autorizado), qualquer outro
(recusado); código válido `246810`; `111111` simula expirado; 5 erros simulam bloqueio. Nada é
persistido em banco (ADR 0006).

## 10. Cookies (todos `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` fora de `local`)

Opções geradas por uma única função pura `authCookieOptions(appEnv)` usada por **todos** os
adaptadores de cookie (Server Actions/Route Handlers via `cookies()` e `src/proxy.ts` via
`NextResponse.cookies`) — FR-023.

| Cookie | Dono | Validade | Conteúdo |
|---|---|---|---|
| `sb-<ref>-auth-token*` | 006 (via `@supabase/ssr`) | ≤ 90 d | sessão Supabase |
| `prumo_device` | 006 | 400 d (máximo dos navegadores) | UUID aleatório do dispositivo; criado na entrada completa se ausente |
| `prumo_otp_email` | 006 | 10 min | e-mail digitado (para `/entrar/codigo`) |
| `prumo_next` | 006 | 10 min | destino seguro após Google |
| `prumo_enroll_until` | 006 | 10 min | janela de cadastro da biometria |
| `prumo_demo_out` | 006 | sessão | só `preview` |
| `prumo_demo_sid` | **004** | 2 h | só `preview`; preservado pelo proxy da 006 |

