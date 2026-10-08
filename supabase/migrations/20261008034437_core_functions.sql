-- Feature 004 · modelo-dados-core (dona). Funções do contrato core_* (data-model §5).
-- Todas SECURITY INVOKER: com JWT valem RLS e policies; com a chave secreta o dono vem de
-- p_owner_id (core_resolve_owner). Erros: RAISE 'core.<código>' (contracts/core-store.md §Erros).

-- ---------------------------------------------------------------------------------------------
-- Bootstrap da taxonomia padrão (FR-029) — idempotente.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_bootstrap_owner(p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, COALESCE(p_actor, '{"type":"system"}'::jsonb));
  v_top INT;
  v_sub INT;
BEGIN
  -- serializa bootstraps concorrentes do mesmo dono (ex.: tree() preguiçoso em paralelo)
  PERFORM pg_advisory_xact_lock(hashtextextended('core_bootstrap:' || v_owner::text, 0));

  INSERT INTO public.categories (owner_id, name, kind, origin, system_key, template_key, sort_order)
  SELECT v_owner, t.name, t.kind,
         CASE WHEN t.system_key IS NULL THEN 'default' ELSE 'system' END,
         t.system_key, t.key, t.sort_order
    FROM public.category_templates t
   WHERE t.parent_key IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.categories c
                      WHERE c.owner_id = v_owner AND c.template_key = t.key)
   ORDER BY t.sort_order;
  GET DIAGNOSTICS v_top = ROW_COUNT;

  INSERT INTO public.categories (owner_id, parent_id, name, kind, origin, system_key, template_key, sort_order)
  SELECT v_owner, p.id, t.name, p.kind,
         CASE WHEN t.system_key IS NULL THEN 'default' ELSE 'system' END,
         t.system_key, t.key, t.sort_order
    FROM public.category_templates t
    JOIN public.categories p ON p.owner_id = v_owner AND p.template_key = t.parent_key
                            AND p.deleted_at IS NULL
   WHERE t.parent_key IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categories c
                      WHERE c.owner_id = v_owner AND c.template_key = t.key)
   ORDER BY t.parent_key, t.sort_order;
  GET DIAGNOSTICS v_sub = ROW_COUNT;

  RETURN jsonb_build_object('created', v_top + v_sub);
END $$;

