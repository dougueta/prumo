# ADR 0007 — Revisão independente por subagente Claude em contexto limpo

- **Status**: Aceita · **Data**: 2026-10-24 · **Decisor**: Doug
- **Substitui em parte**: ADR 0001 (revisão cruzada Claude ↔ Gemini)

## Contexto
A ADR 0001 previa que os PRs do Claude fossem revisados pelo Gemini Code Assist no GitHub.
O Google encerrou a versão consumer (gratuita) do app: desde 2026-06-18 não é possível
concluir a instalação, e desde 2026-07-17 ela não revisa mais PRs. A versão enterprise exige
projeto no Google Cloud com faturamento e está em preview. Fontes (consultadas em
2026-10-24): [aviso de descontinuação do Google](https://developers.google.com/gemini-code-assist/docs/deprecations/consumer-code-review),
[setup enterprise](https://docs.cloud.google.com/gemini/docs/code-review/set-up-code-assist-github).
Sem revisor, nenhum PR do Claude podia ser integrado (Constitution VIII 1.2.0). O PR #11
ficou parado, e o PR #9 tinha entrado sem veredito.

## Decisão
- Todo PR (do Claude e do Gemini) é revisado por um **subagente Claude novo e sem histórico**,
  que recebe só o pacote de revisão (diff, artefatos da spec, constitution, ADRs,
  `docs/review-checklist.md`) e devolve o veredito. A sessão que o despachou publica no PR
  cada execução: prompt literal, resposta sem edição e identificador.
- O Gemini continua como desenvolvedor das features marcadas "Gemini" e pesquisador; deixa de
  ser revisor. `.gemini/styleguide.md` foi removido.
- A feature 002 (`revisor-pr`) volta para spec/plan para automatizar este protocolo.
- **Bootstrap**: a constitution 1.2.0 não tinha caminho para revisar a própria emenda. O Doug
  decidiu (2026-10-24) que o PR da emenda fosse revisado pelo protocolo novo; a aprovação
  dele no Gate 3 ratifica a adoção.

## Alternativas rejeitadas
- **Gemini Code Assist enterprise**: custo recorrente e configuração de Google Cloud
  (faturamento, IAM) desproporcionais para um app pessoal, com teto de custo R$ 0.
- **Revisor Gemini via API ou Gemini CLI**: manteria um modelo diferente revisando. O tier
  gratuito da Gemini API não tem custo direto, mas exige guardar uma chave como segredo do
  CI, uma automação que ainda não existe (seria a 002) e aceitar que o tier gratuito pode usar
  as entradas para treino (`docs/research/gemini-api.md`). O Doug decidiu remover a
  dependência do Gemini na revisão. A opção pode voltar como **complemento**, por ADR nova,
  quando a 002 for replanejada.
- **Merge sem revisor**: viola o Princípio VIII.

## Consequências
Revisor e autor do mesmo modelo dividem pontos cegos. O contexto limpo, o checklist fixo e a
publicação de toda execução reduzem o viés do autor e tornam o processo auditável, e o Gate 3
do Doug continua obrigatório. Zero custo e nenhuma dependência externa para revisar.
