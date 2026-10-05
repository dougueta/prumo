# Research — 004 · Modelo de Dados Core

Base técnica herdada da 001 (branch `001-setup-projeto`): Next.js 16.3, TypeScript 5.9 strict,
`@supabase/supabase-js` 2.117, zod 4.6, Vitest 5, Supabase CLI 2.119 (portas 573xx), cliente
de servidor `src/lib/supabase/server.ts` (chave secreta, `server-only`), env só em
`src/lib/env.ts`, modo demonstração `APP_ENV=preview` sem banco, gerador `generateDataset()`
(`SyntheticDataset` v1). Nenhuma dependência nova é necessária nesta feature.

## R-01 · Onde vivem as regras: banco × aplicação
- **Decision**: **defesa em profundidade**. As invariantes que protegem dados (dono, sinal/inteiro,
  imutabilidade de campos importados, proteção de campos manuais, proibição de DELETE físico,
  auditoria atômica, unicidade) ficam **no banco** (constraints + triggers). As mesmas regras
  são reimplementadas em TypeScript puro (`src/domain/core/`) e usadas pela implementação em
  memória. Uma bateria única de testes de contrato prova que as duas se comportam igual.
- **Rationale**: o banco é a última linha (Constitution II/IV) e protege inclusive contra
  acesso direto via PostgREST; o domínio em TS é necessário para o modo demonstração (ADR 0006).
- **Alternatives**: só na aplicação (um `update` direto via PostgREST pularia proteção e
  auditoria); só no banco (o modo demonstração não teria as regras).

## R-02 · Gravações: funções Postgres (RPC) × DML direto
- **Decision**: toda gravação dos repositórios passa por **funções Postgres `core_*`**
  (`SECURITY INVOKER`, chamadas via `rpc()`), que recebem o **ator** (`p_actor jsonb`) e o
  publicam na transação com `set_config('prumo.actor', …, true)`. Os triggers de auditoria e de
  proteção leem esse valor. DML direto continua sujeito a RLS e triggers; sem ator explícito,
  o trigger assume `user` quando há `auth.uid()` e `system` caso contrário.
- **Rationale**: PostgREST executa cada chamada numa transação própria; só uma função consegue
  definir o ator e executar a alteração na mesma transação (FR-040: auditoria atômica). Também
  permite upsert em lote com contadores (FR-033) numa ida ao banco.
- **Alternatives**: cabeçalho HTTP customizado lido de `request.headers` (ator fixo por
  instância do cliente, frágil); tabela de auditoria gravada pela aplicação (não atômica).

## R-03 · Escopo por dono, RLS e chave secreta
- **Decision**:
  - Toda tabela core tem `owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`,
    RLS habilitado e policies `SELECT/INSERT/UPDATE` com `owner_id = (select auth.uid())`;
    **sem policy de DELETE** (negado). FKs compostas `(id, owner_id)` impedem relacionar
    registros de donos diferentes.
  - Dois modos de contexto no repositório Supabase: **`user`** (cliente com JWT do usuário —
    RLS efetivo; modo padrão de requisições após a 006) e **`service`** (chave secreta, só
    servidor, para jobs como a sync da 008 e para testes) com `ownerId` explícito: o repositório
    filtra por `owner_id` em toda consulta e as funções `core_*` resolvem o dono por
    `core_resolve_owner(p_owner_id)` — aceita `p_owner_id` apenas quando `auth.role() =
    'service_role'`; com JWT, usa `auth.uid()` e rejeita divergência.
  - **Privilégios** (Remediação 2026-10-05): a CLI 2.119 da 001 não expõe objetos novos aos
    papéis da Data API (`auto_expose_new_tables` não definido em `supabase/config.toml`), então
    a migração concede explicitamente `SELECT/INSERT/UPDATE` e `EXECUTE` mínimos e nunca
    `DELETE`/`TRUNCATE` (matriz em data-model §3), no padrão do `health_ping` da 001.
- **Rationale**: a chave secreta ignora RLS; sem filtro explícito, um bug de job vazaria dados.
  O padrão `(select auth.uid())` evita reavaliação por linha (recomendação Supabase).
- **Alternatives**: só service role com filtro na aplicação (sem rede de segurança no banco);
  `SECURITY DEFINER` em todas as funções (amplia superfície de privilégio).

## R-04 · Contrato com a 006 (login) enquanto ela não existe
- **Decision**: a 004 define a interface `OwnerContextProvider` (contracts/owner-context.md).
  A 006 a implementa entregando `{ ownerId, client }` com o JWT da sessão. Até lá, o
  `getCoreStore()` em `local`/`production` exige contexto explícito (testes/jobs); em
  `preview` usa a memória com dono fixo de demonstração. Variável nova
  `SUPABASE_PUBLISHABLE_KEY` (cliente com JWT) é **introduzida pela 006** em `env.ts`; os
  testes de RLS da 004 usam o mesmo nome, exportado por `scripts/ci-supabase-env.mjs` (CI) ou
  lido de `supabase status -o env` pelo helper de testes (local), sempre fora de `src/`.
  Remediação 2026-10-05: a 006 implementa o provedor (adaptador `requireSession` +
  `getDataClient`), importa `DEMO_OWNER_ID` da 004 e usa `prumo_demo_sid` como `sessionId`
  demo; ordem de merge 004 → 003 → 006 → 002.
