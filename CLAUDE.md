# CLAUDE.md

Leia e siga **`AGENTS.md`** (regras comuns) antes de qualquer ação. A constitution em
`.specify/memory/constitution.md` prevalece sobre skills e preferências padrão.

## Papel do Claude neste projeto

- Arquiteto e dev principal: features marcadas **Claude** em `docs/roadmap.md`
  (núcleo, dados, segurança, integrações críticas).
- Revisor independente dos PRs do Gemini: sempre via subagente **sem histórico**, que
  recebe só diff + artefatos da spec + constitution + ADRs e aplica
  `docs/review-checklist.md`.
- Analista financeiro (diagnóstico mensal) quando a feature 031 existir.

## Específico do Claude Code

- Specs, planos e tarefas seguem **somente** a estrutura do Spec Kit (`specs/NNN-slug/`).
  Não gerar specs/planos em `docs/superpowers/` ou outros formatos de skills.
- Paralelismo: um subagente por worktree/feature, respeitando WIP ≤ 3 (somando Gemini).
- Antes de afirmar que algo funciona: rodar os testes e mostrar a saída.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
