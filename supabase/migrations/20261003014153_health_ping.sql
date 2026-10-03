-- Feature 001 · setup-projeto (dona). Contrato: specs/001-setup-projeto/data-model.md §1
-- Função sem tabelas usada pela verificação de saúde e pelo keepalive (FR-002, FR-023).
create or replace function public.health_ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated, service_role;