- **Rationale**: 004 e 006 rodam em paralelo na onda 1; o contrato evita bloqueio mútuo.

## R-05 · Domínios enumerados: `VARCHAR + CHECK` × `ENUM`
- **Decision**: `VARCHAR(n) NOT NULL CHECK (col IN (...))`, valores em inglês snake_case
  (`checking`, `digital_wallet`, `credit_card`, …). Rótulos `pt-BR` só na apresentação.
- **Rationale**: Constitution VII pede migrações aditivas/reversíveis; trocar um CHECK é
  reversível, `ALTER TYPE … ADD VALUE` não é (não remove valor).

## R-06 · Identidade da transação e idempotência (FR-021/FR-022)
- **Decision**: coluna `identity_key VARCHAR(160) NOT NULL` com `UNIQUE (account_id, source,
  identity_key)` válida **também para excluídas** (reimportar não ressuscita uma transação que o
  Doug excluiu). Formatos:
  - `ext:<external_id>` quando a origem tem id (Pluggy, OFX `FITID`, PDF com id);
  - `fp:<sha256 hex>` = `sha256(fp_base|occurrence)`, com `fp_base =
    sha256(account_id|booked_on|amount_cents|norm(description_original))`, quando não há id (CSV);
  - `man:<uuid>` para manuais.
  `norm()` = NFKD, remove diacríticos, maiúsculas, colapsa espaços, `trim`. **Remediação
  2026-10-05**: `fp_base` é calculado só em TS (`fingerprintBase()` em
  `src/domain/core/identity.ts`, `node:crypto`) e enviado em `p_rows`; a `occurrence` (1..k
  entre linhas com a mesma base) é contada **no lote inteiro** pelo contador
  `import_batches.fp_occurrences`, atualizado pela função de upsert (e pela memória com a
  mesma regra); o banco monta a chave com `core_fp_identity()` e valida a coerência de `ext:`
  por CHECK. Motivos: (1) `unaccent` do Postgres ≠ NFKD — normalizar nos dois lados
  divergiria; (2) contar por chamada perderia cafés idênticos enviados em chamadas
  diferentes do mesmo lote.
- **Rationale**: determinístico, independente de ordem global do arquivo, distingue dois cafés
  idênticos (US1 cenário 4). Dedup **entre** origens é da 011. Reimportação de linhas
  excluídas por `batch_undone` as restaura (decisão D-C do Doug).
- **Alternatives**: hash do arquivo inteiro (não detecta sobreposição parcial entre extratos);
  `UNIQUE` parcial só para não excluídas (reimportação recriaria o que o Doug apagou).

## R-07 · Proteção de campos manuais (FR-024–FR-026)
- **Decision**: `locked_fields TEXT[] NOT NULL DEFAULT '{}'`. Trigger `BEFORE UPDATE`:
  - ator `user` alterando campo editável → adiciona o campo a `locked_fields`;
  - ator automático (`sync`, `import`, `ai`, `rule`, `system`) tentando alterar
    campo em `locked_fields` → **mantém o valor antigo** (descarte silencioso para o dado,
    mas contado no retorno da função de upsert como `protected`);
  - `core_unlock_field()` remove o campo ("voltar ao automático").
  Categoria tem `category_source` (`manual|rule|ai|source`) e `category_confidence SMALLINT
  0–100` (nulo quando manual).
- **Rationale**: a proteção vale para qualquer caminho de escrita, inclusive futuros
  (014/015/008), sem depender da disciplina de cada feature.

## R-08 · Pendentes que mudam (Clarificação Q2)
- **Decision**: no upsert, conflito de identidade com linha existente `pending` → atualiza
  `amount_cents`, `booked_on`, `description_original`, `merchant`, `status`, `occurred_at`
  (exceto campos travados) e audita valores anteriores. Linha existente `posted` → nenhum
  fato muda (`duplicate`), apenas campos automáticos não travados podem ser
  atualizados (ex.: `merchant` vazio). Transição `posted → pending` é proibida.
  Cancelamento detectado pela 008 usa `core_soft_delete_transactions(reason='canceled_at_source')`.

## R-09 · Saldos (Clarificação Q3)
- **Decision**: `accounts.reported_balance_cents BIGINT NULL` + `reported_balance_on DATE NULL`
  (vindos da fonte), `opening_balance_cents BIGINT NOT NULL DEFAULT 0` + `opening_balance_on
  DATE NULL` (contas manuais). Função `core_account_balances(p_as_of, p_owner_id)` calcula
  `computed = opening + Σ amount (posted, não excluídas, opening_on ≤ booked_on ≤ as_of)` e
  `divergence = reported − computed(reported_balance_on)`. Pendentes ficam fora do calculado.
