-- Feature 004 · modelo-dados-core (dona). data-model §3: RLS + FORCE, policies explícitas e
-- matriz GRANT/REVOKE (a CLI não expõe objetos novos aos papéis da Data API).

ALTER TABLE public.institutions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.institutions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.category_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          FORCE ROW LEVEL SECURITY;

-- accounts, transactions, categories, import_batches: só o dono; sem policy de DELETE (negado).
CREATE POLICY accounts_select ON public.accounts FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY accounts_insert ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY accounts_update ON public.accounts FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY transactions_select ON public.transactions FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY transactions_insert ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY transactions_update ON public.transactions FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY import_batches_select ON public.import_batches FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY import_batches_insert ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY import_batches_update ON public.import_batches FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

-- institutions: catálogo legível por autenticados; escrita só nas próprias.
CREATE POLICY institutions_select ON public.institutions FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = (SELECT auth.uid()));
CREATE POLICY institutions_insert ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY institutions_update ON public.institutions FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

-- category_templates: leitura para autenticados; escrita só por migração.
CREATE POLICY category_templates_select ON public.category_templates FOR SELECT TO authenticated
  USING (true);

-- audit_log: só leitura das próprias linhas (inserção exclusiva do trigger SECURITY DEFINER).
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Premissa (data-model §3): o trigger core_audit e o seed rodam como o dono das tabelas. Se esse
-- papel não tiver BYPASSRLS, cria policies restritas a ele (FORCE RLS vale também para o dono).
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    FOREACH t IN ARRAY ARRAY['institutions','accounts','transactions','categories',
                             'category_templates','import_batches','audit_log'] LOOP
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
                     t || '_owner_role', t, current_user);
    END LOOP;
  END IF;
END $$;

-- Privilégios: nada de GRANT ALL; DELETE/TRUNCATE/REFERENCES/TRIGGER nunca.
REVOKE ALL ON public.institutions, public.accounts, public.transactions, public.categories,
              public.category_templates, public.import_batches, public.audit_log
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.institutions, public.accounts, public.transactions,
              public.categories, public.import_batches TO authenticated, service_role;
GRANT SELECT ON public.category_templates, public.audit_log TO authenticated, service_role;

-- Funções core_*: EXECUTE só para authenticated/service_role; funções de trigger para ninguém.
-- (repetido ao fim de *_core_functions.sql para as funções criadas lá)
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
