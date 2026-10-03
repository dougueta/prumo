# Fluxo de Trabalho — Spec-Driven Development (Claude × Gemini × Doug)

Este documento é operacional. As regras vêm da constitution
(`.specify/memory/constitution.md`), que prevalece em caso de conflito.

## Papéis

| Quem | Papel |
|---|---|
| **Doug** | Product owner. Responde clarify, aprova spec, plan+tasks e PR. Único que faz merge. |
| **Claude** (Claude Code) | Arquiteto e dev principal: núcleo, dados, segurança, integrações críticas. Revisor dos PRs do Gemini (em contexto limpo). Analista financeiro (diagnóstico mensal). |
| **Gemini** (Gemini CLI / Jules / Code Assist) | Dev das features marcadas "Gemini" no roadmap. Revisor independente dos PRs do Claude (Gemini Code Assist). Pesquisador (Deep Research → `research.md`). Operador do ecossistema Google. |

## Ciclo de uma feature

```
1. SPECIFY   (agente dono)  /speckit-specify  → specs/NNN-slug/spec.md
              usar SEMPRE: --number NNN --short-name <slug> (do roadmap)
              cabeçalho: Iniciativa, Onda, Agente, Dependências
2. CLARIFY   (agente dono)  /speckit-clarify  → perguntas ao Doug, respostas gravadas na spec
   🔒 GATE 1: Doug aprova spec.md                       → roadmap: spec-ok
3. RESEARCH* (Gemini)       Deep Research quando há incerteza externa → specs/NNN-slug/research.md
4. PLAN      (agente dono)  /speckit-plan     → plan.md, research.md, data-model.md, contracts/, quickstart.md
              Constitution Check I–X (antes e depois do design)
5. TASKS     (agente dono)  /speckit-tasks    → tasks.md (testes ANTES da implementação)
6. ANALYZE   (agente dono)  /speckit-analyze  → consistência spec × plan × tasks
   🔒 GATE 2: Doug aprova plan.md + tasks.md            → roadmap: plan-ok
7. IMPLEMENT (agente dono)  /speckit-implement no worktree da feature; commit por task
8. PR        (agente dono)  PR → main usando o template; CI roda
9. REVIEW    (OUTRO agente) checklist docs/review-checklist.md → veredito APROVADO / MUDANÇAS NECESSÁRIAS
              autor responde cada achado (corrige ou justifica tecnicamente)
   🔒 GATE 3: CI verde + APROVADO + Doug aprova → Doug faz merge (squash) → deploy Vercel
10. CLOSE    roadmap: done; milestone da iniciativa atualizado
   * opcional
```

## Paralelismo com git worktrees

Cada feature em implementação vive em seu próprio worktree, irmão do repositório principal:

```bash
# a partir de prumo/ (main atualizada)
git worktree add ../prumo-wt/NNN-slug -b NNN-slug
cd ../prumo-wt/NNN-slug
# ... /speckit-implement ...
# ao terminar (após merge):
git worktree remove ../prumo-wt/NNN-slug
```

Regras:
- **WIP máximo: 3** features em `impl` ao mesmo tempo (somando Claude + Gemini).
- Um worktree = uma feature = um agente. Dois agentes nunca editam o mesmo worktree.
- Só a feature dona altera o schema de uma tabela (Constitution VII). Precisa mudar tabela de
  outra feature? Pare e proponha a mudança na spec da dona.
- Migrações Supabase sempre com timestamp (`supabase migration new <nome>`).
- Antes do PR e antes do merge: `git fetch && git rebase origin/main` + CI verde.
- Specs podem ser adiantadas: o dono escreve specify/clarify de toda a próxima onda e o Doug
  aprova em lote.

## Como o Claude paraleliza

Claude pode despachar subagentes, um por worktree/feature, cada um recebendo apenas:
spec/plan/tasks da feature + constitution + AGENTS.md. Revisões de PRs do Gemini são feitas
por um subagente **sem histórico** (contexto limpo), aplicando `docs/review-checklist.md`.

## Como o Gemini participa

Ver `GEMINI.md` (onboarding completo) e `docs/gemini-handoff.md` (tarefas atuais).

## Convenções

- Branch/pasta: `NNN-slug` (ex.: `004-modelo-dados-core`).
- Commits: Conventional Commits, referenciando a task: `feat(004): T012 cria tabela transactions`.
- PR: título `NNN · <Feature>`; corpo pelo template `.github/pull_request_template.md` (criado pela feature 002);
  rótulo do agente autor (`autor:claude` / `autor:gemini`) e da iniciativa.
- Cada iniciativa = um Milestone no GitHub.
- Decisões que atravessam features = ADR em `docs/adr/NNNN-titulo.md`.
