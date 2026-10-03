# Data Model — 006 · Login

Dona das tabelas: **006** (Constitution VII). Identidade em `auth.users` (Supabase Auth,
gerenciada pelo provedor). A 004 referencia `auth.users(id)` via `owner_id` e usa
`auth.uid()` no RLS — esta feature não altera tabelas da 004.

Migração: `supabase/migrations/<timestamp>_auth_sessions_events.sql` (aditiva; `down` documentado
no fim do arquivo como comentário).

## 1. Tipos

```sql
CREATE TYPE public.access_event_type AS ENUM (
  'otp_requested',      -- pedido de código (autorizado ou não: neutro)
  'otp_failed',         -- reason: wrong_code | expired | used
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
| `owner_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | |
| `method` | `public.auth_method NOT NULL` | `google` \| `email_otp` |
| `device_label` | `VARCHAR(80) NOT NULL` | ex.: "iPhone · Safari" |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `absolute_expires_at` | `TIMESTAMPTZ NOT NULL` | `created_at + 90 days`; nunca muda |
| `last_active_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | só atualizado por requisição **desbloqueada** (throttle 60 s) |
| `unlock_failures` | `SMALLINT NOT NULL DEFAULT 0 CHECK (unlock_failures BETWEEN 0 AND 5)` | zera ao desbloquear |
| `webauthn_challenge` | `VARCHAR(128)` | desafio pendente (base64url) |
| `webauthn_challenge_expires_at` | `TIMESTAMPTZ` | `now() + 5 min` |
| `ended_at` | `TIMESTAMPTZ` | preenchido ao encerrar |
| `end_reason` | `VARCHAR(30)` | `logout` \| `logout_all` \| `idle_30d` \| `absolute_90d` \| `unlock_failures` \| `allowlist_removed` |

Constraints: `CHECK (absolute_expires_at <= created_at + interval '90 days')`;
`CHECK ((ended_at IS NULL) = (end_reason IS NULL))`.
Índices: `(owner_id) WHERE ended_at IS NULL` (lista de sessões ativas); `(ended_at)` (limpeza).

### Estado derivado (não armazenado) — ver máquina de estados no plan
`ACTIVE` · `LOCKED` (`now − last_active_at > 15 min`) · `EXPIRED` · `ENDED`.

## 3. `public.webauthn_credentials`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `owner_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | |
| `credential_id` | `VARCHAR(512) NOT NULL UNIQUE` | base64url |
| `public_key` | `BYTEA NOT NULL` | COSE |
| `sign_count` | `BIGINT NOT NULL DEFAULT 0 CHECK (sign_count >= 0)` | |
| `transports` | `VARCHAR(20)[] NOT NULL DEFAULT '{}'` | |
| `device_label` | `VARCHAR(80) NOT NULL` | |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `last_used_at` | `TIMESTAMPTZ` | |

Índice: `(owner_id)`. Chave pública não é segredo; nada de material privado é armazenado.

## 4. `public.access_events` (somente inserção)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | |
| `occurred_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | UTC; exibido em `America/Sao_Paulo` |
| `type` | `public.access_event_type NOT NULL` | |
| `reason` | `VARCHAR(30)` | ver enum §1 |
| `method` | `public.auth_method NOT NULL DEFAULT 'none'` | |
| `owner_id` | `UUID REFERENCES auth.users(id) ON DELETE SET NULL` | nulo para tentativas anônimas/recusadas |
| `session_id` | `UUID` | referência lógica a `app_sessions.id` (sem FK: eventos sobrevivem à limpeza) |
| `email_hash` | `CHAR(64)` | HMAC-SHA256 hex do e-mail normalizado |
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

`REVOKE ALL ... FROM anon, authenticated` seguido dos `GRANT SELECT` necessários. Eventos com
`owner_id` nulo (recusas) são lidos pelo servidor via `service_role` **depois** de
`requireSession()` (o app é single-user). Gatilho `BEFORE UPDATE OR DELETE` em
`access_events` lança erro exceto quando `current_setting('prumo.retention', true) = 'on'`
(FR-021).

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
| `SUPABASE_PUBLISHABLE_KEY` | local, production | não (mas só servidor) | não vazia |
| `AUTH_ALLOWED_EMAILS` | local, production | **sim** (dado pessoal) | lista separada por vírgula, ≥ 1 e-mail válido, normalizada (minúsculas, trim) |
| `AUTH_HASH_SECRET` | local, production | **sim** | ≥ 32 caracteres |
| `APP_ORIGIN` | local, production | não | URL `https://…` (ou `http://127.0.0.1:3000` em local); define `rpID` WebAuthn e destino do OAuth |
| ~~`PRODUCTION_GATE_USER`~~ / ~~`PRODUCTION_GATE_PASSWORD`~~ | — | — | **removidas** (FR-028) |

Regras novas: em `preview`, `AUTH_*` e `APP_ORIGIN` MUST estar ausentes (falha de boot, como
`SUPABASE_*`). Credenciais Google e SMTP **não** são variáveis do app: ficam no Supabase
(painel em produção; `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_*)` no `config.toml` em local, opcional).

## 8. Supabase Auth (`supabase/config.toml` e painel de produção)

| Chave | Valor |
|---|---|
| `auth.enable_signup` / `auth.email.enable_signup` | `false` |
| `auth.site_url` | `APP_ORIGIN` |
| `auth.additional_redirect_urls` | `["<APP_ORIGIN>/auth/callback"]` |
| `auth.email.otp_length` | `6` |
| `auth.email.otp_expiry` | `600` |
| `auth.email.max_frequency` | `"60s"` |
| `auth.email.template.magic_link` | `supabase/templates/codigo.html` — só `{{ .Token }}`, sem link |
| `auth.external.google` | `enabled = true` em produção; local só se as variáveis existirem |
| `auth.mfa.*`, `anonymous` | desligados |

## 9. Modo demonstração (memória)

`DemoAuthService` mantém: usuário fixo `{ id: "00000000-0000-4000-8000-0000000d3e00", email:
"demo@prumo.invalid", name: "Usuário Demonstração" }`; 3 sessões fictícias ("iPhone · Safari"
atual, "Windows · Edge", "Android · Chrome"); 12 eventos sintéticos determinísticos dos
últimos 30 dias. E-mails de simulação: `demo@prumo.invalid` (autorizado),
qualquer outro (recusado); código válido `246810`; `111111` simula expirado; 5 erros simulam
bloqueio. Nada é persistido (ADR 0006).
