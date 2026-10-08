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

-- @@FUNCTIONS@@

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
