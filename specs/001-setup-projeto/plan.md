# Implementation Plan: Setup do Projeto Prumo

**Branch**: `001-setup-projeto` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-setup-projeto/spec.md`

## Summary

Criar a base executável do Prumo: app Next.js 16 (TypeScript strict) com tela inicial mínima,
verificação de saúde, validação de configuração por ambiente, quatro ambientes (local com
Supabase em Docker, CI com Supabase efêmero, preview em **modo demonstração** sem banco,
produção no Supabase gratuito), CI completo no GitHub Actions, deploy via Vercel, trava
provisória de acesso, PWA instalável com página offline, keepalive diário e um gerador de
dados sintéticos determinístico (JSON/CSV/OFX). Detalhes e escolhas em [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS
**Primary Dependencies**: Next.js 16.3, React 19.3, Tailwind 4.3, @supabase/supabase-js 2.117,
zod 4.6, @faker-js/faker 10.6 (dev); service worker próprio (sem Serwist — ver research R-08)
**Storage**: Supabase Postgres — apenas a função `health_ping()` nesta feature
**Testing**: Vitest 5 + Testing Library 16 (unit/integração), Playwright 1.63 (E2E)
**Target Platform**: Web/PWA — Chrome Android, Safari iOS, desktop; deploy Vercel (Hobby)
**Project Type**: web app (Next.js full-stack, projeto único)
**Performance Goals**: CI ≤ 10 min; tela inicial interativa ≤ 2 s em 4G; gerador 12 meses ≤ 30 s
**Constraints**: custo R$ 0; preview sem banco; nenhum segredo no client; Windows + Linux
**Scale/Scope**: 1 usuário; ~6 rotas nesta feature; base para 31 features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Tudo deriva da spec 001 aprovada (Gate 1); branch `001-setup-projeto` | ✅ |
| II. Privacidade | Segredos só em env de servidor; `server-only`; `.env*` no `.gitignore`; preview sem banco; trava em produção; dados sintéticos fictícios | ✅ |
| III. Dinheiro exato | Gerador produz só inteiros em centavos (teste de invariante) | ✅ |
| IV. Rastreabilidade | N/A (sem transações reais); dataset traz `synthetic: true` e ids determinísticos | ✅ |
| V. Test-first | Tasks ordenadas teste → implementação; CI bloqueante | ✅ |
| VI. IA assistente | N/A — sem IA nesta feature | ✅ |
| VII. Donos de dados / demo | Única migração: função `health_ping` (dona 001); modo demonstração implementado na base | ✅ |
| VIII. Revisão independente | PR `autor:claude` → revisão Gemini (exceção de bootstrap até a 002) | ✅ |
| IX. Qualidade dos artefatos | data-model tipado, contracts OpenAPI, Gherkin abaixo, estrutura e libs definidas | ✅ |
| X. Simplicidade | Projeto único; sem monorepo; sem libs de env/estado extras | ✅ |
| Custo R$ 0 | Vercel Hobby, Supabase Free, GitHub Actions (repo privado: 2.000 min/mês grátis — estimativa ~400 min/mês) | ✅ |

**Re-check pós-design**: ✅ sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-setup-projeto/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (health.openapi.yaml · production-gate.md · synthetic-cli.md)
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx              # html lang=pt-BR, tema por sistema, DemoBadge
│   ├── page.tsx                # tela inicial "Prumo" (mínima; shell real = feature 003)
│   ├── manifest.ts             # PWA manifest
│   ├── ~offline/page.tsx       # "Você está sem conexão"
│   └── api/health/route.ts     # contrato health.openapi.yaml
├── proxy.ts                    # trava provisória de produção (contrato production-gate)
├── lib/
│   ├── env.ts                  # schema zod por ambiente + loadEnv() (FR-003)
│   ├── app-env.ts              # getAppEnv(), isDemo()
│   ├── health.ts               # checkHealth(deps) — puro, testável
│   ├── supabase/server.ts      # cliente servidor (server-only)
│   └── format.ts               # Intl pt-BR / America/Sao_Paulo
├── components/demo-badge.tsx   # "Demonstração — dados fictícios"
└── synthetic/
    ├── prng.ts                 # mulberry32
    ├── profile.ts              # perfil (instituições/contas fictícias)
    ├── generate.ts             # generateDataset() — puro
    ├── export-csv.ts · export-ofx.ts
    └── cli.ts                  # contrato synthetic-cli
public/icons/                   # ícones PWA (192, 512, maskable, apple-touch)
public/sw.js                    # service worker: precache /~offline + fallback de navegação
supabase/
├── config.toml
└── migrations/<ts>_health_ping.sql
tests/
├── unit/                       # env, app-env, health, prng, generate, exporters, gate
├── integration/                # health_ping no Supabase do CI; /api/health real
├── e2e/                        # home, health, offline, demo (APP_ENV=preview), gate
└── fixtures/synthetic/         # saída versionada do gerador (seed 42)
.github/workflows/
├── ci.yml                      # quality · unit · integration · e2e · deploy-db (main)
└── keepalive.yml               # diário 12:00 UTC → /api/health produção
.env.example · .nvmrc · eslint.config.mjs · prettier.config.mjs · vitest.config.ts
playwright.config.ts · next.config.ts · tsconfig.json · README (seção "Início rápido")
```

