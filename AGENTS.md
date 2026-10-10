# AGENTS.md — Regras comuns a todos os agentes (Claude, Gemini e outros)

## O projeto em 30 segundos

**Prumo** é um app web pessoal (PWA) de finanças do Doug, no espírito do GuiaBolso:
consolida contas e cartões via Open Finance (Pluggy) e importação manual (CSV/OFX/PDF),
categoriza com IA, mostra dashboard, orçamento, análise de comportamento, alertas
inteligentes, investimentos (manual + Google Sheets) e planejamento.

Stack: Next.js (App Router) + TypeScript · Supabase · Vercel · Pluggy · Gemini API ·
shadcn/ui + Tailwind · Vitest + Playwright.

## Leitura obrigatória, nesta ordem

1. `.specify/memory/constitution.md` — regras inegociáveis (princípios I–X).
2. `docs/workflow.md` — ciclo da feature, gates, worktrees, convenções.
3. `docs/roadmap.md` — números, dependências, ondas, quem implementa o quê, status.
4. `docs/review-checklist.md` — o que o revisor vai cobrar de você.
5. `docs/adr/` — decisões de arquitetura já tomadas (não as reabra sem ADR nova).
6. A pasta `specs/NNN-slug/` da feature em que você está trabalhando.

## Regras de ouro

1. **Nada fora do SDD.** Sem spec aprovada, sem código. Sem exceção.
2. **Use o número do roadmap.** `--number NNN --short-name <slug>`; nunca numeração automática.
3. **Uma feature por worktree, um agente por worktree.**
4. **Respeite os gates do Doug** (spec → plan+tasks → PR). Não avance sem aprovação explícita.
5. **Quem escreve não revisa.** Claude ↔ Gemini em revisão cruzada.
6. **Dinheiro em centavos inteiros. RLS em toda tabela. Zero segredo ou dado real no repo.**
7. **Não altere o schema de tabela que sua feature não possui.**
8. **Atualize o status no `docs/roadmap.md`** a cada transição.
9. **Dúvida de produto → pergunte ao Doug** (via clarify). Dúvida técnica externa → research.
10. Idioma: documentação e specs em **português**; código, identificadores e commits em inglês
    (mensagens de commit podem ter descrição em português).

## Comandos Spec Kit

| Ação | Claude Code | Gemini CLI |
|---|---|---|
| Especificar | `/speckit-specify` | `/speckit.specify` |
| Esclarecer | `/speckit-clarify` | `/speckit.clarify` |
| Planejar | `/speckit-plan` | `/speckit.plan` |
| Tarefas | `/speckit-tasks` | `/speckit.tasks` |
| Analisar consistência | `/speckit-analyze` | `/speckit.analyze` |
| Implementar | `/speckit-implement` | `/speckit.implement` |

## Revisão de PRs e merge (Constitution VIII · feature 002)

A exceção de bootstrap encerrada em 2026-10-08 (a partir do merge da 002): todo PR passa pela
verificação **"Revisão independente"** e pelo ruleset da `main`. Detalhes em `docs/workflow.md`.

- Todo PR leva exatamente um rótulo `autor:claude` / `autor:gemini` / `autor:doug` e, se for de
  feature, `iniciativa:N` + o marco da iniciativa. Use o template de PR.
- Todo commit leva o trailer do agente: `Co-Authored-By: Claude …` (Claude) ou
  `Co-Authored-By: Gemini <noreply@google.com>` (Gemini). Um PR = um agente.
- Responda aos achados em **comentário** com o bloco `<!-- prumo:respostas v1 -->`.
- **Agentes nunca integram PR, nunca publicam veredito em nome do revisor, nunca aplicam o
  rótulo `emergencia` e nunca alteram rótulos/status/ruleset pela API.** O merge é do Doug, com
  `npm run pr:merge -- <n>`.
- Mudou um workflow? Rode `npm run review:mirror` e atualize o espelho dos workflows no mesmo PR.
- Mudou jobs de PR do `ci.yml`? Avise o Doug no PR: ele deve rodar `npm run gh:ruleset` depois
  do merge (rode `npm run gh:ruleset` ao mudar jobs do CI — tarefa do Doug).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
