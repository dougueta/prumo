<!-- Modelo de PR do Prumo (feature 002 · FR-021). Preencha todas as seções. -->

## Feature

NNN · Nome <!-- ex.: 004 · Modelo de dados core (número e nome do docs/roadmap.md) -->

## Artefatos

- Spec: `specs/NNN-slug/spec.md`
- Plano: `specs/NNN-slug/plan.md`
- Tarefas: `specs/NNN-slug/tasks.md`

<!-- PR de processo (só docs/, arquivos de agentes, .specify/, .gemini/, .claude/): escreva "não se aplica". -->

## Tipo

<!-- Marque um. O portão deriva o tipo dos arquivos alterados; isto é informativo. -->

- feature
- processo (só documentação de processo / arquivos de agentes)
- emenda da constitution (versão + Sync Impact Report atualizados no próprio arquivo)

## Rótulos

- Exatamente um rótulo de autor: `autor:claude` · `autor:gemini` · `autor:doug`
- PR de feature: `iniciativa:N` (N = número da iniciativa) e o marco da iniciativa
- `emergencia`: **só o Doug aplica**; nunca em PR que altere a constitution ou os mecanismos de revisão

Motivo da emergência: <!-- só em PR com rótulo emergencia: descreva o incidente de produção (≥ 20 caracteres) -->

## Checklist do autor

- [ ] Testes escritos antes da implementação (Red → Green)
- [ ] Verificações automáticas verdes (lint, formato, tipos, unitários, integração, E2E)
- [ ] Sem segredo nem dado real (código, fixtures, logs, prints)
- [ ] Rebase na `main` feito
- [ ] Todos os FRs cobertos por implementação e teste
- [ ] Mudou workflow: espelho dos workflows atualizado (`npm run review:mirror`)
- [ ] `gh:ruleset` reexecutado se mudou job do CI (avisar o Doug: `npm run gh:ruleset` após o merge)

## Respostas aos achados

Esta seção é só instrução: **o corpo do PR não é lido como resposta**. Depois de um veredito
MUDANÇAS NECESSÁRIAS, publique a resposta em um **comentário** no PR, uma linha por achado
(`corrigido` + sha do commit, ou `justificado` + justificativa técnica), e peça nova revisão
(`/gemini review` ou `/revisar-pr <n>`):

```markdown
<!-- prumo:respostas v1 -->
## Respostas aos achados
| # | Ação | Commit ou justificativa |
|---|---|---|
| 1 | corrigido | 3f2a9c1 |
| 2 | justificado | O FR-012 dispensa spec para PR de processo; o arquivo está em docs/. |
```
