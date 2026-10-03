# ADR 0001 — SDD com GitHub Spec Kit e dois agentes em revisão cruzada

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug

## Contexto
O projeto será construído por dois agentes de IA (Claude e Gemini) e precisa de
rastreabilidade total, sem código criado fora de especificação.

## Decisão
- Spec-Driven Development com **GitHub Spec Kit**; uma spec por feature, agrupadas por
  iniciativa (`docs/roadmap.md`), números fixos.
- Integrações Spec Kit instaladas para Claude Code e Gemini CLI.
- **Revisão cruzada**: PR do Claude revisado pelo Gemini (Code Assist); PR do Gemini revisado
  por Claude em contexto limpo. Merge só com CI verde + APROVADO + Doug.
- Paralelismo por ondas de dependência em git worktrees, WIP ≤ 3.

## Alternativas rejeitadas
- Processo próprio de specs em Markdown: menos padronizado, sem tooling para os dois agentes.
- Revisor do mesmo modelo/contexto do autor: compartilha pontos cegos.
- Fila única sequencial: lenta; paralelismo controlado é viável com contratos core.

## Consequências
Mais cerimônia por feature; em troca, qualquer agente consegue retomar qualquer feature
apenas lendo o repositório.
