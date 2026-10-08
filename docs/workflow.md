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
              autor responde cada achado em comentário prumo:respostas (corrige ou justifica)
   🔒 GATE 3: CI verde + "Revisão independente" verde + Doug → npm run pr:merge (squash) → deploy Vercel
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
- PR: título `NNN · <Feature>`; corpo pelo template `.github/pull_request_template.md`;
  rótulo do agente autor (`autor:claude` / `autor:gemini` / `autor:doug`) e `iniciativa:N`.
- Cada iniciativa = um Milestone no GitHub.
- Decisões que atravessam features = ADR em `docs/adr/NNNN-titulo.md`.

## Revisão de PRs e merge (feature 002)

A **exceção de bootstrap encerrada em 2026-10-08** (vale a partir do merge do PR da 002, o
último integrado sob ela): todo PR — inclusive de documentação de processo — passa pela
verificação **"Revisão independente"** e pelo ruleset **"main protegida"** (ADR 0007).

- **Rótulos obrigatórios**: exatamente um `autor:claude` / `autor:gemini` / `autor:doug` e, em PR
  de feature, `iniciativa:N` (N = número da iniciativa no roadmap) + o marco da iniciativa.
- **Trailers de autoria** em todo commit: `Co-Authored-By: Claude …` ou
  `Co-Authored-By: Gemini <noreply@google.com>`. Commits de dois agentes no mesmo PR ou trailer
  que contradiz o rótulo reprovam o PR.
- **Revisores**: PR `autor:claude`/`autor:doug` → Gemini Code Assist (automático ao ficar pronto;
  re-acione com `/gemini review`). PR `autor:gemini` → `/revisar-pr <n>` no Claude Code +
  `npm run review:publish -- <n>` no terminal do Doug (senha da chave do app `prumo-revisor`).
- **Resposta aos achados**: em **comentário** no PR com o bloco `<!-- prumo:respostas v1 -->`
  (uma linha por achado: `corrigido` + sha, ou `justificado` + justificativa técnica). O corpo
  do PR não conta como resposta.
- **Merge só pelo Doug**: `npm run pr:merge -- <n>` (recalcula o portão, exige terminal e as
  confirmações; squash). Agentes nunca integram PR.
- **Rebase neutro**: rebase na `main` que não muda o conteúdo do PR mantém o veredito; se muda,
  peça nova revisão.
- **Emergência**: só o Doug aplica o rótulo `emergencia` e escreve `Motivo da emergência:` no
  corpo; nunca em PR que altera a constitution ou os mecanismos de revisão. Revisão pós-merge em
  até 7 dias (issue "Revisão pós-merge pendente"; depois do prazo, `VENCIDA —`).
- **Mudou um workflow?** Rode `npm run review:mirror` e atualize o espelho dos workflows
  (`tests/unit/review/__snapshots__/workflows.md`) no mesmo PR — é por ele que o Gemini revisa.
- **Mudou jobs de PR do `ci.yml`?** Depois do merge, o Doug executa: rode `npm run gh:ruleset` ao mudar jobs do CI.
- **PRs de terceiros** (outra conta ou fork) não são aceitos: o portão bloqueia.
