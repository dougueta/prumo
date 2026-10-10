-- Feature 004 · modelo-dados-core (dona). data-model §2.7 (auditoria) e §2.8 (sem DELETE físico).

CREATE TABLE public.audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  entity_type   VARCHAR(20) NOT NULL CHECK (entity_type IN
                  ('institution','account','transaction','category','import_batch')),
  entity_id     UUID NOT NULL,
  action        VARCHAR(16) NOT NULL CHECK (action IN
                  ('create','update','soft_delete','restore','merge','archive','unarchive',
                   'undo_batch','reassign','lock','unlock')),
  actor_type    VARCHAR(8)  NOT NULL CHECK (actor_type IN ('user','sync','import','ai','rule','system')),
  actor_ref     VARCHAR(100) NULL,
  batch_id      UUID NULL,
  reason        VARCHAR(30) NULL,
  changes       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {campo: {"old": v, "new": v}}
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON public.audit_log (owner_id, entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_batch_idx  ON public.audit_log (batch_id) WHERE batch_id IS NOT NULL;

-- Gravação atômica (mesma transação) de toda criação/alteração (FR-039, FR-040). SECURITY
-- DEFINER: só este trigger insere em audit_log (nenhum papel da API tem INSERT).
CREATE FUNCTION public.core_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor  JSONB := public.core_current_actor();
  v_skip   CONSTANT TEXT[] := ARRAY['updated_at','name_key','fp_occurrences','created_at'];
  v_new    JSONB := to_jsonb(NEW) - v_skip;
  v_old    JSONB;
  v_changes JSONB;
  v_action TEXT;
  v_hint   TEXT := NULLIF(current_setting('prumo.action', true), '');
  v_reason TEXT := NULLIF(current_setting('prumo.reason', true), '');
  v_entity TEXT := CASE TG_TABLE_NAME
    WHEN 'institutions' THEN 'institution' WHEN 'accounts' THEN 'account'
    WHEN 'transactions' THEN 'transaction' WHEN 'categories' THEN 'category'
    WHEN 'import_batches' THEN 'import_batch' END;
BEGIN
  IF (v_new->>'owner_id') IS NULL THEN RETURN NULL; END IF;     -- catálogo não é dado pessoal

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(jsonb_object_agg(key, jsonb_build_object('old', NULL, 'new', value)), '{}'::jsonb)
      INTO v_changes
      FROM jsonb_each(v_new - ARRAY['id','owner_id'])
     WHERE value <> 'null'::jsonb;
    v_action := 'create';
  ELSE
    v_old := to_jsonb(OLD) - v_skip;
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      INTO v_changes
      FROM jsonb_each(v_new) n JOIN jsonb_each(v_old) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value;
    IF v_changes = '{}'::jsonb THEN RETURN NULL; END IF;         -- nada mudou: nada a auditar

    v_action := CASE
      WHEN v_changes ? 'deleted_at' AND (v_old->'deleted_at') = 'null'::jsonb THEN
        CASE WHEN v_new->>'deleted_reason' = 'merged' THEN 'merge' ELSE 'soft_delete' END
      WHEN v_changes ? 'deleted_at' THEN 'restore'
      WHEN v_changes ? 'archived_at' AND (v_old->'archived_at') = 'null'::jsonb THEN 'archive'
      WHEN v_changes ? 'archived_at' THEN 'unarchive'
      WHEN TG_TABLE_NAME = 'import_batches' AND v_new->>'status' = 'undone' THEN 'undo_batch'
      WHEN v_hint IN ('reassign', 'unlock', 'lock') THEN v_hint
      ELSE 'update' END;

    IF v_reason IS NULL AND v_action IN ('soft_delete', 'merge') THEN
      v_reason := CASE WHEN TG_TABLE_NAME = 'transactions' THEN v_new->>'deleted_reason' ELSE 'user' END;
    END IF;
  END IF;

  INSERT INTO public.audit_log (owner_id, entity_type, entity_id, action, actor_type, actor_ref,
                                batch_id, reason, changes)
  VALUES ((v_new->>'owner_id')::uuid, v_entity, (v_new->>'id')::uuid, v_action,
          v_actor->>'type', left(v_actor->>'ref', 100), (v_actor->>'batchId')::uuid,
          left(v_reason, 30), v_changes);
  RETURN NULL;
END $$;

CREATE TRIGGER institutions_audit AFTER INSERT OR UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.core_audit();
CREATE TRIGGER accounts_audit AFTER INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.core_audit();
CREATE TRIGGER transactions_audit AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.core_audit();
CREATE TRIGGER categories_audit AFTER INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.core_audit();
CREATE TRIGGER import_batches_audit AFTER INSERT OR UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.core_audit();

-- Somente-acréscimo para qualquer papel (FR-040).
CREATE FUNCTION public.core_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'core.audit_immutable'; END $$;

CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.core_audit_immutable();
CREATE TRIGGER audit_log_immutable_truncate BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_audit_immutable();

-- Nada é apagado fisicamente (FR-036, FR-037).
CREATE FUNCTION public.core_forbid_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'core.hard_delete_forbidden'; END $$;

CREATE FUNCTION public.core_forbid_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'core.hard_delete_forbidden'; END $$;

CREATE TRIGGER institutions_forbid_delete BEFORE DELETE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();
CREATE TRIGGER accounts_forbid_delete BEFORE DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();
CREATE TRIGGER transactions_forbid_delete BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();
CREATE TRIGGER categories_forbid_delete BEFORE DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();
CREATE TRIGGER import_batches_forbid_delete BEFORE DELETE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();
CREATE TRIGGER category_templates_forbid_delete BEFORE DELETE ON public.category_templates
  FOR EACH ROW EXECUTE FUNCTION public.core_forbid_delete();

CREATE TRIGGER institutions_forbid_truncate BEFORE TRUNCATE ON public.institutions
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
CREATE TRIGGER accounts_forbid_truncate BEFORE TRUNCATE ON public.accounts
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
CREATE TRIGGER transactions_forbid_truncate BEFORE TRUNCATE ON public.transactions
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
CREATE TRIGGER categories_forbid_truncate BEFORE TRUNCATE ON public.categories
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
CREATE TRIGGER import_batches_forbid_truncate BEFORE TRUNCATE ON public.import_batches
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
CREATE TRIGGER category_templates_forbid_truncate BEFORE TRUNCATE ON public.category_templates
  FOR EACH STATEMENT EXECUTE FUNCTION public.core_forbid_truncate();