-- ---------------------------------------------------------------------------------------------
-- Instituições (FR-005, FR-006)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_create_institution(p JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.institutions;
BEGIN
  INSERT INTO public.institutions (owner_id, name, kind, bank_code, external_ref)
  VALUES (v_owner, p->>'name', p->>'kind', p->>'bank_code', p->>'external_ref')
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'name_key';
END $$;

CREATE FUNCTION public.core_update_institution(p_id UUID, p_patch JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.institutions;
BEGIN
  UPDATE public.institutions SET
    name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE name END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch->>'kind' ELSE kind END,
    bank_code = CASE WHEN p_patch ? 'bank_code' THEN p_patch->>'bank_code' ELSE bank_code END
  WHERE id = p_id AND owner_id = v_owner              -- catálogo (owner NULL) ⇒ not_found
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row) - 'name_key';
END $$;

-- ---------------------------------------------------------------------------------------------
-- Contas (FR-007–FR-012, FR-024 partição de campos no trigger accounts_guard)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_upsert_account(p JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.accounts;
BEGIN
  IF p->>'source' = 'pluggy' THEN
    SELECT * INTO v_row FROM public.accounts
     WHERE owner_id = v_owner AND source = 'pluggy' AND external_id = p->>'external_id'
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.accounts SET
        name = p->>'name',
        type = p->>'type',
        institution_id = (p->>'institution_id')::uuid,
        last4 = CASE WHEN p ? 'last4' THEN p->>'last4' ELSE last4 END,
        credit_limit_cents = CASE WHEN p ? 'credit_limit_cents' THEN (p->>'credit_limit_cents')::bigint ELSE credit_limit_cents END,
        nickname = CASE WHEN p ? 'nickname' THEN p->>'nickname' ELSE nickname END,
        closing_day = CASE WHEN p ? 'closing_day' THEN (p->>'closing_day')::smallint ELSE closing_day END,
        due_day = CASE WHEN p ? 'due_day' THEN (p->>'due_day')::smallint ELSE due_day END
      WHERE id = v_row.id
      RETURNING * INTO v_row;
      RETURN to_jsonb(v_row);
    END IF;
  END IF;
  INSERT INTO public.accounts (owner_id, institution_id, name, nickname, type, source, external_id,
                               last4, credit_limit_cents, closing_day, due_day,
                               opening_balance_cents, opening_balance_on)
  VALUES (v_owner, (p->>'institution_id')::uuid, p->>'name', p->>'nickname', p->>'type',
          p->>'source', p->>'external_id', p->>'last4', (p->>'credit_limit_cents')::bigint,
          (p->>'closing_day')::smallint, (p->>'due_day')::smallint,
          COALESCE((p->>'opening_balance_cents')::bigint, 0), (p->>'opening_balance_on')::date)
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.core_update_account(p_id UUID, p_patch JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.accounts;
BEGIN
  UPDATE public.accounts SET
    nickname = CASE WHEN p_patch ? 'nickname' THEN p_patch->>'nickname' ELSE nickname END,
    closing_day = CASE WHEN p_patch ? 'closing_day' THEN (p_patch->>'closing_day')::smallint ELSE closing_day END,
    due_day = CASE WHEN p_patch ? 'due_day' THEN (p_patch->>'due_day')::smallint ELSE due_day END,
    opening_balance_cents = CASE WHEN p_patch ? 'opening_balance_cents' THEN (p_patch->>'opening_balance_cents')::bigint ELSE opening_balance_cents END,
    opening_balance_on = CASE WHEN p_patch ? 'opening_balance_on' THEN (p_patch->>'opening_balance_on')::date ELSE opening_balance_on END,
    name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE name END,
    type = CASE WHEN p_patch ? 'type' THEN p_patch->>'type' ELSE type END,
    institution_id = CASE WHEN p_patch ? 'institution_id' THEN (p_patch->>'institution_id')::uuid ELSE institution_id END,
    last4 = CASE WHEN p_patch ? 'last4' THEN p_patch->>'last4' ELSE last4 END,
    credit_limit_cents = CASE WHEN p_patch ? 'credit_limit_cents' THEN (p_patch->>'credit_limit_cents')::bigint ELSE credit_limit_cents END
  WHERE id = p_id AND owner_id = v_owner
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.core_archive_account(p_id UUID, p_archived BOOLEAN, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.accounts;
BEGIN
  UPDATE public.accounts
     SET archived_at = CASE WHEN p_archived THEN COALESCE(archived_at, now()) ELSE NULL END
   WHERE id = p_id AND owner_id = v_owner
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.core_set_reported_balance(p_account_id UUID, p_cents BIGINT, p_on DATE, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.accounts;
BEGIN
  IF p_cents IS NULL OR p_on IS NULL THEN RAISE EXCEPTION 'core.validation:reportedBalanceCents'; END IF;
  UPDATE public.accounts SET reported_balance_cents = p_cents, reported_balance_on = p_on
   WHERE id = p_account_id AND owner_id = v_owner
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row);
END $$;

-- Saldo calculado × informado (R-09, FR-010).
CREATE FUNCTION public.core_account_balances(p_as_of DATE, p_owner_id UUID DEFAULT NULL)
RETURNS TABLE (account_id UUID, reported_cents BIGINT, reported_on DATE, computed_cents BIGINT,
               computed_at_reported_cents BIGINT, divergence_cents BIGINT)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_resolve_owner(p_owner_id);
BEGIN
  RETURN QUERY
  WITH calc AS (
    SELECT a.id, a.reported_balance_cents, a.reported_balance_on, a.created_at,
      a.opening_balance_cents + COALESCE((
        SELECT sum(t.amount_cents) FROM public.transactions t
         WHERE t.account_id = a.id AND t.owner_id = a.owner_id AND t.status = 'posted'
           AND t.deleted_at IS NULL AND t.booked_on <= p_as_of
           AND (a.opening_balance_on IS NULL OR t.booked_on >= a.opening_balance_on)), 0)::bigint AS computed,
      CASE WHEN a.reported_balance_on IS NULL THEN NULL ELSE
        a.opening_balance_cents + COALESCE((
          SELECT sum(t.amount_cents) FROM public.transactions t
           WHERE t.account_id = a.id AND t.owner_id = a.owner_id AND t.status = 'posted'
             AND t.deleted_at IS NULL AND t.booked_on <= a.reported_balance_on
             AND (a.opening_balance_on IS NULL OR t.booked_on >= a.opening_balance_on)), 0)::bigint
      END AS at_reported
    FROM public.accounts a WHERE a.owner_id = v_owner
  )
  SELECT c.id, c.reported_balance_cents, c.reported_balance_on, c.computed, c.at_reported,
         (c.reported_balance_cents - c.at_reported)::bigint
    FROM calc c ORDER BY c.created_at, c.id;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Lotes de importação (FR-033–FR-035)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_create_batch(p JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.import_batches;
BEGIN
  INSERT INTO public.import_batches (owner_id, source, account_id, initiated_by, file_name,
                                     file_sha256, period_start, period_end)
  VALUES (v_owner, p->>'source', (p->>'account_id')::uuid, p->>'initiated_by', p->>'file_name',
          p->>'file_sha256', (p->>'period_start')::date, (p->>'period_end')::date)
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'fp_occurrences';
END $$;

CREATE FUNCTION public.core_finish_batch(p_id UUID, p_status TEXT, p_error TEXT DEFAULT NULL, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.import_batches;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('in_review', 'completed', 'failed') THEN
    RAISE EXCEPTION 'core.validation:status';
  END IF;
  SELECT * INTO v_row FROM public.import_batches WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT ((v_row.status = 'processing') OR (v_row.status = 'in_review' AND p_status = 'failed')) THEN
    RAISE EXCEPTION 'core.forbidden:batch_state';
  END IF;
  UPDATE public.import_batches
     SET status = p_status, error_summary = COALESCE(left(p_error, 500), error_summary)
   WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'fp_occurrences';
END $$;

CREATE FUNCTION public.core_resume_batch(p_id UUID, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.import_batches;
BEGIN
  SELECT * INTO v_row FROM public.import_batches WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.status <> 'in_review' THEN RAISE EXCEPTION 'core.forbidden:batch_state'; END IF;
  UPDATE public.import_batches SET status = 'processing' WHERE id = p_id RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'fp_occurrences';
END $$;

CREATE FUNCTION public.core_find_completed_batch_by_file(p_account_id UUID, p_sha256 TEXT, p_owner_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_resolve_owner(p_owner_id);
  v_row public.import_batches;
BEGIN
  SELECT * INTO v_row FROM public.import_batches
   WHERE owner_id = v_owner AND account_id = p_account_id AND file_sha256 = p_sha256
     AND status = 'completed'
   ORDER BY started_at DESC, id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_row) - 'fp_occurrences';
END $$;

-- Algoritmo do data-model §5: por linha, em ordem, numa única transação (FR-013–FR-024, FR-035).
-- Linhas já recusadas pela validação do repositório chegam como {"rejected": {code, field}}.
CREATE FUNCTION public.core_upsert_transactions(p_batch_id UUID, p_rows JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_batch public.import_batches;
  v_old public.transactions;
  v_occ JSONB;
  v_row JSONB;
  v_idx INT;
  v_key TEXT;
  v_k INT;
  v_id UUID;
  v_account UUID;
  v_cat UUID;
  v_cat_source TEXT;
  v_cat_conf INT;
  v_outcome TEXT;
  v_protected TEXT[];
  v_results JSONB := '[]'::jsonb;
  v_state TEXT;
  v_msg TEXT;
  v_constraint TEXT;
  v_code TEXT;
  v_field TEXT;
  c_created INT := 0;
  c_updated INT := 0;
  c_restored INT := 0;
  c_duplicate INT := 0;
  c_protected INT := 0;
  c_rejected INT := 0;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) > 1000 THEN
    RAISE EXCEPTION 'core.validation:rows';
  END IF;
  -- FOR UPDATE serializa chamadas concorrentes no mesmo lote (contador de ocorrências).
  SELECT * INTO v_batch FROM public.import_batches
   WHERE id = p_batch_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found:batchId' USING ERRCODE = 'P0002'; END IF;
  IF v_batch.status <> 'processing' OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_rows) r
        WHERE r.value ? 'source' AND r.value->>'source' <> v_batch.source) THEN
    RAISE EXCEPTION 'core.forbidden:batch_closed';
  END IF;
  -- auditoria de tudo o que esta chamada gravar aponta para o lote
  PERFORM set_config('prumo.actor',
    (current_setting('prumo.actor')::jsonb || jsonb_build_object('batchId', p_batch_id))::text, true);
  v_occ := v_batch.fp_occurrences;

  FOR v_row, v_idx IN
    SELECT e.value, (e.ordinality - 1)::int FROM jsonb_array_elements(p_rows) WITH ORDINALITY e
  LOOP
    IF v_row ? 'rejected' THEN
      c_rejected := c_rejected + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'index', v_idx, 'outcome', 'rejected', 'error', v_row->'rejected'));
      CONTINUE;
    END IF;

    BEGIN
      v_protected := '{}';
      v_id := NULL;
      v_k := NULL;
      IF (v_row ? 'external_id') = (v_row ? 'fp_base') THEN
        RAISE EXCEPTION 'core.validation:externalId';
      END IF;
      IF v_row ? 'external_id' THEN
        v_key := 'ext:' || (v_row->>'external_id');
      ELSE
        IF (v_row->>'fp_base') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'core.validation:fpBase'; END IF;
        v_k := COALESCE((v_occ->>(v_row->>'fp_base'))::int, 0) + 1;
        v_key := public.core_fp_identity(v_row->>'fp_base', v_k);
      END IF;
      v_account := (v_row->>'account_id')::uuid;
      -- a conta precisa ser do dono antes de procurar a identidade (nunca tocar linha alheia)
      IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_account AND owner_id = v_owner) THEN
        RAISE EXCEPTION 'core.not_found:accountId' USING ERRCODE = 'P0002';
      END IF;
      v_cat := (v_row->>'category_id')::uuid;
      v_cat_source := CASE WHEN v_cat IS NULL THEN NULL ELSE COALESCE(v_row->>'category_source', 'source') END;
      v_cat_conf := CASE WHEN v_cat IS NULL THEN NULL ELSE (v_row->>'category_confidence')::int END;

      INSERT INTO public.transactions (
        owner_id, account_id, batch_id, source, external_id, identity_key, amount_cents, booked_on,
        occurred_at, description_original, merchant, status, nature, category_id, category_source,
        category_confidence, installment_number, installment_total, installment_group,
        original_amount_minor, original_currency)
      VALUES (
        v_owner, v_account, p_batch_id, v_batch.source, v_row->>'external_id', v_key,
        (v_row->>'amount_cents')::bigint, (v_row->>'booked_on')::date,
        (v_row->>'occurred_at')::timestamptz, v_row->>'description_original', v_row->>'merchant',
        v_row->>'status', COALESCE(v_row->>'nature', 'regular'), v_cat, v_cat_source, v_cat_conf,
        (v_row->>'installment_number')::smallint, (v_row->>'installment_total')::smallint,
        v_row->>'installment_group', (v_row->>'original_amount_minor')::bigint,
        v_row->>'original_currency')
      ON CONFLICT ON CONSTRAINT tx_identity_uq DO NOTHING
      RETURNING id INTO v_id;

      IF v_id IS NOT NULL THEN
        v_outcome := 'created';
        c_created := c_created + 1;
      ELSE
        SELECT * INTO v_old FROM public.transactions
         WHERE owner_id = v_owner AND account_id = v_account AND source = v_batch.source
           AND identity_key = v_key
         FOR UPDATE;
        v_id := v_old.id;

        -- campos travados que a fonte tentou mudar (contados em `protected`, não exclusivo)
        IF v_row ? 'merchant' AND 'merchant' = ANY (v_old.locked_fields)
           AND (v_row->>'merchant') IS DISTINCT FROM v_old.merchant THEN
          v_protected := v_protected || 'merchant'::text;
        END IF;
        IF v_cat IS NOT NULL AND 'category_id' = ANY (v_old.locked_fields)
           AND v_cat IS DISTINCT FROM v_old.category_id THEN
          v_protected := v_protected || 'category_id'::text;
        END IF;
        IF v_row ? 'nature' AND 'nature' = ANY (v_old.locked_fields)
           AND (v_row->>'nature') IS DISTINCT FROM v_old.nature THEN
          v_protected := v_protected || 'nature'::text;
        END IF;

        IF v_old.deleted_at IS NOT NULL THEN
          IF v_old.deleted_reason = 'batch_undone' THEN         -- D-C: restaura por linha
            PERFORM set_config('prumo.reason', 'reimport', true);
            UPDATE public.transactions SET deleted_at = NULL, deleted_reason = NULL WHERE id = v_id;
            PERFORM set_config('prumo.reason', '', true);
            v_outcome := 'restored';
            c_restored := c_restored + 1;
          ELSE                                                  -- excluída por outro motivo
            v_outcome := 'duplicate';
            c_duplicate := c_duplicate + 1;
          END IF;
        ELSIF v_old.status = 'pending' AND (
             (v_row->>'amount_cents')::bigint <> v_old.amount_cents
             OR (v_row->>'booked_on')::date <> v_old.booked_on
             OR (v_row->>'description_original') <> v_old.description_original
             OR (v_row->>'status') <> v_old.status
             OR (v_row ? 'occurred_at'
                 AND (v_row->>'occurred_at')::timestamptz IS DISTINCT FROM v_old.occurred_at)) THEN
          -- pendente atualizada pela fonte (US7, R-08); o trigger aplica as travas
          UPDATE public.transactions SET
            amount_cents = (v_row->>'amount_cents')::bigint,
            booked_on = (v_row->>'booked_on')::date,
            description_original = v_row->>'description_original',
            status = v_row->>'status',
            occurred_at = COALESCE((v_row->>'occurred_at')::timestamptz, occurred_at),
            merchant = CASE WHEN v_row ? 'merchant' THEN v_row->>'merchant' ELSE merchant END,
            nature = CASE WHEN v_row ? 'nature' THEN v_row->>'nature' ELSE nature END,
            category_id = CASE WHEN v_cat IS NULL THEN category_id ELSE v_cat END,
            category_source = CASE WHEN v_cat IS NULL THEN category_source ELSE v_cat_source END,
            category_confidence = CASE WHEN v_cat IS NULL THEN category_confidence ELSE v_cat_conf END
          WHERE id = v_id;
          v_outcome := 'updated';
          c_updated := c_updated + 1;
        ELSE
          -- efetivada (ou pendente sem diferença): só completa campos automáticos vazios
          UPDATE public.transactions SET
            merchant = COALESCE(merchant, v_row->>'merchant'),
            occurred_at = COALESCE(occurred_at, (v_row->>'occurred_at')::timestamptz)
          WHERE id = v_id
            AND ((merchant IS NULL AND v_row ? 'merchant')
                 OR (occurred_at IS NULL AND v_row ? 'occurred_at'));
          v_outcome := 'duplicate';
          c_duplicate := c_duplicate + 1;
        END IF;
        IF cardinality(v_protected) > 0 THEN c_protected := c_protected + 1; END IF;
      END IF;

      IF v_k IS NOT NULL THEN
        v_occ := jsonb_set(v_occ, ARRAY[v_row->>'fp_base'], to_jsonb(v_k));
      END IF;
      v_results := v_results || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'index', v_idx, 'outcome', v_outcome, 'id', v_id,
        'protected_fields', CASE WHEN cardinality(v_protected) > 0 THEN to_jsonb(v_protected) END)));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT,
                              v_constraint = CONSTRAINT_NAME;
      IF v_msg LIKE 'core.validation:%' THEN
        v_code := 'validation';
        v_field := split_part(v_msg, ':', 2);
      ELSIF v_msg LIKE 'core.not_found%' OR v_state = '23503' THEN
        v_code := 'not_found';
        v_field := CASE
          WHEN v_msg LIKE 'core.not_found:%' THEN split_part(v_msg, ':', 2)
          WHEN v_constraint LIKE '%account_id%' THEN 'accountId'
          WHEN v_constraint LIKE '%category_id%' THEN 'categoryId'
          WHEN v_constraint LIKE '%related%' THEN 'relatedTransactionId' END;
      ELSIF v_state LIKE '22%' OR v_state LIKE '23%' THEN
        v_code := 'validation';
        v_field := CASE
          WHEN v_constraint LIKE '%installment%' THEN 'installment'
          WHEN v_constraint LIKE '%original%' THEN 'original'
          WHEN v_constraint LIKE '%booked_on%' THEN 'bookedOn'
          WHEN v_constraint LIKE '%category%' THEN 'category'
          WHEN v_constraint LIKE '%identity%' THEN 'externalId' END;
      ELSE
        RAISE;                                    -- erro inesperado: aborta a chamada inteira
      END IF;
      c_rejected := c_rejected + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'index', v_idx, 'outcome', 'rejected',
        'error', jsonb_strip_nulls(jsonb_build_object('code', v_code, 'field', v_field))));
    END;
  END LOOP;

  UPDATE public.import_batches SET
    fp_occurrences = v_occ,
    count_read = count_read + jsonb_array_length(p_rows),
    count_created = count_created + c_created,
    count_updated = count_updated + c_updated,
    count_restored = count_restored + c_restored,
    count_duplicate = count_duplicate + c_duplicate,
    count_protected = count_protected + c_protected,
    count_rejected = count_rejected + c_rejected
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('created', c_created, 'updated', c_updated, 'restored', c_restored,
    'duplicate', c_duplicate, 'protected', c_protected, 'rejected', c_rejected,
    'results', v_results);
