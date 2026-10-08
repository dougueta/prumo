-- Feature 004 · modelo-dados-core (dona de todas as estruturas deste arquivo).
-- Contrato: specs/004-modelo-dados-core/data-model.md §2 (tabelas, CHECKs, índices e guardas).
-- Auditoria/proibição de DELETE: *_core_audit.sql · RLS e privilégios: *_core_rls.sql ·
-- funções do contrato: *_core_functions.sql · seed gerado: *_core_seed_catalog.sql.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------------------------
-- 2.1 Funções utilitárias
-- ---------------------------------------------------------------------------------------------

-- Chave de nome sem acento/caixa (R-11). IMMUTABLE com dicionário explícito.
CREATE FUNCTION public.core_name_key(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$ SELECT lower(trim(extensions.unaccent('extensions.unaccent'::regdictionary, p))) $$;

-- Dono efetivo (R-03): JWT → auth.uid(); chave secreta → p_owner_id obrigatório.
CREATE FUNCTION public.core_resolve_owner(p_owner_id UUID) RETURNS UUID
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    IF p_owner_id IS NOT NULL AND p_owner_id <> v_uid THEN
      RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_uid;
  END IF;
  IF p_owner_id IS NOT NULL
     AND (current_user = 'service_role' OR COALESCE(auth.role(), '') = 'service_role') THEN
    RETURN p_owner_id;
  END IF;
  RAISE EXCEPTION 'core.owner_required' USING ERRCODE = '42501';
END $$;

-- Ator da transação corrente (R-02).
CREATE FUNCTION public.core_current_actor() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT COALESCE(
  NULLIF(current_setting('prumo.actor', true), '')::jsonb,
  CASE WHEN auth.uid() IS NOT NULL THEN '{"type":"user"}'::jsonb
       ELSE '{"type":"system"}'::jsonb END) $$;

-- Identidade por impressão digital (R-06): base calculada em TS, ocorrência derivada no banco.
CREATE FUNCTION public.core_fp_identity(p_base TEXT, p_occurrence INT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$ SELECT 'fp:' || encode(sha256(convert_to(p_base || '|' || p_occurrence::text, 'UTF8')), 'hex') $$;

-- Início de toda função do contrato: resolve o dono, valida e publica o ator (R-02) e limpa
-- os marcadores de ação/motivo da transação.
CREATE FUNCTION public.core_begin(p_owner_id UUID, p_actor JSONB) RETURNS UUID
LANGUAGE plpgsql VOLATILE SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_resolve_owner(p_owner_id);
  v_actor JSONB := COALESCE(p_actor, public.core_current_actor());
BEGIN
  IF jsonb_typeof(v_actor) <> 'object'
     OR (v_actor->>'type') IS NULL
     OR (v_actor->>'type') NOT IN ('user','sync','import','ai','rule','system')
     OR length(COALESCE(v_actor->>'ref', '')) > 100
     OR COALESCE(v_actor->>'batchId', '00000000-0000-0000-0000-000000000000')
        !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'core.validation:actor';
  END IF;
  v_actor := jsonb_strip_nulls(jsonb_build_object(
    'type', v_actor->>'type', 'ref', v_actor->>'ref', 'batchId', v_actor->>'batchId'));
  PERFORM set_config('prumo.actor', v_actor::text, true);
  PERFORM set_config('prumo.action', '', true);
  PERFORM set_config('prumo.reason', '', true);
  PERFORM set_config('prumo.force_unlink', '', true);
  RETURN v_owner;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2.2 institutions
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.institutions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- NULL = catálogo
  name             VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  kind             VARCHAR(20)  NOT NULL CHECK (kind IN ('bank','digital_wallet','card_issuer','broker','other')),
  bank_code        VARCHAR(3)   NULL CHECK (bank_code ~ '^[0-9]{3}$'),
  external_ref     VARCHAR(100) NULL,
  name_key         TEXT GENERATED ALWAYS AS (public.core_name_key(name)) STORED,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE UNIQUE INDEX institutions_catalog_name_uq ON public.institutions (name_key)
  WHERE owner_id IS NULL;
CREATE UNIQUE INDEX institutions_owner_name_uq ON public.institutions (owner_id, name_key)
  WHERE owner_id IS NOT NULL;
CREATE UNIQUE INDEX institutions_owner_extref_uq ON public.institutions (owner_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2.3 accounts
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  institution_id         UUID NOT NULL REFERENCES public.institutions(id),
  name                   VARCHAR(80)  NOT NULL CHECK (length(trim(name)) > 0),
  nickname               VARCHAR(40)  NULL,
  type                   VARCHAR(20)  NOT NULL CHECK (type IN
                           ('checking','digital_wallet','credit_card','savings','investment')),
  currency               CHAR(3)      NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  source                 VARCHAR(10)  NOT NULL CHECK (source IN ('pluggy','manual')),
  external_id            VARCHAR(100) NULL,
  last4                  CHAR(4)      NULL CHECK (last4 ~ '^[0-9]{4}$'),         -- FR-004
  credit_limit_cents     BIGINT       NULL CHECK (credit_limit_cents >= 0),
  closing_day            SMALLINT     NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day                SMALLINT     NULL CHECK (due_day BETWEEN 1 AND 31),
  opening_balance_cents  BIGINT       NOT NULL DEFAULT 0,
  opening_balance_on     DATE         NULL,
  reported_balance_cents BIGINT       NULL,                                      -- FR-010 (fonte)
  reported_balance_on    DATE         NULL,
  archived_at            TIMESTAMPTZ  NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  CONSTRAINT accounts_card_fields_check
    CHECK (type = 'credit_card' OR (credit_limit_cents IS NULL AND closing_day IS NULL AND due_day IS NULL)),
  CONSTRAINT accounts_reported_balance_check
    CHECK ((reported_balance_cents IS NULL) = (reported_balance_on IS NULL)),
  CONSTRAINT accounts_external_id_check CHECK (source = 'manual' OR external_id IS NOT NULL),
  -- saldo inicial só em conta manual (o saldo de conta conectada vem da fonte, R-09)
  CONSTRAINT accounts_opening_balance_check
    CHECK (source = 'manual' OR (opening_balance_cents = 0 AND opening_balance_on IS NULL))
);
CREATE UNIQUE INDEX accounts_source_external_uq ON public.accounts (owner_id, source, external_id)
  WHERE external_id IS NOT NULL;                                                  -- FR-012
CREATE INDEX accounts_owner_active_idx ON public.accounts (owner_id) WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------------------------
-- 2.4 import_batches
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.import_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source           VARCHAR(10) NOT NULL CHECK (source IN ('pluggy','csv','ofx','pdf','sheets','manual')),
  account_id       UUID NULL,                                 -- NULL = vários (ex.: item Pluggy)
  initiated_by     VARCHAR(10) NOT NULL CHECK (initiated_by IN ('user','schedule','webhook','system')),
  file_name        VARCHAR(255) NULL,
  file_sha256      CHAR(64)    NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  period_start     DATE NULL,
  period_end       DATE NULL,
  status           VARCHAR(12) NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','in_review','completed','failed','undone')),
  count_read       INTEGER NOT NULL DEFAULT 0 CHECK (count_read >= 0),
  count_created    INTEGER NOT NULL DEFAULT 0 CHECK (count_created >= 0),
  count_updated    INTEGER NOT NULL DEFAULT 0 CHECK (count_updated >= 0),
  count_restored   INTEGER NOT NULL DEFAULT 0 CHECK (count_restored >= 0),   -- D-C
  count_duplicate  INTEGER NOT NULL DEFAULT 0 CHECK (count_duplicate >= 0),
  count_protected  INTEGER NOT NULL DEFAULT 0 CHECK (count_protected >= 0),
  count_rejected   INTEGER NOT NULL DEFAULT 0 CHECK (count_rejected >= 0),
  fp_occurrences   JSONB   NOT NULL DEFAULT '{}'::jsonb,      -- {fp_base: k} (R-06)
  error_summary    VARCHAR(500) NULL,                         -- sem dados sensíveis
  started_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at      TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (account_id, owner_id) REFERENCES public.accounts (id, owner_id),
  CONSTRAINT import_batches_period_end_check
    CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);
CREATE INDEX import_batches_owner_started_idx ON public.import_batches (owner_id, started_at DESC, id DESC);
CREATE INDEX import_batches_file_idx ON public.import_batches (owner_id, account_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND status = 'completed';                         -- FR-034

-- ---------------------------------------------------------------------------------------------
-- 2.5 categories e category_templates
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.category_templates (            -- global, só leitura (seed gerado, R-12)
  key          VARCHAR(60) PRIMARY KEY,
  parent_key   VARCHAR(60) NULL REFERENCES public.category_templates(key),
  name         VARCHAR(60) NOT NULL,
  kind         VARCHAR(8)  NOT NULL CHECK (kind IN ('expense','income','neutral')),
  system_key   VARCHAR(30) NULL UNIQUE,
  sort_order   SMALLINT    NOT NULL
);

CREATE TABLE public.categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  parent_id        UUID NULL,
  name             VARCHAR(60) NOT NULL CHECK (length(trim(name)) > 0),
  name_key         TEXT GENERATED ALWAYS AS (public.core_name_key(name)) STORED,
  kind             VARCHAR(8)  NOT NULL CHECK (kind IN ('expense','income','neutral')),
  origin           VARCHAR(8)  NOT NULL CHECK (origin IN ('system','default','custom')),
  system_key       VARCHAR(30) NULL CHECK (system_key IN
                     ('uncategorized','internal_transfer','card_payment','salary','bank_fees')),
  template_key     VARCHAR(60) NULL,
  hidden           BOOLEAN     NOT NULL DEFAULT false,
  sort_order       SMALLINT    NOT NULL DEFAULT 0,
  deleted_at       TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (parent_id, owner_id) REFERENCES public.categories (id, owner_id),
  CONSTRAINT categories_parent_id_check CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT categories_system_key_state_check
    CHECK (system_key IS NULL OR (deleted_at IS NULL AND origin = 'system'))
);
CREATE UNIQUE INDEX categories_sibling_name_uq ON public.categories
  (owner_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key)
  WHERE deleted_at IS NULL;                                                        -- FR-032
CREATE UNIQUE INDEX categories_system_key_uq ON public.categories (owner_id, system_key)
  WHERE system_key IS NOT NULL;
CREATE UNIQUE INDEX categories_template_uq ON public.categories (owner_id, template_key)
  WHERE template_key IS NOT NULL;
CREATE INDEX categories_owner_parent_idx ON public.categories (owner_id, parent_id);

-- ---------------------------------------------------------------------------------------------
-- 2.6 transactions
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  account_id             UUID NOT NULL,
  batch_id               UUID NULL,
  source                 VARCHAR(10)  NOT NULL CHECK (source IN ('pluggy','csv','ofx','pdf','sheets','manual')),
  external_id            VARCHAR(140) NULL,
  identity_key           VARCHAR(160) NOT NULL,                       -- R-06
  amount_cents           BIGINT       NOT NULL,                       -- sinal: perspectiva da conta
  booked_on              DATE         NOT NULL CHECK (booked_on BETWEEN DATE '1900-01-01' AND DATE '2100-12-31'),
  occurred_at            TIMESTAMPTZ  NULL,
  description_original   VARCHAR(500) NOT NULL,
  description            VARCHAR(500) NULL,
  merchant               VARCHAR(200) NULL,
  status                 VARCHAR(8)   NOT NULL CHECK (status IN ('pending','posted')),
  nature                 VARCHAR(20)  NOT NULL DEFAULT 'regular'
                           CHECK (nature IN ('regular','internal_transfer','card_payment','refund')),
  related_transaction_id UUID NULL,
  category_id            UUID NULL,
  category_source        VARCHAR(6)   NULL CHECK (category_source IN ('manual','rule','ai','source')),
  category_confidence    SMALLINT     NULL CHECK (category_confidence BETWEEN 0 AND 100),
  notes                  VARCHAR(2000) NULL,
  installment_number     SMALLINT     NULL,
  installment_total      SMALLINT     NULL,
  installment_group      VARCHAR(100) NULL,
  original_amount_minor  BIGINT       NULL,
  original_currency      CHAR(3)      NULL CHECK (original_currency ~ '^[A-Z]{3}$' AND original_currency <> 'BRL'),
  locked_fields          TEXT[]       NOT NULL DEFAULT '{}',          -- R-07
  deleted_at             TIMESTAMPTZ  NULL,
  deleted_reason         VARCHAR(20)  NULL CHECK (deleted_reason IN
                           ('user','merged','batch_undone','canceled_at_source')),
  merged_into_id         UUID NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (account_id, owner_id)  REFERENCES public.accounts (id, owner_id),
  FOREIGN KEY (batch_id, owner_id)    REFERENCES public.import_batches (id, owner_id),
  FOREIGN KEY (category_id, owner_id) REFERENCES public.categories (id, owner_id),
  FOREIGN KEY (related_transaction_id, owner_id) REFERENCES public.transactions (id, owner_id),
  FOREIGN KEY (merged_into_id, owner_id)         REFERENCES public.transactions (id, owner_id),
  CONSTRAINT tx_identity_uq UNIQUE (account_id, source, identity_key),        -- FR-021 (inclui excluídas)
  CONSTRAINT transactions_batch_id_check CHECK (source = 'manual' OR batch_id IS NOT NULL), -- FR-014
  CONSTRAINT transactions_installment_check CHECK (
    (installment_number IS NULL) = (installment_total IS NULL)
    AND (installment_total IS NULL OR (installment_total BETWEEN 1 AND 420
         AND installment_number BETWEEN 1 AND installment_total))),            -- FR-018
  CONSTRAINT transactions_original_check
    CHECK ((original_amount_minor IS NULL) = (original_currency IS NULL)),
  CONSTRAINT transactions_deleted_at_check
    CHECK ((deleted_at IS NULL) = (deleted_reason IS NULL)),
  CONSTRAINT transactions_merged_into_id_check CHECK (
    (merged_into_id IS NOT NULL) = (deleted_reason IS NOT DISTINCT FROM 'merged')
    AND (merged_into_id IS NULL OR merged_into_id <> id)),
  CONSTRAINT transactions_related_transaction_id_check
    CHECK (related_transaction_id IS NULL OR related_transaction_id <> id),
  CONSTRAINT transactions_category_check CHECK (
    ((category_id IS NULL) = (category_source IS NULL))
    AND (category_source IS DISTINCT FROM 'manual' OR category_confidence IS NULL)),
  CONSTRAINT transactions_locked_fields_check CHECK (locked_fields <@ ARRAY['description','merchant',
    'category_id','nature','related_transaction_id','notes','amount_cents','booked_on','status']::TEXT[]),
  CONSTRAINT transactions_identity_key_check CHECK (
    identity_key ~ '^(ext:.+|fp:[0-9a-f]{64}|man:[0-9a-f-]{36})$'
    AND (external_id IS NOT NULL) = (identity_key LIKE 'ext:%')
    AND (external_id IS NULL OR identity_key = 'ext:' || external_id)       -- coerência ext: (H3)
    AND (source = 'manual') = (identity_key LIKE 'man:%'))
);