- **Rationale**: saldo do banco fiel + checagem de integridade das importações; nada é
  armazenado de forma derivada (sem cache a invalidar).

## R-10 · Auditoria
- **Decision**: tabela `audit_log` (BIGINT identity) gravada por trigger `AFTER INSERT/UPDATE`
  das tabelas core (função `SECURITY DEFINER`, `search_path=''`), com `changes JSONB`
  `{campo: {old, new}}` apenas dos campos alterados (exceto `updated_at`). Append-only:
  RLS só `SELECT`; triggers `BEFORE UPDATE/DELETE` lançam exceção para qualquer papel.
  Ação semântica (`soft_delete`, `restore`, `merge`, `archive`, `undo_batch`, `reassign`)
  é derivada pelo trigger a partir das colunas de estado ou informada pela função em
  `prumo.action`.
- **Alternatives**: extensão `supa_audit`/`pgaudit` (genéricas, sem ator de domínio nem
  ação semântica; pgaudit grava em log do servidor, não consultável pelo app).

## R-11 · Unicidade de nome de categoria sem acento/caixa (FR-032)
- **Decision**: extensão `unaccent` (já disponível no Supabase, schema `extensions`) +
  wrapper `public.core_name_key(text) IMMUTABLE` (`lower(extensions.unaccent('extensions.unaccent', $1))`
  com `trim`) usado em coluna gerada `name_key` e índice único parcial
  `(owner_id, COALESCE(parent_id, '00000000-…'), name_key) WHERE deleted_at IS NULL`.
  A memória usa `nameKey()` equivalente em TS (NFKD + remove diacríticos + lower + trim).
- **Rationale**: `unaccent()` não é `IMMUTABLE`; o wrapper com dicionário explícito é o padrão
  documentado para índices.

## R-12 · Taxonomia padrão (Clarificação Q1)
- **Decision**: fonte única em TS (`src/domain/core/default-categories.ts`), estilo GuiaBolso:
  15 categorias de despesa, 5 de receita, 3 neutras de sistema (ver data-model §4). Script
  `scripts/generate-category-seed.ts` gera a migração de seed da tabela global
  `category_templates`; teste unit garante que a migração versionada é idêntica à saída do
  script (mesmo padrão das fixtures da 001). `core_bootstrap_owner()` copia os modelos para o
  dono de forma idempotente.

## R-13 · Modo demonstração em memória (FR-045–FR-047)
- **Decision**: `MemoryCoreStore` (mesma interface `CoreStore`) sobre `Map`s, populado por
  `fromSyntheticDataset(generateDataset({ seed: 42, months: 12, anchorDate }))`. Isolamento por
  sessão: `src/proxy.ts` atribui cookie `prumo_demo_sid` (UUID, `HttpOnly`, `SameSite=Lax`,
  só em `preview`); um registro `DemoSessions` mantém até 50 lojas (LRU, TTL 2 h) por instância.
  Dono fixo `DEMO_OWNER_ID` = `00000000-0000-4000-8000-00000000d3e0` (exportado por `@/data/core`; a 006 importa).
- **Rationale**: Next 16 permite definir cookies na resposta do proxy
  (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, "Using Cookies").
  Gravações valem "durante a sessão" (spec FR-047); perda ao trocar de instância serverless é
  aceitável no modo demonstração e documentada.
- **Alternatives**: estado só no navegador (duplicaria as regras no client); armazenamento
  persistente para demo (viola ADR 0006).

## R-14 · Dinheiro e datas em TypeScript
- **Decision**: tipo `Cents` = `number` validado por `Number.isSafeInteger` (|v| ≤ 2^53−1,
  muito acima de qualquer valor real); PostgREST devolve `BIGINT` como número JSON. Entrada de
  valores decimais (ex.: "12,34") é responsabilidade dos conectores, que devem usar
  `parseCentsStrict()` do domínio (rejeita fração de centavo — FR-018). Datas de negócio como
  `YYYY-MM-DD` (`IsoDate`), validadas com calendário real; `toSaoPauloDate(instant)` converte
  instantes UTC (US1 cenário 6).
- **Proibido**: `parseFloat`/`Number("12.34")*100` para dinheiro; `Date` para datas de negócio.

## R-15 · Testes de contrato e de RLS
- **Decision**: `tests/contract/core-store.contract.ts` exporta `describeCoreStoreContract(
  name, makeStore)`; executado por `tests/unit/core/memory-store.contract.test.ts` e por
  `tests/integration/core/supabase-store.contract.int.test.ts` (Supabase local/CI). Testes de
  RLS criam 2 usuários via Admin API do Supabase local (`auth.admin.createUser`) e usam
  clientes com JWT (chave publicável lida de `supabase status -o env`; o script
  `scripts/ci-supabase-env.mjs` passa a exportar `SUPABASE_PUBLISHABLE_KEY` só para
  testes). Teste de desempenho com 100 mil transações geradas por `generate_series` (SC-007).
