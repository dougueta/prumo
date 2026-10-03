# Data Model — 004 · Modelo de Dados Core

**Dona de todas as tabelas, funções e triggers deste documento: feature 004** (Constitution VII).
Outras features MUST NOT alterar estas estruturas; mudanças são propostas na spec/plan da 004.

Convenções: nomes em inglês `snake_case`; dinheiro `BIGINT *_cents` (sinal: negativo = saída
da conta); datas de negócio `DATE` (America/Sao_Paulo); timestamps técnicos `TIMESTAMPTZ`
(UTC); domínios enumerados como `VARCHAR + CHECK` (research R-05); toda tabela com RLS.
Migrações (Supabase CLI, timestamp): `<ts>_core_schema.sql`, `<ts>_core_audit.sql`,
`<ts>_core_rls.sql`, `<ts>_core_functions.sql`, `<ts>_core_seed_catalog.sql` (gerada).

## 1. Visão geral

```text
auth.users (Supabase) ──1:N── institutions (owner_id NULL = catálogo de referência)
        │                         │
        ├──1:N── accounts ────────┘ (institution_id)
        │          │
        ├──1:N── import_batches (account_id opcional)
        │          │
        ├──1:N── transactions ── account_id, batch_id, category_id,
        │                         related_transaction_id, merged_into_id (auto-referências)
        ├──1:N── categories (parent_id → categories, 2 níveis)   category_templates (global)
        └──1:N── audit_log (append-only)
```

| Tabela | Dona | Escopo | Exclusão |
|---|---|---|---|
| `institutions` | 004 | catálogo global (`owner_id NULL`) + do dono | lógica (`deleted_at`) |
| `accounts` | 004 | dono | arquivamento (`archived_at`); DELETE proibido |
| `transactions` | 004 | dono | lógica (`deleted_at` + motivo); DELETE proibido |
| `categories` | 004 | dono | lógica; categorias de sistema nunca |
| `category_templates` | 004 | global, só leitura | — (gerenciada por migração) |
| `import_batches` | 004 | dono | nunca (estado `undone`) |
| `audit_log` | 004 | dono | nunca (append-only) |

## 2. Schemas

### 2.1 Funções utilitárias

```sql
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

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
  IF auth.role() = 'service_role' AND p_owner_id IS NOT NULL THEN RETURN p_owner_id; END IF;
  RAISE EXCEPTION 'core.owner_required' USING ERRCODE = '42501';
END $$;

-- Ator da transação corrente (R-02).
CREATE FUNCTION public.core_current_actor() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT COALESCE(
  NULLIF(current_setting('prumo.actor', true), '')::jsonb,
  CASE WHEN auth.uid() IS NOT NULL THEN '{"type":"user"}'::jsonb
       ELSE '{"type":"system"}'::jsonb END) $$;
```

Ator (`jsonb`): `{"type": "user"|"sync"|"import"|"ai"|"rule"|"system", "ref": "<texto ≤100>"?,
"batchId": "<uuid>"?}` — rótulos pt-BR: usuário, sincronização, importação, IA, regra, sistema.

### 2.2 `institutions`

```sql
CREATE TABLE public.institutions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- NULL = catálogo
  name             VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  kind             VARCHAR(20)  NOT NULL CHECK (kind IN ('bank','digital_wallet','card_issuer','broker','other')),
  bank_code        VARCHAR(3)   NULL CHECK (bank_code ~ '^[0-9]{3}$'),     -- COMPE
  external_ref     VARCHAR(100) NULL,                                       -- id no provedor Open Finance
  name_key         TEXT GENERATED ALWAYS AS (public.core_name_key(name)) STORED,
  deleted_at       TIMESTAMPTZ  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE UNIQUE INDEX institutions_catalog_name_uq ON public.institutions (name_key)
  WHERE owner_id IS NULL;
CREATE UNIQUE INDEX institutions_owner_name_uq ON public.institutions (owner_id, name_key)
  WHERE owner_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX institutions_owner_extref_uq ON public.institutions (owner_id, external_ref)
  WHERE external_ref IS NOT NULL;
```

