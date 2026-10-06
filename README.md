# Prumo

Mantenha suas finanças no prumo. App pessoal de finanças (PWA) no espírito do GuiaBolso: Open Finance + importação manual,
categorização com IA, dashboard, orçamento, análise de comportamento, alertas inteligentes,
investimentos e planejamento.

**Construído 100% por Spec-Driven Development (GitHub Spec Kit)** por dois agentes — Claude e
Gemini — em revisão cruzada, com o Doug como product owner.

| Documento | Para quê |
|---|---|
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Regras inegociáveis |
| [`AGENTS.md`](AGENTS.md) | Regras comuns a qualquer agente |
| [`docs/roadmap.md`](docs/roadmap.md) | 32 features, iniciativas, ondas, status |
| [`docs/workflow.md`](docs/workflow.md) | Ciclo de cada feature e gates |
| [`docs/review-checklist.md`](docs/review-checklist.md) | Checklist do revisor independente |
| [`docs/adr/`](docs/adr/) | Decisões de arquitetura |
| [`GEMINI.md`](GEMINI.md) · [`docs/gemini-handoff.md`](docs/gemini-handoff.md) | Onboarding e tarefas do Gemini |
| [`CLAUDE.md`](CLAUDE.md) | Instruções do Claude |

Status: feature 001 (setup) em implementação — ver `docs/roadmap.md`.

## Início rápido

Pré-requisitos: Git, **Node 24 LTS**, **Docker Desktop aberto**, [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.109.
No Windows, use **Git Bash**.

```bash
git clone https://github.com/dougueta/prumo.git && cd prumo
npm ci
npm run dev:setup     # sobe o Supabase local (portas 573xx), aplica migrações e escreve .env.local
npm run dev           # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev:demo` | Sobe em **modo demonstração** (como as pré-visualizações): sem banco, selo "Demonstração" |
| `npm run check` | lint + formatação + tipos + testes unitários |
| `npm run test:integration` | testes contra o Supabase local |
| `npm run test:e2e` | build + Playwright (local e demonstração) |
| `npm run synthetic -- --seed 42` | gera dados sintéticos em `tests/fixtures/synthetic/` |

Problemas comuns:
- `Configuração inválida: SUPABASE_URL…` → rode `npm run dev:setup`.
- `/api/health` com `unreachable` → Docker Desktop fechado ou Supabase parado (`supabase start`).
- `ports are not available` no Windows → porta reservada pelo Hyper-V; veja
  `netsh int ipv4 show excludedportrange protocol=tcp` e ajuste `supabase/config.toml`.

## Custos (teto R$ 0 — Constitution, ADR 0006)

| Serviço | Plano | Uso no Prumo |
|---|---|---|
| Vercel | Hobby (gratuito) | pré-visualização por PR (modo demonstração) e produção |
| Supabase | Free (1 projeto: produção) | banco de produção; pausa após 7 dias sem uso → evitada pelo keepalive diário |
| GitHub Actions | 2.000 min/mês grátis (repo privado) | CI (~4 min por execução) + keepalive (~1 min/dia) |

Qualquer custo recorrente novo precisa estar declarado na spec da feature e aprovado pelo Doug.

### Segredos necessários (GitHub → Settings → Secrets and variables → Actions)

| Segredo | Usado por |
|---|---|
| `PRODUCTION_URL` | `keepalive.yml` |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | job `deploy-db` (migrações de produção) |
