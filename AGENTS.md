# AGENTS.md — Regras comuns a todos os agentes (Claude, Gemini e outros)

## O projeto em 30 segundos

**Finanças** é um app web pessoal (PWA) de finanças do Doug, no espírito do GuiaBolso:
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