-- Extrato (FR-042, SC-007): dono + data desc, desempate por id; só ativas.
CREATE INDEX tx_owner_date_idx   ON public.transactions (owner_id, booked_on DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX tx_account_date_idx ON public.transactions (account_id, booked_on DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX tx_batch_idx        ON public.transactions (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX tx_category_idx     ON public.transactions (owner_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX tx_installment_idx  ON public.transactions (owner_id, installment_group)
  WHERE installment_group IS NOT NULL;
CREATE INDEX tx_related_idx      ON public.transactions (related_transaction_id)
  WHERE related_transaction_id IS NOT NULL;
CREATE INDEX tx_deleted_idx      ON public.transactions (owner_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- Triggers de manutenção e guardas (data-model §2.3–§2.6)
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION public.core_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER institutions_touch BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.core_touch_updated_at();
CREATE TRIGGER accounts_touch BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.core_touch_updated_at();
CREATE TRIGGER import_batches_touch BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.core_touch_updated_at();
CREATE TRIGGER categories_touch BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.core_touch_updated_at();
CREATE TRIGGER transactions_touch BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.core_touch_updated_at();

-- Lote: máquina de estados (data-model §2.4).
CREATE FUNCTION public.core_import_batches_state_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'processing' THEN RAISE EXCEPTION 'core.validation:status'; END IF;
    IF NEW.count_read <> 0 OR NEW.count_created <> 0 OR NEW.count_updated <> 0
       OR NEW.count_restored <> 0 OR NEW.count_duplicate <> 0 OR NEW.count_protected <> 0
       OR NEW.count_rejected <> 0 OR NEW.fp_occurrences <> '{}'::jsonb THEN
      RAISE EXCEPTION 'core.validation:counts';
    END IF;
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.source <> OLD.source
     OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.started_at <> OLD.started_at THEN
    RAISE EXCEPTION 'core.forbidden:batch_state';
  END IF;
  IF OLD.status = 'undone'
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'core.forbidden:batch_state';
  END IF;

  IF NEW.status <> OLD.status THEN
    IF NOT (
      (OLD.status = 'processing' AND NEW.status IN ('in_review', 'completed', 'failed'))
      OR (OLD.status = 'in_review' AND NEW.status IN ('processing', 'failed'))
      OR (OLD.status IN ('completed', 'failed') AND NEW.status = 'undone')
    ) THEN
      RAISE EXCEPTION 'core.forbidden:batch_state';
    END IF;
    IF NEW.status IN ('completed', 'failed') THEN
      NEW.finished_at := clock_timestamp();
    ELSIF NEW.status IN ('processing', 'in_review') THEN
      NEW.finished_at := NULL;
    END IF;
  ELSIF OLD.status <> 'processing'
     AND (NEW.fp_occurrences IS DISTINCT FROM OLD.fp_occurrences
          OR NEW.count_read <> OLD.count_read OR NEW.count_created <> OLD.count_created) THEN
    RAISE EXCEPTION 'core.forbidden:batch_closed';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER import_batches_state_guard BEFORE INSERT OR UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.core_import_batches_state_guard();

-- Conta: instituição do catálogo ou do dono; partição de campos dono × fonte (§2.3, FR-024).
CREATE FUNCTION public.core_accounts_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_user BOOLEAN := (public.core_current_actor()->>'type') = 'user';
BEGIN
  IF TG_OP = 'INSERT' OR NEW.institution_id <> OLD.institution_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = NEW.institution_id
                   AND (i.owner_id IS NULL OR i.owner_id = NEW.owner_id)) THEN
      RAISE EXCEPTION 'core.not_found:institutionId' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;

  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.source <> OLD.source
     OR NEW.external_id IS DISTINCT FROM OLD.external_id OR NEW.currency <> OLD.currency
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'core.forbidden:source_field';
  END IF;

  IF v_user THEN
    IF OLD.source = 'pluggy' AND (NEW.name <> OLD.name OR NEW.type <> OLD.type
       OR NEW.institution_id <> OLD.institution_id OR NEW.last4 IS DISTINCT FROM OLD.last4
       OR NEW.credit_limit_cents IS DISTINCT FROM OLD.credit_limit_cents
       OR NEW.reported_balance_cents IS DISTINCT FROM OLD.reported_balance_cents
       OR NEW.reported_balance_on IS DISTINCT FROM OLD.reported_balance_on) THEN
      RAISE EXCEPTION 'core.forbidden:source_field';
    END IF;
  ELSE
    -- Atores automáticos nunca gravam campos do dono (valor antigo mantido, sem erro).
    NEW.nickname := OLD.nickname;
    NEW.closing_day := OLD.closing_day;
    NEW.due_day := OLD.due_day;
    NEW.opening_balance_cents := OLD.opening_balance_cents;
    NEW.opening_balance_on := OLD.opening_balance_on;
    NEW.archived_at := OLD.archived_at;
    IF OLD.source = 'manual' THEN                -- em conta manual, só o saldo informado
      NEW.name := OLD.name;
      NEW.type := OLD.type;
      NEW.institution_id := OLD.institution_id;
      NEW.last4 := OLD.last4;
      NEW.credit_limit_cents := OLD.credit_limit_cents;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER accounts_guard BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.core_accounts_guard();

-- Categoria: 2 níveis, herança de tipo, sistema protegida (§2.5, FR-027–FR-030).
CREATE FUNCTION public.core_categories_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_parent RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.origin <> OLD.origin
       OR NEW.system_key IS DISTINCT FROM OLD.system_key
       OR NEW.template_key IS DISTINCT FROM OLD.template_key OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'core.forbidden:system_category';
    END IF;
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL
       AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
      RAISE EXCEPTION 'core.forbidden:deleted';
    END IF;
    IF OLD.system_key IS NOT NULL
       AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'core.forbidden:system_category';
    END IF;
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.parent_id = NEW.id AND c.owner_id = NEW.owner_id AND c.system_key IS NOT NULL) THEN
      RAISE EXCEPTION 'core.forbidden:system_child';
    END IF;
  END IF;

  IF NEW.parent_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    SELECT c.parent_id, c.kind, c.deleted_at, c.system_key INTO v_parent
      FROM public.categories c WHERE c.id = NEW.parent_id AND c.owner_id = NEW.owner_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'core.not_found:parentId' USING ERRCODE = 'P0002';
    END IF;
    IF v_parent.deleted_at IS NOT NULL OR v_parent.system_key = 'uncategorized' THEN
      RAISE EXCEPTION 'core.validation:parentId';
    END IF;
    IF v_parent.parent_id IS NOT NULL THEN RAISE EXCEPTION 'core.forbidden:depth'; END IF;
    IF (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.parent_id = NEW.id AND c.owner_id = NEW.owner_id AND c.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'core.forbidden:depth';
    END IF;
    NEW.kind := v_parent.kind;                                    -- FR-028: herda o tipo
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.system_key IS NOT NULL AND NEW.parent_id IS NULL
     AND NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'core.forbidden:system_category';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER categories_guard BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.core_categories_guard();

-- Mudança de tipo do pai propaga aos filhos ativos (FR-028).
CREATE FUNCTION public.core_categories_propagate_kind() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.parent_id IS NULL AND NEW.kind <> OLD.kind THEN
    UPDATE public.categories SET kind = NEW.kind
     WHERE parent_id = NEW.id AND owner_id = NEW.owner_id AND deleted_at IS NULL
       AND kind <> NEW.kind;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER categories_propagate_kind AFTER UPDATE OF kind ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.core_categories_propagate_kind();

-- Transação: regras de campo, travas e "sem categoria" (§2.6, R-07, R-08, FR-014–FR-026).
CREATE FUNCTION public.core_transactions_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_actor_type TEXT := public.core_current_actor()->>'type';
  v_user BOOLEAN := v_actor_type = 'user';
  v_feeder BOOLEAN := v_actor_type IN ('sync', 'import');
  v_action TEXT := COALESCE(current_setting('prumo.action', true), '');
  v_force_unlink BOOLEAN := COALESCE(current_setting('prumo.force_unlink', true), '') = 'on';
  v_manual BOOLEAN := NEW.source = 'manual';
  v_new JSONB;
  v_old JSONB;
  v_locked TEXT[];
  v_field TEXT;
  v_status TEXT;
  v_source TEXT;
  v_archived TIMESTAMPTZ;
  v_sys UUID;
  v_facts CONSTANT TEXT[] := ARRAY['amount_cents','booked_on','description_original','occurred_at',
    'account_id','installment_number','installment_total','installment_group',
    'original_amount_minor','original_currency','status'];
  v_lockable CONSTANT TEXT[] := ARRAY['description','merchant','category_id','nature',
    'related_transaction_id','notes','amount_cents','booked_on','status'];
BEGIN
  -- "Sem categoria" tem representação única: category_id NULL.
  IF NEW.category_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.categories c WHERE c.id = NEW.category_id AND c.owner_id = NEW.owner_id
      AND c.system_key = 'uncategorized') THEN
    NEW.category_id := NULL;
    NEW.category_source := NULL;
    NEW.category_confidence := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT a.archived_at INTO v_archived FROM public.accounts a
     WHERE a.id = NEW.account_id AND a.owner_id = NEW.owner_id;
    IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'core.validation:accountId'; END IF;
    IF NEW.batch_id IS NOT NULL THEN
      SELECT b.status, b.source INTO v_status, v_source FROM public.import_batches b
       WHERE b.id = NEW.batch_id AND b.owner_id = NEW.owner_id;
      IF FOUND THEN
        IF v_source <> NEW.source THEN RAISE EXCEPTION 'core.validation:batchId'; END IF;
        IF v_status <> 'processing' THEN RAISE EXCEPTION 'core.forbidden:batch_closed'; END IF;
      END IF;
    END IF;
    IF NEW.deleted_at IS NOT NULL OR NEW.deleted_reason IS NOT NULL OR NEW.merged_into_id IS NOT NULL THEN
      RAISE EXCEPTION 'core.validation:deletedAt';
    END IF;
    IF NOT v_manual THEN NEW.locked_fields := '{}'; END IF;
    IF NEW.category_source = 'manual' THEN
      NEW.category_confidence := NULL;
      IF NOT ('category_id' = ANY (NEW.locked_fields)) THEN
        NEW.locked_fields := NEW.locked_fields || 'category_id'::TEXT;
      END IF;
    END IF;
  ELSE
    -- Imutáveis para qualquer ator.
    IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.source <> OLD.source
       OR NEW.external_id IS DISTINCT FROM OLD.external_id OR NEW.identity_key <> OLD.identity_key
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'core.forbidden:imported_fact';
    END IF;

    -- Excluída: só restaurar (sem alterar mais nada).
    IF OLD.deleted_at IS NOT NULL THEN
      IF NEW.deleted_at IS NULL THEN
        IF OLD.deleted_reason = 'merged' AND EXISTS (
          SELECT 1 FROM public.transactions t WHERE t.id = OLD.merged_into_id
            AND t.owner_id = OLD.owner_id AND t.deleted_at IS NOT NULL) THEN
          RAISE EXCEPTION 'core.forbidden:merged_survivor_deleted';
        END IF;
        NEW.deleted_reason := NULL;
        NEW.merged_into_id := NULL;
      END IF;
      IF (to_jsonb(NEW) - ARRAY['deleted_at','deleted_reason','merged_into_id','updated_at'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['deleted_at','deleted_reason','merged_into_id','updated_at'])
         OR (NEW.deleted_at IS NOT NULL AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
             OR NEW.deleted_reason IS DISTINCT FROM OLD.deleted_reason
             OR NEW.merged_into_id IS DISTINCT FROM OLD.merged_into_id)) THEN
        RAISE EXCEPTION 'core.forbidden:deleted';
      END IF;
      RETURN NEW;
    END IF;

    -- Exclusão lógica: só os campos de exclusão mudam.
    IF NEW.deleted_at IS NOT NULL THEN
      IF (to_jsonb(NEW) - ARRAY['deleted_at','deleted_reason','merged_into_id','updated_at'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['deleted_at','deleted_reason','merged_into_id','updated_at']) THEN
        RAISE EXCEPTION 'core.forbidden:deleted';
      END IF;
      RETURN NEW;
    END IF;

    IF OLD.status = 'posted' AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'core.forbidden:status_regression';
    END IF;

    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_locked := OLD.locked_fields;

    -- Travas só mudam por ação do usuário ou por "voltar ao automático" (FR-025).
    IF NEW.locked_fields IS DISTINCT FROM OLD.locked_fields AND (v_user OR v_action = 'unlock') THEN
      v_locked := NEW.locked_fields;
    END IF;

    -- Fatos (FR-020, R-08).
    FOREACH v_field IN ARRAY v_facts LOOP
      CONTINUE WHEN (v_new->v_field) IS NOT DISTINCT FROM (v_old->v_field);
      IF v_manual THEN
        IF v_field = 'description_original' OR NOT v_user THEN
          IF v_user THEN RAISE EXCEPTION 'core.forbidden:imported_fact'; END IF;
          v_new := jsonb_set(v_new, ARRAY[v_field], v_old->v_field);
        END IF;
      ELSIF v_feeder AND (
          (OLD.status = 'pending'
           AND v_field IN ('amount_cents','booked_on','description_original','occurred_at','status'))
          OR (v_field = 'occurred_at' AND OLD.occurred_at IS NULL)) THEN
        NULL; -- a própria fonte atualiza a pendente (US7, R-08)
      ELSIF v_user THEN
        RAISE EXCEPTION 'core.forbidden:imported_fact';
      ELSE
        v_new := jsonb_set(v_new, ARRAY[v_field], v_old->v_field);
      END IF;
    END LOOP;

    -- Campos traváveis (R-07).
    FOREACH v_field IN ARRAY v_lockable LOOP
      CONTINUE WHEN (v_new->v_field) IS NOT DISTINCT FROM (v_old->v_field);
      IF v_field = 'category_id' AND v_action = 'reassign' THEN
        CONTINUE;                                       -- reatribuição por exclusão de categoria
      ELSIF v_field = 'related_transaction_id' AND v_force_unlink THEN
        CONTINUE;                                       -- contrapartida excluída: vínculo desfeito
      ELSIF v_user THEN
        IF NOT (v_field = ANY (v_locked)) THEN v_locked := v_locked || v_field; END IF;
      ELSIF v_field = ANY (v_locked) THEN
        v_new := jsonb_set(v_new, ARRAY[v_field], v_old->v_field);
        IF v_field = 'category_id' THEN
          v_new := jsonb_set(v_new, '{category_source}', v_old->'category_source');
          v_new := jsonb_set(v_new, '{category_confidence}', v_old->'category_confidence');
        END IF;
      END IF;
    END LOOP;
    v_new := jsonb_set(v_new, '{locked_fields}', to_jsonb(v_locked));
    NEW := jsonb_populate_record(NEW, v_new);

    -- Categoria manual: origem manual e sem confiança (FR-026).
    IF v_user AND v_action <> 'reassign' AND NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      NEW.category_source := CASE WHEN NEW.category_id IS NULL THEN NULL ELSE 'manual' END;
      NEW.category_confidence := NULL;
    ELSIF NEW.category_id IS NULL THEN
      NEW.category_source := NULL;
      NEW.category_confidence := NULL;
    END IF;

    IF NEW.account_id <> OLD.account_id THEN
      SELECT a.archived_at INTO v_archived FROM public.accounts a
       WHERE a.id = NEW.account_id AND a.owner_id = NEW.owner_id;
      IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'core.validation:accountId'; END IF;
    END IF;
  END IF;

  -- Vínculo só com transação ativa do mesmo dono (a FK composta garante o dono).
  IF NEW.related_transaction_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.related_transaction_id IS DISTINCT FROM OLD.related_transaction_id)
     AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = NEW.related_transaction_id
                   AND t.owner_id = NEW.owner_id AND t.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'core.validation:relatedTransactionId';
  END IF;

  -- Natureza transferência/pagamento de fatura ⇒ categoria de sistema correspondente, salvo
  -- categoria manual ou travada.
  IF NEW.nature IN ('internal_transfer', 'card_payment')
     AND NEW.category_source IS DISTINCT FROM 'manual'
     AND NOT ('category_id' = ANY (NEW.locked_fields)) THEN
    SELECT c.id INTO v_sys FROM public.categories c
     WHERE c.owner_id = NEW.owner_id AND c.system_key = NEW.nature;
    IF v_sys IS NOT NULL AND NEW.category_id IS DISTINCT FROM v_sys THEN
      NEW.category_id := v_sys;
      NEW.category_source := 'rule';
      NEW.category_confidence := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER transactions_guard BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.core_transactions_guard();