Catálogo de referência (migração gerada, UUIDs fixos `00000000-0000-4000-a000-000000000NNN`
onde NNN = código COMPE): Mercado Pago (323, `digital_wallet`), Caixa Econômica Federal (104,
`bank`), PicPay (380, `digital_wallet`), C6 Bank (336, `bank`), Nubank (260), Banco Inter (077),
Itaú (341), Bradesco (237), Banco do Brasil (001), Santander (033); e "Outra instituição"
(`other`, sem código). Catálogo não é dado pessoal (FR-005).

### 2.3 `accounts`

```sql
CREATE TABLE public.accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  institution_id         UUID NOT NULL REFERENCES public.institutions(id),
  name                   VARCHAR(80)  NOT NULL CHECK (length(trim(name)) > 0),
  nickname               VARCHAR(40)  NULL,
  type                   VARCHAR(20)  NOT NULL CHECK (type IN
                           ('checking','digital_wallet','credit_card','savings','investment')),
  currency               CHAR(3)      NOT NULL DEFAULT 'BRL' CHECK (currency ~ '^[A-Z]{3}$'),
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
  CHECK (type = 'credit_card' OR (credit_limit_cents IS NULL AND closing_day IS NULL AND due_day IS NULL)),
  CHECK ((reported_balance_cents IS NULL) = (reported_balance_on IS NULL)),
  CHECK (source = 'manual' OR external_id IS NOT NULL)
);
CREATE UNIQUE INDEX accounts_source_external_uq ON public.accounts (owner_id, source, external_id)
  WHERE external_id IS NOT NULL;                                                  -- FR-012
CREATE INDEX accounts_owner_active_idx ON public.accounts (owner_id) WHERE archived_at IS NULL;
```

Trigger `accounts_guard` (BEFORE INSERT/UPDATE): `institution_id` MUST ser do catálogo ou do
mesmo dono; `owner_id`, `source`, `external_id` imutáveis após criação.

### 2.4 `import_batches`

```sql
CREATE TABLE public.import_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source           VARCHAR(10) NOT NULL CHECK (source IN ('pluggy','csv','ofx','pdf','sheets','manual')),
  account_id       UUID NULL,                                 -- NULL = vários (ex.: item Pluggy)
  initiated_by     VARCHAR(10) NOT NULL CHECK (initiated_by IN ('user','schedule','webhook','system')),
  file_name        VARCHAR(255) NULL,
  file_sha256      CHAR(64)    NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  period_start     DATE NULL,
  period_end       DATE NULL CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  status           VARCHAR(12) NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','in_review','completed','failed','undone')),
  count_read       INTEGER NOT NULL DEFAULT 0 CHECK (count_read >= 0),
  count_created    INTEGER NOT NULL DEFAULT 0 CHECK (count_created >= 0),
  count_updated    INTEGER NOT NULL DEFAULT 0 CHECK (count_updated >= 0),
  count_duplicate  INTEGER NOT NULL DEFAULT 0 CHECK (count_duplicate >= 0),
  count_rejected   INTEGER NOT NULL DEFAULT 0 CHECK (count_rejected >= 0),
  error_summary    VARCHAR(500) NULL,                         -- sem dados sensíveis
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (account_id, owner_id) REFERENCES public.accounts (id, owner_id)
);
CREATE INDEX import_batches_owner_started_idx ON public.import_batches (owner_id, started_at DESC);
CREATE INDEX import_batches_file_idx ON public.import_batches (owner_id, account_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND status = 'completed';                         -- FR-034
```

**Máquina de estados** (trigger `import_batches_state_guard`):

```text
processing ──► in_review ──► completed ──► undone
     │             │
     ├──► completed└──► failed
     └──► failed
```
Proibidas: qualquer saída de `failed` ou `undone`; `completed → processing|in_review|failed`;
`in_review → processing`. `finished_at` é preenchido ao entrar em `completed|failed`.

### 2.5 `categories` e `category_templates`

```sql
CREATE TABLE public.category_templates (            -- global, só leitura (seed gerado, R-12)
  key          VARCHAR(60) PRIMARY KEY,              -- ex.: 'food', 'food.restaurants'
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
  CHECK (parent_id IS NULL OR parent_id <> id),
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
```

Trigger `categories_guard` (BEFORE INSERT/UPDATE): pai MUST ser de 1º nível (máx. 2 níveis,
FR-027) e não excluído; filho **herda `kind`** do pai (FR-028) e mudança de `kind` do pai
propaga aos filhos; categoria com `system_key` não pode receber `deleted_at` nem ganhar pai.

