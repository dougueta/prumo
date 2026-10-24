-- Feature 006 · login (dona de app_sessions, webauthn_credentials, access_events).
-- specs/006-login/data-model.md §1–§6. Aditiva; não toca tabelas da 004. Identidade em auth.users
-- (Supabase Auth); todas as FKs para auth.users são ON DELETE RESTRICT (a 006 não apaga usuários).

-- §1 Tipos ------------------------------------------------------------------------------------
CREATE TYPE public.access_event_type AS ENUM (
  'otp_requested', 'otp_failed', 'email_refused', 'login_succeeded', 'login_blocked',
  'provider_error', 'unlock_enrolled', 'session_unlocked', 'unlock_failed', 'logout',
  'logout_all', 'session_expired'
);
CREATE TYPE public.auth_method AS ENUM ('google', 'email_otp', 'webauthn', 'none');

-- §2 Sessões ----------------------------------------------------------------------------------
CREATE TABLE public.app_sessions (
  id                            UUID PRIMARY KEY, -- = claim session_id do JWT do Supabase
  owner_id                      UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  device_id                     UUID NOT NULL,    -- cookie prumo_device
  method                        public.auth_method NOT NULL
                                  CHECK (method IN ('google', 'email_otp')),
  device_label                  VARCHAR(80) NOT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_expires_at           TIMESTAMPTZ NOT NULL,
  last_active_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlock_failures               SMALLINT NOT NULL DEFAULT 0
                                  CHECK (unlock_failures BETWEEN 0 AND 5),
  webauthn_challenge            VARCHAR(128),
  webauthn_challenge_expires_at TIMESTAMPTZ,
  ended_at                      TIMESTAMPTZ,
  end_reason                    VARCHAR(30) CHECK (end_reason IN (
                                  'logout', 'logout_all', 'idle_30d', 'absolute_90d',
                                  'unlock_failures', 'allowlist_removed')),
  CONSTRAINT app_sessions_absolute_max CHECK (absolute_expires_at <= created_at + interval '90 days'),
  CONSTRAINT app_sessions_ended_pair CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
  CONSTRAINT app_sessions_challenge_pair
    CHECK ((webauthn_challenge IS NULL) = (webauthn_challenge_expires_at IS NULL))
);
CREATE INDEX app_sessions_owner_active_idx ON public.app_sessions (owner_id) WHERE ended_at IS NULL;
CREATE INDEX app_sessions_ended_idx ON public.app_sessions (ended_at);

-- §3 Credenciais de desbloqueio (WebAuthn) ----------------------------------------------------
CREATE TABLE public.webauthn_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  device_id     UUID NOT NULL, -- só desbloqueia neste dispositivo (FR-012)
  credential_id VARCHAR(512) NOT NULL UNIQUE,
  public_key    BYTEA NOT NULL,
  sign_count    BIGINT NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  transports    VARCHAR(20)[] NOT NULL DEFAULT '{}',
  device_label  VARCHAR(80) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX webauthn_credentials_owner_idx ON public.webauthn_credentials (owner_id);
CREATE INDEX webauthn_credentials_owner_device_idx
  ON public.webauthn_credentials (owner_id, device_id);

-- §4 Eventos de acesso (somente inserção) -----------------------------------------------------
CREATE TABLE public.access_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  type         public.access_event_type NOT NULL,
  reason       VARCHAR(30) CHECK (reason IS NULL OR reason IN (
                 'wrong_code', 'expired', 'used', 'rate_email', 'rate_ip', 'throttle_request',
                 'email_send', 'google_callback', 'auth_unavailable', 'assertion_invalid',
                 'no_credential', 'idle_30d', 'absolute_90d', 'unlock_failures',
                 'allowlist_removed')),
  method       public.auth_method NOT NULL DEFAULT 'none',
  owner_id     UUID REFERENCES auth.users (id) ON DELETE RESTRICT,
  session_id   UUID, -- referência lógica (sem FK: eventos sobrevivem à limpeza de sessões)
  email_hash   CHAR(64),
  email_masked VARCHAR(80),
  ip_hash      CHAR(64),
  device_label VARCHAR(80) NOT NULL,
  geo          VARCHAR(80),
  -- Base do rate limit e de classifyOtpFailure (R-06, R-09).
  CONSTRAINT access_events_email_hash_required CHECK (
    type NOT IN ('otp_requested', 'otp_failed', 'email_refused', 'login_blocked', 'login_succeeded')
    OR email_hash IS NOT NULL
  )
);
CREATE INDEX access_events_occurred_idx ON public.access_events (occurred_at DESC);
CREATE INDEX access_events_email_idx ON public.access_events (email_hash, occurred_at DESC);
CREATE INDEX access_events_ip_idx ON public.access_events (ip_hash, occurred_at DESC);

-- FR-021: nada edita nem apaga eventos, exceto a rotina de retenção (prumo.retention = on).
CREATE FUNCTION public.access_events_insert_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('prumo.retention', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'access_events é somente inserção (FR-021)' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER access_events_insert_only
  BEFORE UPDATE OR DELETE ON public.access_events
  FOR EACH ROW EXECUTE FUNCTION public.access_events_insert_only();
REVOKE ALL ON FUNCTION public.access_events_insert_only() FROM PUBLIC, anon, authenticated;

-- §5 RLS + privilégios ------------------------------------------------------------------------
ALTER TABLE public.app_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.access_events        FORCE ROW LEVEL SECURITY;

CREATE POLICY app_sessions_select ON public.app_sessions FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY webauthn_credentials_select ON public.webauthn_credentials FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY access_events_select ON public.access_events FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Usuário só lê; escrita só pelo servidor (service_role, que ignora RLS). Sem DELETE para ninguém
-- da Data API: sessões encerram por ended_at; eventos são somente inserção.
REVOKE ALL ON public.app_sessions, public.webauthn_credentials, public.access_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.app_sessions, public.webauthn_credentials, public.access_events
  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_sessions, public.webauthn_credentials TO service_role;
GRANT SELECT, INSERT ON public.access_events TO service_role;

-- §6 Retenção: 90 dias (FR-020). 06:00 UTC = 03:00 BRT. -----------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('prumo-auth-retention', '0 6 * * *', $job$
  SET LOCAL prumo.retention = 'on';
  DELETE FROM public.access_events WHERE occurred_at < now() - interval '90 days';
  DELETE FROM public.app_sessions WHERE ended_at < now() - interval '90 days';
$job$);

-- Down (manual, documentado):
--   SELECT cron.unschedule('prumo-auth-retention');
--   DROP TABLE public.access_events, public.webauthn_credentials, public.app_sessions;
--   DROP FUNCTION public.access_events_insert_only();
--   DROP TYPE public.access_event_type, public.auth_method;
