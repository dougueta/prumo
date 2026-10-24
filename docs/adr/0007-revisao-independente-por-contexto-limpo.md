# ADR 0007 — Revisão independente por subagente Claude em contexto limpo

- **Status**: Aceita · **Data**: 2026-10-24 · **Decisor**: Doug
- **Substitui em parte**: ADR 0001 (revisão cruzada Claude ↔ Gemini)

## Contexto
A ADR 0001 previa que os PRs do Claude fossem revisados pelo Gemini Code Assist no GitHub.
O Google encerrou a versão consumer (gratuita) do app em 2026-07-17; desde 2026-06-18 não é
possível concluir a instalação. A versão enterprise exige projeto no Google Cloud com
faturamento e está em preview. Sem revisor, nenhum PR do Claude pode ser integrado
(Constitution VIII) — o PR #11 ficou parado e o PR #9 entrou sem veredito.

## Decisão
- Todo PR (do Claude e do Gemini) é revisado por um **subagente Claude novo e sem histórico**,
  que recebe só o pacote de revisão (diff, artefatos da spec, constitution, ADRs,
  `docs/review-checklist.md`) e emite o veredito no PR.
- O Gemini continua como desenvolvedor das features marcadas "Gemini" e pesquisador; deixa de
  ser revisor. `.gemini/styleguide.md` foi removido.
- A feature 002 (`revisor-pr`) volta para spec/plan para automatizar este protocolo.

## Alternativas rejeitadas
- **Gemini Code Assist enterprise**: custo recorrente e configuração de Google Cloud
  (faturamento, IAM) desproporcionais para um app pessoal; teto de custo R$ 0.
- **Revisor Gemini via API** (Gemini CLI/Actions): outro modelo, mas exige chave, custo e
  automação que ainda não existem; pode voltar como ADR nova se a 002 justificar.
- **Merge sem revisor**: viola o Princípio VIII.

## Consequências
Revisor e autor do mesmo modelo dividem pontos cegos; o contexto limpo e o checklist fixo
reduzem o viés do autor, e o Gate 3 do Doug continua obrigatório. Zero custo e nenhuma
dependência externa para revisar.