### 2.6 `transactions`

```sql
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
  occurred_at            TIMESTAMPTZ  NULL,                           -- horário original (UTC)
  description_original   VARCHAR(500) NOT NULL,                       -- imutável (exceto pendente, R-08)
  description            VARCHAR(500) NULL,                           -- editável
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
  original_amount_minor  BIGINT       NULL,                           -- unidade menor da moeda original
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
  CHECK (source = 'manual' OR batch_id IS NOT NULL),                          -- FR-014
  CHECK ((installment_number IS NULL) = (installment_total IS NULL)),
  CHECK (installment_total IS NULL OR (installment_total BETWEEN 1 AND 420
         AND installment_number BETWEEN 1 AND installment_total)),           -- FR-018
  CHECK ((original_amount_minor IS NULL) = (original_currency IS NULL)),
  CHECK ((deleted_at IS NULL) = (deleted_reason IS NULL)),
  CHECK ((deleted_reason = 'merged') = (merged_into_id IS NOT NULL)),
  CHECK (merged_into_id IS NULL OR merged_into_id <> id),
  CHECK (related_transaction_id IS NULL OR related_transaction_id <> id),
  CHECK ((category_id IS NULL) = (category_source IS NULL)),
  CHECK (category_source IS DISTINCT FROM 'manual' OR category_confidence IS NULL),
  CHECK (locked_fields <@ ARRAY['description','merchant','category_id','nature',
         'related_transaction_id','notes','amount_cents','booked_on','status']::TEXT[]),
  CHECK (identity_key ~ '^(ext:.+|fp:[0-9a-f]{64}|man:[0-9a-f-]{36})$')
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
```

#### Regras de campo (trigger `transactions_guard`, BEFORE INSERT/UPDATE)

| Campo | Manual (`source='manual'`) | Importada | Quem pode mudar após criação |
|---|---|---|---|
| `owner_id`, `account_id`, `source`, `external_id`, `identity_key`, `batch_id` | imutável¹ | imutável | ninguém |
| `amount_cents`, `booked_on` | editável (usuário) | imutável | importada: só `sync/import` se `OLD.status='pending'` (R-08) |
| `description_original` | = descrição do lançamento | imutável | idem acima |
| `occurred_at`, `merchant` | editável | automático | `merchant` é travável |
| `status` | editável | automático | `pending → posted` permitido; `posted → pending` **proibido** |
| `description`, `category_*`, `nature`, `related_transaction_id`, `notes` | editável | editável | usuário trava; automáticos respeitam trava |
| `installment_*`, `original_*` | editável | imutável | — |

¹ `account_id` de transação manual pode mudar (transferir lançamento manual para outra conta),
desde que a conta seja do mesmo dono — a `identity_key` `man:` não depende da conta.

Proteção (R-07): ator `user` alterando campo travável → `locked_fields := locked_fields ∪ {campo}`
(categoria manual também força `category_source='manual'`, `category_confidence=NULL`); ator
automático alterando campo de `locked_fields` → `NEW.campo := OLD.campo`.
Natureza: `internal_transfer`/`card_payment` exigem categoria de sistema correspondente
quando `category_source <> 'manual'` (o trigger atribui `internal_transfer`/`card_payment`).
Vínculo: `related_transaction_id` MUST apontar para transação não excluída do mesmo dono; ao
excluir logicamente uma transação, as que apontam para ela têm o vínculo desfeito e `nature`
volta a `regular` (exceto se travada), com auditoria (edge case da spec).

#### Máquina de estados — transação

```text
          ┌──────── restore ────────┐
          ▼                         │
pending ──► posted ──► (deleted: user | merged | batch_undone | canceled_at_source)
   │                                ▲
   └────────────── soft delete ─────┘
```
Proibidas: `posted → pending`; restaurar transação `merged` cujo sobrevivente está excluído
(restaura-se o sobrevivente antes); qualquer DELETE físico.

### 2.7 `audit_log`

```sql
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
```

