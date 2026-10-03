# Data Model — 001 · Setup do Projeto

Esta feature **não cria tabelas de finanças** (dona: 004). Ela define apenas: o catálogo de
configuração, o status de saúde, a função de banco de saúde e o formato do conjunto de dados
sintéticos que a 004 adaptará.

## 1. Banco (dona: 001)

### Função `public.health_ping()`
```sql
CREATE OR REPLACE FUNCTION public.health_ping()
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY INVOKER
AS $$ SELECT now() $$;
REVOKE ALL ON FUNCTION public.health_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_ping() TO anon, authenticated, service_role;
```
- Sem tabelas, sem dados. Migração: `supabase/migrations/<timestamp>_health_ping.sql`.
- RLS: não se aplica (nenhuma tabela). Nenhuma outra migração nesta feature.

## 2. Ambiente (`AppEnv`)

| Valor | Banco | Proteção de acesso | Dados |
|---|---|---|---|
| `local` | Supabase local (Docker) / Supabase do CI | nenhuma | sintéticos |
| `preview` | **nenhum** | Vercel Authentication | sintéticos em memória |
| `production` | Supabase hospedado | trava Basic Auth (até a 006) | reais (a partir das features de dados) |

Transições proibidas: `preview` com qualquer variável `SUPABASE_*` definida → falha de
inicialização. `VERCEL_ENV=preview` com `APP_ENV≠preview` → falha.

## 3. Catálogo de configuração (`.env.example`)

| Nome | Ambientes | Segredo | Descrição |
|---|---|---|---|
| `APP_ENV` | todos | não | `local` \| `preview` \| `production` |
| `NEXT_PUBLIC_APP_VERSION` | todos | não | versão (preenchida no build a partir do commit) |
| `NEXT_PUBLIC_SUPABASE_URL` | local, production | não | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | local, production | não | chave publicável |
| `SUPABASE_SECRET_KEY` | local, production | **sim** | chave secreta (só servidor) |
| `PRODUCTION_GATE_USER` | production | **sim** | usuário da trava provisória |
| `PRODUCTION_GATE_PASSWORD` | production | **sim** | senha da trava provisória (≥ 20 caracteres) |

Regras de validação (zod): URLs válidas; chaves não vazias; `PRODUCTION_GATE_PASSWORD.length
>= 20`; em `preview`, `SUPABASE_*` MUST estar ausentes.

## 4. Status de saúde (`HealthStatus`)

| Campo | Tipo | Regra |
|---|---|---|
| `status` | `"ok" \| "degraded"` | `degraded` se `data.status ≠ ok` |
| `version` | string | `NEXT_PUBLIC_APP_VERSION` |
| `environment` | `AppEnv` | |
| `data.status` | `"ok" \| "unreachable" \| "demo"` | `demo` em preview |
| `data.latencyMs` | inteiro ≥ 0 \| null | null em demo/unreachable |
| `checkedAt` | string ISO-8601 UTC | |

Nunca inclui URLs, chaves, nomes de host ou mensagens de erro do banco.

## 5. Conjunto de dados sintéticos (`SyntheticDataset` — formato próprio, v1)

```ts
type SyntheticDataset = {
  schemaVersion: 1;
  synthetic: true;
  seed: number;
  anchorDate: string;            // YYYY-MM-DD (último dia coberto)
  months: number;                // >= 12
  institutions: { id: string; name: string; kind: "bank" | "wallet" }[];
  accounts: {
    id: string; institutionId: string; name: string;
    type: "checking" | "wallet" | "credit_card";
    receivesSalary: boolean;
    creditLimitCents?: number;   // inteiro
    closingDay?: number; dueDay?: number; // cartões
  }[];
  transactions: {
    id: string;                  // determinístico: `${seed}-${n}`
    accountId: string;
    date: string;                // YYYY-MM-DD, America/Sao_Paulo
    description: string;         // fictícia
    amountCents: number;         // inteiro com sinal; negativo = saída
    kind: "salary" | "purchase" | "subscription" | "installment" | "transfer_internal"
        | "card_bill_payment" | "refund" | "international" | "fee" | "income_other";
    installment?: { number: number; total: number; groupId: string };
    transferGroupId?: string;    // liga as duas pernas de transferência/pagamento de fatura
    originalCurrency?: { code: string; amountMinor: number }; // compras internacionais
    synthetic: true;
  }[];
};
```

Invariantes (testadas): todos os valores são inteiros; cada `transferGroupId` tem exatamente
duas pernas de soma zero; parcelas `number` 1..`total` mensais consecutivas; ≥ 5 assinaturas
recorrentes; ≥ 3 grupos de parcelas; ≥ 1 estorno; ≥ 1 internacional; 2 contas com
`receivesSalary`; 1 carteira; 2 cartões; mesma semente ⇒ JSON byte a byte idêntico.

Perfil (espelha o Doug, com nomes fictícios): "Banco Aurora (simulado)" e "Banco Horizonte
(simulado)" recebem salário; "Carteira Pix (simulada)"; cartões "Cartão Órbita (simulado)"
(maior volume) e "Cartão Horizonte (simulado)".
