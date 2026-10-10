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

## Revisão de PRs (feature 002)

- A exceção de bootstrap encerrada em 2026-10-08: seus PRs (`autor:claude` + `iniciativa:N` +
  marco, template de PR) são revisados pelo Gemini Code Assist; responda aos achados em
  comentário `prumo:respostas` e re-acione com `/gemini review`.
- PRs do Gemini: `/revisar-pr <n>` monta o pacote fechado e despacha o subagente
  `revisor-limpo` (só Read/Glob/Grep). A sessão principal **não** lê o diff nem a spec antes do
  veredito; quem publica é o Doug, com `npm run review:publish -- <n>` no terminal dele.
- Nunca integre PR: o merge é do Doug, com `npm run pr:merge -- <n>` (negado nas suas
  permissões em `.claude/settings.json`).
- Mudou um workflow? Rode `npm run review:mirror` e atualize o espelho dos workflows. Mudou jobs
  de PR do CI? Registre no PR para o Doug: rode `npm run gh:ruleset` ao mudar jobs do CI.

<!-- SPECKIT START -->
Plano atual: `specs/001-setup-projeto/plan.md` (stack, estrutura de pastas, comandos).
Ao trabalhar em outra feature, leia o `plan.md` da pasta `specs/NNN-slug/` correspondente.
<!-- SPECKIT END -->