- Gravação: trigger `core_audit()` `AFTER INSERT OR UPDATE` em `institutions` (só do dono),
  `accounts`, `transactions`, `categories`, `import_batches` — `SECURITY DEFINER`,
  `search_path=''`, mesma transação (FR-040). `changes` contém apenas colunas alteradas,
  exceto `updated_at`, `name_key`. Ação derivada: `deleted_at` NULL→valor = `soft_delete`
  (ou `merge` se `deleted_reason='merged'`); valor→NULL = `restore`; `archived_at` → `archive`/
  `unarchive`; `status` de lote → `undo_batch`; caso contrário `update` (ou a ação explícita em
  `prumo.action`, ex.: `reassign`, `unlock`).
- Append-only: triggers `audit_log_immutable` `BEFORE UPDATE OR DELETE` e `BEFORE TRUNCATE`
  lançam `core.audit_immutable` para **qualquer** papel; RLS só `SELECT`.
- Nunca contém segredos: tabelas core não têm colunas de credencial (FR-041).

### 2.8 Proibição de DELETE físico (FR-037)

Trigger `core_forbid_delete` `BEFORE DELETE` em `accounts`, `transactions`, `categories`,
`import_batches` e `institutions` (linhas de dono) → `RAISE EXCEPTION 'core.hard_delete_forbidden'`.
Além disso, nenhuma policy RLS de DELETE existe. `updated_at` mantido por trigger
`core_touch_updated_at` em todas as tabelas mutáveis.

## 3. RLS (policies explícitas)

```sql
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;  -- todas as 7 tabelas
ALTER TABLE public.<t> FORCE ROW LEVEL SECURITY;   -- inclusive para o dono da tabela

-- accounts, transactions, categories, import_batches (idem para cada uma)
CREATE POLICY <t>_select ON public.<t> FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY <t>_insert ON public.<t> FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY <t>_update ON public.<t> FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
-- (sem policy de DELETE ⇒ negado)

-- institutions: catálogo legível por autenticados; escrita só nas próprias
CREATE POLICY institutions_select ON public.institutions FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = (SELECT auth.uid()));
CREATE POLICY institutions_insert ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY institutions_update ON public.institutions FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));

-- category_templates: leitura para autenticados; escrita só por migração
CREATE POLICY category_templates_select ON public.category_templates FOR SELECT TO authenticated
  USING (true);

-- audit_log: só leitura das próprias linhas (inserção exclusiva do trigger SECURITY DEFINER)
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;          -- anon nunca lê dado core
REVOKE INSERT, UPDATE, DELETE ON public.audit_log, public.category_templates FROM authenticated;
REVOKE DELETE ON public.accounts, public.transactions, public.categories,
                 public.import_batches, public.institutions FROM authenticated;
```

`service_role` ignora RLS por definição do Supabase: o repositório em modo `service` filtra
por `owner_id` em toda consulta e as funções resolvem o dono por `core_resolve_owner` (R-03);
os triggers de guarda, proteção, auditoria e proibição de DELETE valem também para ele.

## 4. Taxonomia padrão de categorias (Clarificação Q1 — estilo GuiaBolso)

Fonte única: `src/domain/core/default-categories.ts` → migração gerada `category_templates`.
`origin='default'` (editáveis), exceto ⚙ = `origin='system'` (renomeáveis, nunca excluídas).

**Despesas (`expense`) — 15**

| # | Categoria | Subcategorias |
|---|---|---|
| 1 | Alimentação | Mercado · Restaurantes · Delivery · Padaria e café · Lanches |
| 2 | Moradia | Aluguel ou financiamento · Condomínio · Energia · Água · Gás · Internet e TV · Manutenção e reforma · Móveis e decoração |
| 3 | Transporte | Combustível · Aplicativos de transporte · Transporte público · Estacionamento e pedágio · Manutenção do veículo · Seguro, IPVA e licenciamento |
| 4 | Saúde | Plano de saúde · Farmácia · Consultas e exames · Dentista · Academia e esportes |
| 5 | Educação | Cursos · Livros e materiais · Mensalidade escolar |
| 6 | Lazer | Cinema, shows e eventos · Bares e baladas · Hobbies · Jogos |
| 7 | Viagens | Passagens · Hospedagem · Passeios · Câmbio e despesas no exterior |
| 8 | Compras | Roupas e calçados · Eletrônicos · Casa e utilidades · Presentes |
| 9 | Assinaturas e serviços | Streaming · Aplicativos e software · Telefonia celular · Clubes e associações |
| 10 | Cuidados pessoais | Salão e barbearia · Cosméticos e higiene |
| 11 | Pets | Ração e produtos · Veterinário |
| 12 | Família e filhos | Escola e creche · Mesada · Brinquedos e roupas infantis |
| 13 | Impostos, tarifas e juros | ⚙ Tarifas bancárias (`bank_fees`) · Juros e multas · IOF · Impostos (IR, IPTU, outros) · Anuidade de cartão |
| 14 | Doações | Doações · Dízimo e contribuições |
| 15 | Outros gastos | Saques em dinheiro · Diversos |

