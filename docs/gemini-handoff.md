# Handoff para o Gemini — tarefas atuais

> Atualizado em 2026-10-02. O Claude mantém este arquivo; o Doug decide prioridades.
> Ao concluir uma tarefa: entregue o arquivo pedido via PR (rótulo `autor:gemini`,
> título `research: <tema>`), marque `[x]` aqui no mesmo PR.

## Estado do projeto

- Repositório inicializado com Spec Kit (Claude + Gemini CLI), constitution v1.0.0,
  roadmap com 32 features e fluxo definido. **Nenhuma feature foi especificada ainda.**
- Próximo passo do Claude: spec **001 · setup-projeto** (onda 0) e, em lote, as specs da
  onda 1 (002, 003, 004, 006).
- Enquanto isso, você faz **pesquisas que alimentam as próximas specs** (paralelo
  permitido pela constitution). Pesquisa não gera código.

## Tarefas de pesquisa (Deep Research)

Formato de cada entrega: `docs/research/<arquivo>.md` com — Resumo (5 linhas) · Achados
detalhados · Limitações/riscos · Recomendação · Fontes (links + data de acesso).
Não inclua nenhum dado pessoal ou financeiro real do Doug.

- [x] **R1 · Pluggy** → `docs/research/pluggy.md` (alimenta 007, 008)
  - Diferença entre "Meu Pluggy" (uso pessoal) e conta de desenvolvedor/API; custo para
    1 usuário pessoal; sandbox.
  - Suporte e qualidade dos conectores para **Caixa, C6 (conta e cartão), Mercado Pago,
    PicPay**: contas, cartão de crédito, faturas, parcelas, investimentos.
  - Widget Pluggy Connect em Next.js, ciclo de vida do _item_, consentimento e expiração,
    webhooks (eventos, assinatura/validação), limites de taxa, histórico disponível (dias).
- [x] **R2 · Formatos de importação** → `docs/research/formatos-importacao.md` (009, 010)
  - Como exportar extrato/fatura em **Caixa, C6, Mercado Pago, PicPay**: formatos
    disponíveis (CSV, OFX, PDF, XLSX), colunas, encoding, separador decimal, sinais.
  - Estrutura típica dos PDFs de fatura de C6 e Caixa (seções, parcelas "03/10", IOF,
    estornos, compras internacionais).
- [x] **R3 · Gemini API para o app** → `docs/research/gemini-api.md` (010, 014, 030)
  - Modelos e limites do **tier gratuito** hoje; structured output (JSON schema);
    entrada de PDF.
  - **Política de uso de dados no tier gratuito vs. pago** (os dados podem ser usados para
    treino?). Isso é crítico para a Constitution II — recomende o tier adequado.
  - Custo estimado para ~500 transações/mês categorizadas + ~3 PDFs/mês.
- [x] **R4 · Google Sheets API** → `docs/research/google-sheets.md` (026)
  - Leitura via conta de serviço com acesso somente leitura a uma planilha específica;
    cotas; melhor forma de agendar (Supabase Cron/Edge Function) e detectar mudanças.
- [x] **R5 · Gemini Code Assist no GitHub** → `docs/research/gemini-code-assist.md` (substituída e detalhada em `specs/002-revisor-pr/research.md`)
  - Instalação em repositório privado, `.gemini/config.yaml` e `.gemini/styleguide.md`,
    o que ele consegue (resumo, comentários, severidade), se pode **aprovar/reprovar**
    formalmente ou só comentar, e como transformar o veredito em check obrigatório.

## Próximas tarefas de desenvolvimento (quando as dependências estiverem `done`)

| Feature                      | Onda | Pode começar a spec quando                    |
| ---------------------------- | ---- | --------------------------------------------- |
| 010 · importacao-pdf-fatura  | 3    | 009 com spec aprovada (escrever spec em lote) |
| 013 · filtros-busca          | 4    | 012 com spec aprovada                         |
| 026 · import-google-sheets   | 3    | 025 com spec aprovada                         |
| 005 · export-backup          | 6    | 004 `done`                                    |
| 020 · orcamento-categoria    | 6    | 014 e 017 com spec aprovada                   |
| 024 · central-notificacoes   | 8    | 023 com spec aprovada                         |
| 028 · metas                  | 7    | 017 com spec aprovada                         |
| 032 · integracao-gmail-drive | 9    | 010 `done`                                    |

## Revisões pendentes

Desde a feature 002, todo PR `autor:claude` ou `autor:doug` aguarda a sua revisão (Gemini Code
Assist), e a verificação "Revisão independente" fica **pending** até o seu veredito. Lista
sempre atualizada (não mantida à mão):

- PRs abertos aguardando você:
  `https://github.com/dougueta/prumo/pulls?q=is%3Apr+is%3Aopen+-is%3Adraft+label%3Aautor%3Aclaude`
  (busca `is:pr is:open -is:draft label:autor:claude`; troque por `label:autor:doug` para os do Doug)
- No terminal: `gh pr list --label autor:claude --state open --search "-is:draft status:pending"`

Revise seguindo `.gemini/styleguide.md` e termine sempre com o bloco `prumo:veredito`.
