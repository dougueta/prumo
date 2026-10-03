# Research — 001 · Setup do Projeto

Versões verificadas em 2026-10-02 via `npm view`.

## R-01 · Framework e linguagem
- **Decision**: Next.js 16.3 (App Router) + React 19.3 + **TypeScript 5.9.3** (strict).
- **Rationale**: stack da constitution. TypeScript 7.0 já existe, mas `typescript-eslint` 8.71
  exige `typescript >=4.8.4 <6.1.0` → fixar 5.9 até o ecossistema suportar 7.
- **Alternatives**: TS 7 (quebra o lint tipado); Vite SPA (perde RSC/rotas de servidor).

## R-02 · Gerenciador de pacotes e runtime
- **Decision**: npm 10 + Node 24 LTS (local e CI), `engines` fixado, `.nvmrc`.
- **Rationale**: já instalado na máquina do Doug; zero ferramenta extra para o Gemini.
- **Alternatives**: pnpm (mais rápido, mas mais uma ferramenta para dois agentes).

## R-03 · Ambientes e dados (ADR 0006)
- **Decision**:
  - `local`: Supabase CLI 2.119 (`supabase start`, Docker Desktop).
  - `CI`: Supabase CLI no job do GitHub Actions (`supabase/setup-cli` + `supabase start`),
    destruído ao final.
  - `preview`: **modo demonstração** — nenhuma variável de Supabase configurada no ambiente
    Preview da Vercel; o app detecta `APP_ENV=preview` e usa dados sintéticos em memória.
  - `production`: projeto Supabase gratuito (região `sa-east-1`), criado na implementação.
- **Rationale**: custo R$ 0; isolamento total de dados reais.
- **Alternatives**: Supabase Pro/branching (custo), projeto único com schemas (risco a dados reais).

## R-04 · Detecção de ambiente
- **Decision**: variável explícita `APP_ENV` (`local|preview|production`) validada na
  inicialização; em CI, `APP_ENV=local`. `VERCEL_ENV` usado só como verificação cruzada: se
  `VERCEL_ENV=preview` e `APP_ENV≠preview` → falha de inicialização.
- **Rationale**: impede por construção que um preview use configuração de produção.

## R-05 · Validação de configuração (FR-003/FR-004)
- **Decision**: `zod` 4 em `src/lib/env.ts`, com esquema por ambiente (preview não exige
  Supabase; local/production exigem). Erro lista **nomes** das variáveis inválidas, nunca valores.
- **Alternatives**: `@t3-oss/env-nextjs` (açúcar sobre zod; dependência extra desnecessária).

## R-06 · Cliente Supabase
- **Decision**: `@supabase/supabase-js` 2.117; na 001
  só há cliente de servidor (`server-only`) com `SUPABASE_URL` + `SUPABASE_SECRET_KEY` lidos em
  runtime. *Desvio*: sem `NEXT_PUBLIC_SUPABASE_*` (embutidas no build; ver data-model §3).
- **Health**: função SQL `public.health_ping()` (migração desta feature) chamada via RPC.

## R-07 · Proteção de acesso provisória (FR-013)
- **Decision**:
  - Previews: **Vercel Authentication** (Standard Protection) — só membros do time `doug-lab`.
  - Produção: trava no app via `src/proxy.ts` (Next 16) com HTTP Basic Auth
    (`PRODUCTION_GATE_USER`/`PRODUCTION_GATE_PASSWORD`, comparação em tempo constante),
    exceto `/api/health`, manifesto, ícones e service worker. Removida pela feature 006.
- **Rationale**: no plano gratuito a proteção nativa cobre previews e URLs de deployment, mas
  não necessariamente o domínio de produção; a trava no app funciona em qualquer plano.

## R-08 · PWA (FR-019/FR-020)
- **Decision (revisada na implementação)**: manifesto nativo do Next (`app/manifest.ts`) +
  **service worker próprio** `public/sw.js` (~30 linhas): precache de `/~offline` e ícones;
  navegação network-first com fallback para `/~offline`. Sem cache de dados financeiros.
- **Rationale da revisão**: a spec exige só a página offline; a doc do Next 16 cita Serwist como
  *opção* para cache offline completo — dependência desnecessária hoje (Constitution X).
  Serwist volta à mesa se uma feature futura pedir cache offline de dados.
- **Alternatives**: `next-pwa` (abandonado); service worker manual (mais código para manter).

## R-09 · Qualidade e testes
- **Decision**: ESLint 9 (versão do scaffold `create-next-app` 16.3.8; plugins do Next ainda não
  validados com 10) (flat config + `eslint-config-next` 16 + `typescript-eslint`),
  Prettier 3.9, `tsc --noEmit`, Vitest 5 (unit + integração), Testing Library 16, jsdom 29 (o 30 exige Node ≥ 24.15),
  Playwright 1.63 (E2E, Chromium no CI + emulação mobile).
- **Integração**: roda contra o Supabase do CI. **E2E**: `next build && next start` contra o
  Supabase do CI, mais um projeto E2E com `APP_ENV=preview` para validar o modo demonstração.
- **Externos**: nenhum nesta feature; padrão MSW fica para as features com integrações.

## R-10 · CI/CD
- **Decision**: GitHub Actions `ci.yml` em `pull_request` e `push` na `main`: jobs paralelos
  `quality` (lint, format, typecheck), `unit`, `integration` (Supabase), `e2e` (Supabase +
  Playwright; artefato do relatório). Deploy: integração Git da Vercel (preview por PR,
  produção na `main`). Migrações de produção aplicadas por job `deploy-db` na `main`
  (`supabase db push`) com segredos do GitHub.
- **Meta**: ≤ 10 min (SC-003) — cache de npm, browsers do Playwright e imagens Docker.

## R-11 · Pausa por inatividade (FR-023)
- **Decision**: workflow agendado `keepalive.yml` (diário, 09:00 BRT) chama
  `GET /api/health` da produção, que executa `health_ping()` no banco (gera atividade). Se a
  resposta não for `ok`, o job falha e o GitHub envia e-mail ao Doug (notificação padrão de
  workflow agendado com falha).
- **Rationale**: R$ 0, sem serviço extra, aviso em ≤ 24 h.

## R-12 · Gerador de dados sintéticos (FR-014–FR-018)
- **Decision**: módulo TypeScript `src/synthetic/` com PRNG próprio por semente
  (mulberry32) + `@faker-js/faker` 10 (locale `pt_BR`, `faker.seed(semente)`); CLI
  `npm run synthetic -- --seed 42 --months 12 --out tests/fixtures/synthetic`.
  Saídas: `dataset.json` (formato próprio, ver data-model), `extrato-*.csv`, `extrato-*.ofx`
  (OFX 2.x XML). Instituições com **nomes fictícios** ("Banco Aurora (simulado)" etc.),
  descrições com estabelecimentos fictícios; todo registro com `synthetic: true`.
- **Rationale**: determinismo exige PRNG controlado e data base fixa (`--anchor-date`, padrão
  `2026-09-30`), nunca `Date.now()`.
- **Recusa em produção**: CLI aborta se `APP_ENV=production`.

## R-13 · Fuso e localidade
- **Decision**: `Intl` com `pt-BR` e `America/Sao_Paulo`; datas de negócio como string
  `YYYY-MM-DD`; `TZ=America/Sao_Paulo` nos testes para reprodutibilidade.