END $$;

-- ---------------------------------------------------------------------------------------------
-- Transações manuais, edição e travas (FR-019, FR-020, FR-024–FR-026)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_create_manual_transaction(p_row JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_id UUID := gen_random_uuid();
  v_cat UUID := (p_row->>'category_id')::uuid;
  v_row public.transactions;
BEGIN
  INSERT INTO public.transactions (
    id, owner_id, account_id, source, identity_key, amount_cents, booked_on, occurred_at,
    description_original, merchant, status, nature, related_transaction_id, category_id,
    category_source, notes, installment_number, installment_total, installment_group,
    original_amount_minor, original_currency)
  VALUES (
    v_id, v_owner, (p_row->>'account_id')::uuid, 'manual', 'man:' || v_id,
    (p_row->>'amount_cents')::bigint, (p_row->>'booked_on')::date,
    (p_row->>'occurred_at')::timestamptz, COALESCE(p_row->>'description', ''), p_row->>'merchant',
    COALESCE(p_row->>'status', 'posted'), COALESCE(p_row->>'nature', 'regular'),
    (p_row->>'related_transaction_id')::uuid, v_cat,
    CASE WHEN v_cat IS NULL THEN NULL ELSE 'manual' END, p_row->>'notes',
    (p_row->>'installment_number')::smallint, (p_row->>'installment_total')::smallint,
    p_row->>'installment_group', (p_row->>'original_amount_minor')::bigint,
    p_row->>'original_currency')
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.core_update_transaction(p_id UUID, p_patch JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_type TEXT := public.core_current_actor()->>'type';
  v_has_cat BOOLEAN := p_patch ? 'category';
  v_cat UUID := (p_patch->'category'->>'id')::uuid;
  v_cat_source TEXT;
  v_row public.transactions;
BEGIN
  SELECT * INTO v_row FROM public.transactions WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'core.forbidden:deleted'; END IF;
  v_cat_source := CASE v_type WHEN 'user' THEN 'manual' WHEN 'ai' THEN 'ai'
                              WHEN 'sync' THEN 'source' WHEN 'import' THEN 'source' ELSE 'rule' END;

  UPDATE public.transactions SET
    description = CASE WHEN p_patch ? 'description' THEN p_patch->>'description' ELSE description END,
    merchant = CASE WHEN p_patch ? 'merchant' THEN p_patch->>'merchant' ELSE merchant END,
    notes = CASE WHEN p_patch ? 'notes' THEN p_patch->>'notes' ELSE notes END,
    nature = CASE WHEN p_patch ? 'nature' THEN p_patch->>'nature' ELSE nature END,
    related_transaction_id = CASE WHEN p_patch ? 'related_transaction_id'
      THEN (p_patch->>'related_transaction_id')::uuid ELSE related_transaction_id END,
    category_id = CASE WHEN v_has_cat THEN v_cat ELSE category_id END,
    category_source = CASE WHEN NOT v_has_cat THEN category_source
      WHEN v_cat IS NULL THEN NULL ELSE v_cat_source END,
    category_confidence = CASE WHEN NOT v_has_cat THEN category_confidence
      WHEN v_cat IS NULL OR v_cat_source = 'manual' THEN NULL
      ELSE (p_patch->'category'->>'confidence')::smallint END,
    amount_cents = CASE WHEN p_patch ? 'amount_cents' THEN (p_patch->>'amount_cents')::bigint ELSE amount_cents END,
    booked_on = CASE WHEN p_patch ? 'booked_on' THEN (p_patch->>'booked_on')::date ELSE booked_on END,
    account_id = CASE WHEN p_patch ? 'account_id' THEN (p_patch->>'account_id')::uuid ELSE account_id END,
    status = CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE status END,
    occurred_at = CASE WHEN p_patch ? 'occurred_at' THEN (p_patch->>'occurred_at')::timestamptz ELSE occurred_at END,
    installment_number = CASE WHEN p_patch ? 'installment' THEN (p_patch->'installment'->>'number')::smallint ELSE installment_number END,
    installment_total = CASE WHEN p_patch ? 'installment' THEN (p_patch->'installment'->>'total')::smallint ELSE installment_total END,
    installment_group = CASE WHEN p_patch ? 'installment' THEN p_patch->'installment'->>'group' ELSE installment_group END,
    original_currency = CASE WHEN p_patch ? 'original' THEN p_patch->'original'->>'currency' ELSE original_currency END,
    original_amount_minor = CASE WHEN p_patch ? 'original' THEN (p_patch->'original'->>'amount_minor')::bigint ELSE original_amount_minor END,
    -- escolha manual de categoria trava o campo mesmo sem mudança de valor ("Sem categoria")
    locked_fields = CASE WHEN v_type = 'user' AND v_has_cat AND NOT ('category_id' = ANY (locked_fields))
      THEN locked_fields || 'category_id'::text ELSE locked_fields END
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.core_unlock_field(p_id UUID, p_field TEXT, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.transactions;
BEGIN
  IF p_field IS NULL OR p_field NOT IN ('description','merchant','category_id','nature',
       'related_transaction_id','notes','amount_cents','booked_on','status') THEN
    RAISE EXCEPTION 'core.validation:field';
  END IF;
  SELECT * INTO v_row FROM public.transactions WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'core.forbidden:deleted'; END IF;
  PERFORM set_config('prumo.action', 'unlock', true);
  UPDATE public.transactions SET locked_fields = array_remove(locked_fields, p_field)
   WHERE id = p_id RETURNING * INTO v_row;
  PERFORM set_config('prumo.action', '', true);
  RETURN to_jsonb(v_row);
END $$;

-- Exclusão lógica (FR-023, FR-037): desfaz vínculos de contrapartida das transações restantes.
CREATE FUNCTION public.core_soft_delete_transactions(p_ids UUID[], p_reason TEXT, p_merged_into UUID DEFAULT NULL, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_n INT;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('user','merged','batch_undone','canceled_at_source') THEN
    RAISE EXCEPTION 'core.validation:reason';
  END IF;
  IF p_reason = 'merged' AND p_merged_into IS NULL THEN RAISE EXCEPTION 'core.validation:mergedInto'; END IF;
  IF p_reason <> 'merged' AND p_merged_into IS NOT NULL THEN RAISE EXCEPTION 'core.validation:mergedInto'; END IF;
  IF COALESCE(cardinality(p_ids), 0) = 0 THEN RETURN 0; END IF;
  IF (SELECT count(*) FROM public.transactions WHERE owner_id = v_owner AND id = ANY (p_ids))
     <> (SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN
    RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_reason = 'merged' THEN
    IF p_merged_into = ANY (p_ids) THEN RAISE EXCEPTION 'core.validation:mergedInto'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_merged_into
                     AND owner_id = v_owner AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'core.not_found:mergedInto' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.transactions
     SET deleted_at = now(), deleted_reason = p_reason,
         merged_into_id = CASE WHEN p_reason = 'merged' THEN p_merged_into END
   WHERE owner_id = v_owner AND id = ANY (p_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM set_config('prumo.force_unlink', 'on', true);
  UPDATE public.transactions
     SET related_transaction_id = NULL,
         nature = CASE WHEN 'nature' = ANY (locked_fields) THEN nature ELSE 'regular' END
   WHERE owner_id = v_owner AND related_transaction_id = ANY (p_ids) AND deleted_at IS NULL;
  PERFORM set_config('prumo.force_unlink', '', true);
  RETURN v_n;
END $$;

CREATE FUNCTION public.core_restore_transactions(p_ids UUID[], p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_a INT;
  v_b INT;
BEGIN
  IF COALESCE(cardinality(p_ids), 0) = 0 THEN RETURN 0; END IF;
  IF (SELECT count(*) FROM public.transactions WHERE owner_id = v_owner AND id = ANY (p_ids))
     <> (SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN
    RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002';
  END IF;
  -- sobreviventes antes das mescladas (o trigger recusa mesclada com sobrevivente excluído)
  UPDATE public.transactions SET deleted_at = NULL, deleted_reason = NULL, merged_into_id = NULL
   WHERE owner_id = v_owner AND id = ANY (p_ids) AND deleted_at IS NOT NULL
     AND deleted_reason <> 'merged';
  GET DIAGNOSTICS v_a = ROW_COUNT;
  UPDATE public.transactions SET deleted_at = NULL, deleted_reason = NULL, merged_into_id = NULL
   WHERE owner_id = v_owner AND id = ANY (p_ids) AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN v_a + v_b;
END $$;

-- Desfazer lote concluído ou que falhou (FR-035).
CREATE FUNCTION public.core_undo_batch(p_id UUID, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_actor JSONB;
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_batch public.import_batches;
  v_ids UUID[];
  v_edits INT;
  v_deleted INT;
BEGIN
  v_actor := public.core_current_actor();
  SELECT * INTO v_batch FROM public.import_batches WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_batch.status NOT IN ('completed', 'failed') THEN RAISE EXCEPTION 'core.forbidden:batch_state'; END IF;
  SELECT COALESCE(array_agg(id), '{}'), count(*) FILTER (WHERE locked_fields <> '{}')
    INTO v_ids, v_edits
    FROM public.transactions WHERE owner_id = v_owner AND batch_id = p_id AND deleted_at IS NULL;
  v_deleted := public.core_soft_delete_transactions(v_ids, 'batch_undone', NULL, v_owner, v_actor);
  UPDATE public.import_batches SET status = 'undone' WHERE id = p_id;
  RETURN jsonb_build_object('deleted', v_deleted, 'withManualEdits', v_edits);
END $$;

-- Histórico de auditoria paginado, mais recente primeiro (FR-043).
CREATE FUNCTION public.core_list_audit(p_entity_type TEXT, p_entity_id UUID, p_after_id BIGINT DEFAULT NULL, p_limit INT DEFAULT 50, p_owner_id UUID DEFAULT NULL)
RETURNS SETOF public.audit_log
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_resolve_owner(p_owner_id);
BEGIN
  RETURN QUERY
  SELECT * FROM public.audit_log
   WHERE owner_id = v_owner AND entity_type = p_entity_type AND entity_id = p_entity_id
     AND (p_after_id IS NULL OR id < p_after_id)
   ORDER BY id DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
END $$;

-- ---------------------------------------------------------------------------------------------
-- Categorias (FR-027–FR-032)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.core_create_category(p JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.categories;
BEGIN
  IF NOT (p ? 'parent_id') AND NOT (p ? 'kind') THEN RAISE EXCEPTION 'core.validation:kind'; END IF;
  INSERT INTO public.categories (owner_id, parent_id, name, kind, origin, sort_order)
  VALUES (v_owner, (p->>'parent_id')::uuid, p->>'name', COALESCE(p->>'kind', 'expense'), 'custom',
          COALESCE((p->>'sort_order')::smallint, 1000))
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'name_key';
END $$;

CREATE FUNCTION public.core_update_category(p_id UUID, p_patch JSONB, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.categories;
BEGIN
  SELECT * INTO v_row FROM public.categories WHERE id = p_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'core.forbidden:deleted'; END IF;
  UPDATE public.categories SET
    name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE name END,
    hidden = CASE WHEN p_patch ? 'hidden' THEN (p_patch->>'hidden')::boolean ELSE hidden END,
    parent_id = CASE WHEN p_patch ? 'parent_id' THEN (p_patch->>'parent_id')::uuid ELSE parent_id END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch->>'kind' ELSE kind END,
    sort_order = CASE WHEN p_patch ? 'sort_order' THEN (p_patch->>'sort_order')::smallint ELSE sort_order END
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row) - 'name_key';
END $$;

-- Excluir categoria com destino (padrão "Sem categoria" ⇒ NULL) e filhos movidos/excluídos (FR-031).
CREATE FUNCTION public.core_delete_category(p_id UUID, p_target_id UUID DEFAULT NULL, p_children TEXT DEFAULT 'move', p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_cat public.categories;
  v_target public.categories;
  v_target_id UUID;
  v_ids UUID[];
  v_n INT;
BEGIN
  IF p_children IS NULL OR p_children NOT IN ('move', 'delete') THEN
    RAISE EXCEPTION 'core.validation:children';
  END IF;
  SELECT * INTO v_cat FROM public.categories
   WHERE id = p_id AND owner_id = v_owner AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_cat.system_key IS NOT NULL THEN RAISE EXCEPTION 'core.forbidden:system_category'; END IF;
  IF EXISTS (SELECT 1 FROM public.categories WHERE owner_id = v_owner AND parent_id = p_id
               AND system_key IS NOT NULL) THEN
    RAISE EXCEPTION 'core.forbidden:system_child';
  END IF;

  IF p_target_id IS NULL THEN
    SELECT * INTO v_target FROM public.categories
     WHERE owner_id = v_owner AND system_key = 'uncategorized';
  ELSE
    SELECT * INTO v_target FROM public.categories
     WHERE id = p_target_id AND owner_id = v_owner AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found:targetId' USING ERRCODE = 'P0002'; END IF;
    IF v_target.id = p_id OR v_target.parent_id = p_id THEN
      RAISE EXCEPTION 'core.validation:targetId';
    END IF;
  END IF;
  -- representação única de "sem categoria": NULL
  v_target_id := CASE WHEN v_target.system_key = 'uncategorized' THEN NULL ELSE v_target.id END;

  IF p_children = 'move' THEN
    UPDATE public.categories
       SET parent_id = CASE WHEN v_target_id IS NOT NULL AND v_target.parent_id IS NULL
                            THEN v_target_id ELSE NULL END
     WHERE owner_id = v_owner AND parent_id = p_id AND deleted_at IS NULL;
    v_ids := ARRAY[p_id];
  ELSE
    SELECT array_agg(id) || p_id INTO v_ids FROM public.categories
     WHERE owner_id = v_owner AND parent_id = p_id AND deleted_at IS NULL;
    v_ids := COALESCE(v_ids, ARRAY[p_id]);
  END IF;

  PERFORM set_config('prumo.action', 'reassign', true);
  UPDATE public.transactions SET
    category_id = v_target_id,
    category_source = CASE WHEN v_target_id IS NULL THEN NULL ELSE category_source END,
    category_confidence = CASE WHEN v_target_id IS NULL THEN NULL ELSE category_confidence END
   WHERE owner_id = v_owner AND category_id = ANY (v_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('prumo.action', '', true);

  -- filhos primeiro (o pai excluído não pode mais ser pai de categoria ativa)
  UPDATE public.categories SET deleted_at = now()
   WHERE owner_id = v_owner AND id = ANY (v_ids) AND id <> p_id;
  UPDATE public.categories SET deleted_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('reassigned', v_n);
END $$;

CREATE FUNCTION public.core_restore_category(p_id UUID, p_owner_id UUID DEFAULT NULL, p_actor JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_owner UUID := public.core_begin(p_owner_id, p_actor);
  v_row public.categories;
BEGIN
  UPDATE public.categories SET deleted_at = NULL
   WHERE id = p_id AND owner_id = v_owner AND deleted_at IS NOT NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.categories WHERE id = p_id AND owner_id = v_owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'core.not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN to_jsonb(v_row) - 'name_key';
END $$;

-- ---------------------------------------------------------------------------------------------
-- Privilégios das funções criadas neste arquivo (mesma regra de *_core_rls.sql): EXECUTE só para
-- authenticated/service_role; anon nunca; funções de trigger para ninguém.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'core\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF NOT f.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    END IF;
  END LOOP;
END $$;
