# Quickstart — 004 · Modelo de Dados Core (após a implementação)

Pré-requisitos: base da 001 funcionando (`npm run dev:setup` ok, Docker Desktop aberto).

```bash
supabase db reset                       # aplica todas as migrações (inclui core_*) no Supabase local
npm run check                           # lint + formato + tipos + unit (inclui contrato em memória)
npm run test:integration                # contrato no Supabase + RLS + auditoria + guardas + desempenho
npx tsx scripts/generate-category-seed.ts --check   # migração de seed idêntica à taxonomia em TS
```

Inspecionar o modelo no Supabase local (Studio em http://localhost:57323):
- 7 tabelas em `public`: `institutions`, `accounts`, `transactions`, `categories`,
  `category_templates`, `import_batches`, `audit_log` — todas com RLS habilitado.
- `select count(*) from category_templates;` → 99 (24 de 1º nível + 75 subcategorias).

Usar o contrato em código de servidor (outras features):

```ts
import { getCoreStore } from "@/data/core";

const store = await getCoreStore();                 // preview → memória; demais → provedor da 006
const page = await store.transactions.list({ from: "2026-09-01", to: "2026-09-30" });
```

Jobs de servidor (ex.: sync 008) usam contexto `service` com dono explícito:

```ts
import { createCoreStore } from "@/data/core";
import { createServerClient } from "@/lib/supabase/server";

const store = createCoreStore({ kind: "service", ownerId, client: createServerClient() });
const batch = await store.batches.create({ source: "pluggy", initiatedBy: "schedule" }, { type: "sync" });
await store.transactions.upsertMany(batch.id, rows, { type: "sync", batchId: batch.id });
await store.batches.finish(batch.id, "completed", { type: "sync" });
```

Modo demonstração local:
```bash
npm run dev:demo                         # APP_ENV=preview; getCoreStore() devolve a loja em memória (semente 42)
```

Problemas comuns:
- `owner_required` em `local` → não há provedor de sessão (006) registrado; use contexto
  `service` em scripts/testes.
- `core.hard_delete_forbidden` → use `softDelete`; DELETE físico é proibido por design.
- `core.forbidden:imported_fact` → valor/data de transação importada não se edita; exclua e
  crie uma manual.
- `core.forbidden:batch_closed` → o lote não está em `processing` (ex.: `in_review` — chame
  `batches.resume` após a revisão; ou já concluído — crie um lote novo para reprocessar).
- `permission denied for table …` → faltou GRANT na migração (matriz do data-model §3); a CLI
  da 001 não expõe objetos novos automaticamente.