**Receitas (`income`) — 5**

| # | Categoria | Subcategorias |
|---|---|---|
| 16 | ⚙ Salário (`salary`) | Salário · 13º salário · Férias · PLR e bônus |
| 17 | Renda extra | Freelance · Vendas · Aluguéis recebidos |
| 18 | Rendimentos | Juros e rendimentos · Dividendos · Cashback |
| 19 | Reembolsos | Estornos · Reembolsos de despesas |
| 20 | Outras receitas | Presentes recebidos · Diversos |

**Neutras (`neutral`, não contam como entrada nem saída) — sistema**

| # | Categoria | Uso |
|---|---|---|
| 21 | ⚙ Transferência entre contas (`internal_transfer`) | natureza `internal_transfer` (016) |
| 22 | ⚙ Pagamento de fatura (`card_payment`) | natureza `card_payment` (016/018) |
| 23 | Investimentos | Aplicações · Resgates (movimentação patrimonial; 025/027) |

**Sem categoria** ⚙ (`uncategorized`, `kind='expense'` por convenção de armazenamento):
consumidores MUST classificar transações sem categoria **pelo sinal** (negativo = saída,
positivo = entrada); categoria padrão de destino em exclusões (FR-031) e de degradação da IA
(Constitution VI). Total: 24 categorias de 1º nível e 75 subcategorias.

## 5. Funções do contrato (`core_*`, `SECURITY INVOKER` salvo indicação)

Todas recebem `p_owner_id UUID DEFAULT NULL` (resolvido por `core_resolve_owner`) e
`p_actor JSONB DEFAULT NULL` (publicado em `prumo.actor`). Erros: `RAISE` com mensagem
`core.<código>` (mapeada em contracts/core-store.md §Erros).

| Função | Retorno | Requisitos |
|---|---|---|
| `core_bootstrap_owner()` | `jsonb {created: int}` | FR-029 — idempotente; copia `category_templates` |
| `core_upsert_transactions(p_batch_id, p_rows jsonb)` | `jsonb {created, updated, duplicate, protected, rejected, results[]}` | FR-013–FR-024, R-06/R-08; máx. 1.000 linhas |
| `core_create_manual_transaction(p_row jsonb)` | `transactions` | FR-019 |
| `core_update_transaction(p_id, p_patch jsonb)` | `transactions` | FR-019/020/024 |
| `core_unlock_field(p_id, p_field)` | `transactions` | FR-025 |
| `core_soft_delete_transactions(p_ids uuid[], p_reason, p_merged_into)` | `int` | FR-023/037; desfaz vínculos |
| `core_restore_transactions(p_ids uuid[])` | `int` | US4 cenário 4 |
| `core_create_batch(p jsonb)` / `core_finish_batch(p_id, p_status, p_error)` | `import_batches` | FR-033 |
| `core_find_completed_batch_by_file(p_account_id, p_sha256)` | `import_batches` | FR-034 |
| `core_undo_batch(p_id)` | `jsonb {deleted, withManualEdits}` | FR-035 |
| `core_upsert_account(p jsonb)` / `core_archive_account(p_id, p_archived bool)` | `accounts` | FR-007–FR-012 |
| `core_set_reported_balance(p_account_id, p_cents, p_on)` | `accounts` | FR-010 |
| `core_account_balances(p_as_of DATE)` (STABLE) | `TABLE(account_id, reported_cents, reported_on, computed_cents, computed_at_reported_cents, divergence_cents)` | FR-010, R-09 |
| `core_create_category(p jsonb)` / `core_update_category(p_id, p_patch jsonb)` | `categories` | FR-030 |
| `core_delete_category(p_id, p_target_id, p_children text)` | `jsonb {reassigned}` | FR-031; `p_children IN ('move','delete')` |
| `core_restore_category(p_id)` | `categories` | FR-030 |