**Structure Decision**: projeto Next.js único. Domínio de finanças entra a partir da 004 em
`src/domain/` + `src/data/` (repositórios Supabase/memória) — não criado agora (YAGNI).

## Design Detalhado

### Algoritmo — `loadEnv()` (FR-003)
1. Ler `APP_ENV`; ausente/ inválido → erro `Configuração inválida: APP_ENV`.
2. Se `VERCEL_ENV === "preview"` e `APP_ENV !== "preview"` → erro (proteção cruzada).
3. Selecionar schema: `preview` (proíbe `SUPABASE_*`), `local`/`production` (exige Supabase),
   `production` (exige também `PRODUCTION_GATE_*`, senha ≥ 20).
4. `safeParse`; em falha, lançar `Error` cuja mensagem lista **somente os nomes** dos campos
   e aponta `README#início-rápido`. Executado em `instrumentation.ts` (falha no boot) e
   memoizado.

### Algoritmo — `checkHealth({ appEnv, ping, now, version })` (FR-002)
1. `appEnv === "preview"` → `{status: ok, data: {status: demo, latencyMs: null}}`.
2. Senão, medir `ping()` com timeout 3 s → sucesso `{ok, latencyMs}`; erro/timeout
   `{status: degraded, data: {status: unreachable, latencyMs: null}}` (HTTP 503).
3. Nunca propagar mensagem do erro.

### Máquina de estados — Saúde
`ok ⇄ degraded` conforme cada verificação; não há estado persistido. Proibido: `demo` fora de
preview; `ok` com `data.status = unreachable`.

### Algoritmo — `generateDataset({ seed, months, anchorDate })` (FR-014)
1. `rng = mulberry32(seed)`; `faker.seed(seed)`; meses = janela que termina em `anchorDate`.
2. Instituições/contas do `profile.ts` (fixas).
3. Por mês: salário dividido nas 2 contas (dia 5 e 20); 5–7 assinaturas fixas (mesmo dia/valor,
   1 reajuste no período); 30–60 compras distribuídas (70% Cartão Órbita); transferências
   internas para a carteira (2 pernas, `transferGroupId`); pagamento de cada fatura no
   vencimento (2 pernas: conta → cartão); tarifas ocasionais.
4. Eventos no período: ≥ 3 compras parceladas (3x–10x), ≥ 1 estorno, ≥ 1 internacional (USD).
5. Ordenar por (data, accountId, sequência); ids `${seed}-${n}`; validar invariantes do
   data-model antes de retornar (falha = bug).

### Padrões e bibliotecas
- **Permitidas**: as do Technical Context + `server-only`, `clsx`.
- **Proibidas**: libs de estado global (Redux/Zustand) nesta feature; `moment`; float para
  dinheiro; acesso a `process.env` fora de `src/lib/env.ts`.
- Funções puras injetáveis (`checkHealth`, `generateDataset`) para teste sem rede.

### Critérios de aceite (Gherkin, com verificação de dados)

```gherkin
Funcionalidade: Saúde e ambientes
  Cenário: Saúde em produção com banco disponível
    Dado APP_ENV=production e o Supabase acessível
    Quando faço GET /api/health
    Então recebo 200 com status "ok", environment "production" e data.status "ok"
    E a função public.health_ping() foi executada no banco
    E o corpo não contém a URL do Supabase nem nenhuma chave

  Cenário: Preview em modo demonstração
    Dado APP_ENV=preview e nenhuma variável SUPABASE_* definida
    Quando abro a tela inicial
    Então vejo o selo "Demonstração — dados fictícios"
    E GET /api/health retorna data.status "demo"

  Cenário: Preview mal configurado
    Dado VERCEL_ENV=preview e APP_ENV=production
    Quando o app inicia
    Então a inicialização falha citando "APP_ENV" sem exibir valores

  Cenário: Banco inacessível
    Dado APP_ENV=local e o Supabase parado
    Quando faço GET /api/health
    Então recebo 503 com status "degraded" e data.status "unreachable"

Funcionalidade: Trava provisória de produção
  Cenário: Acesso sem credenciais
    Dado APP_ENV=production
    Quando abro "/" sem Authorization
    Então recebo 401 com WWW-Authenticate Basic
  Cenário: Health isento
    Quando faço GET /api/health sem credenciais
    Então recebo 200 ou 503, nunca 401

Funcionalidade: Dados sintéticos
  Cenário: Determinismo
    Dado a semente 42
    Quando gero o dataset duas vezes
    Então os dois JSON são idênticos byte a byte
  Cenário: Recusa em produção
    Dado APP_ENV=production
    Quando executo npm run synthetic
    Então o processo termina com código 2 e a mensagem de recusa
```

## Ações externas na implementação (exigem confirmação do Doug no momento)
1. Criar projeto Supabase gratuito `prumo` (sa-east-1) na org `doug_lab` — custo R$ 0.
2. Criar projeto Vercel `prumo` no time `doug-lab`, ligar ao repo, configurar envs por ambiente
   e Vercel Authentication para previews.
3. Cadastrar segredos no GitHub (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
   `SUPABASE_PROJECT_REF`, `PRODUCTION_URL`).

## Complexity Tracking

Nenhuma violação.