### Algoritmo — `core_upsert_transactions` (por linha, em ordem, numa única transação)
1. Validar lote: do dono, `status IN ('processing','in_review')`; senão `core.batch_closed`.
2. Validar linha (conta do dono e não arquivada, tipos, faixas) → falha = `rejected` com
   campo, sem abortar o lote (resultado por linha `{index, outcome, id?, field?}`).
3. `INSERT … ON CONFLICT ON CONSTRAINT tx_identity_uq DO NOTHING RETURNING id` → `created`.
4. Conflito: carregar existente `FOR UPDATE`.
   - existente `pending` e linha difere em fato (valor, data, descrição original, status,
     horário) → `UPDATE` (trigger aplica travas e audita) → `updated`;
   - existente `posted` (ou pendente sem diferença) → atualiza só campos automáticos vazios e
     não travados (`merchant`, `occurred_at`) → `duplicate`;
   - linha tentou mudar campo travado → conta também em `protected`.
   - existente excluída logicamente → permanece excluída → `duplicate`.
5. Atualizar contadores do lote (`count_read += n`, …) e retornar o resumo.

### Algoritmo — `core_account_balances(p_as_of)`
1. Para cada conta do dono: `computed(d) = opening_balance_cents + Σ amount_cents` de
   transações `posted`, não excluídas, com `booked_on ≤ d` e `booked_on ≥ opening_balance_on`
   (se definido).
2. `computed_cents = computed(p_as_of)`; se houver saldo reportado,
   `computed_at_reported_cents = computed(reported_balance_on)` e
   `divergence_cents = reported_balance_cents − computed_at_reported_cents`; senão NULL.

## 6. Tipos de domínio (TypeScript, `src/domain/core/types.ts`)

Espelham as colunas em `camelCase`: `Institution`, `Account`, `Transaction`, `Category`,
`ImportBatch`, `AuditEntry`, `Actor`. Tipos nominais: `Cents` (inteiro seguro), `IsoDate`
(`YYYY-MM-DD` válido), `OwnerId`, `Source`, `AccountType`, `TxStatus`, `TxNature`,
`DeletedReason`, `CategoryKind`, `BatchStatus`. Validação de entrada com zod 4 (schemas em
`src/domain/core/schemas.ts`) — mesmos limites dos `CHECK` acima.

## 7. Adaptação do `SyntheticDataset` v1 (FR-047)

`src/data/core/synthetic-adapter.ts` — `fromSyntheticDataset(ds, ownerId)`:

| SyntheticDataset v1 | Modelo core |
|---|---|
| `institutions[]` (`bank`/`wallet`) | `institutions` do dono (`kind` `bank`/`digital_wallet`), nomes fictícios mantidos |
| `accounts[].type` `checking`/`wallet`/`credit_card` | `checking`/`digital_wallet`/`credit_card`; `source='manual'`; `creditLimitCents`, `closingDay`, `dueDay` copiados |
| — | 1 `import_batch` por conta: `source='ofx'`, `status='completed'`, `initiated_by='system'` |
| `transactions[].id` | `source='ofx'`, `external_id=id`, `identity_key='ext:'+id`, `status='posted'` |
| `amountCents`, `date`, `description` | `amount_cents`, `booked_on`, `description_original` |
| `kind`: `transfer_internal` / `card_bill_payment` / `refund` | `nature`: `internal_transfer` / `card_payment` / `refund`; `transferGroupId` → `related_transaction_id` entre as duas pernas |
| `kind`: `salary`, `subscription`, `fee`, `income_other`, `purchase`/`installment`/`international` | categoria (`category_source='source'`, sem confiança): Salário, Assinaturas e serviços › Streaming/Aplicativos, Tarifas bancárias, Outras receitas, Sem categoria |
| `installment` | `installment_number/total/group` |
| `originalCurrency` | `original_currency`, `original_amount_minor` |

Invariante testada: Σ `amount_cents` do modelo = Σ `amountCents` do dataset (SC-006).

## 8. Volume e desempenho

Perfil do Doug: 5 contas, ~300 transações/mês (~3.600/ano). Meta de projeto: 100 mil
transações (≈ 25 anos) com consulta de 1 mês de todas as contas ≤ 1 s (SC-007), atendida pelo
índice `tx_owner_date_idx` (varredura por faixa de data). Paginação por cursor
`(booked_on, id)` — nunca `OFFSET` grande.
