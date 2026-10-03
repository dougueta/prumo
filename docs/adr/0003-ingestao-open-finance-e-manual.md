# ADR 0003 — Ingestão: Open Finance (Pluggy) + importação manual

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug

## Contexto
Contas em Caixa, Mercado Pago, PicPay e cartões C6 e Caixa. O Doug quer automação no estilo
GuiaBolso, com plano B manual.

## Decisão
- Fonte principal: **Pluggy** (Open Finance), sandbox em dev, produção só em produção.
- Fonte complementar: importação manual de **CSV, OFX e PDF de fatura** (PDF extraído por IA),
  e Google Sheets para investimentos.
- Todas as fontes escrevem no mesmo modelo core (feature 004) com `source`, `external_id` e
  deduplicação obrigatória (feature 011).

## Alternativas rejeitadas
- Apenas importação manual: exige esforço mensal recorrente.
- Apenas leitura de e-mails via Gemini: cobertura incompleta (fica como feature 032, complementar).

## Consequências
Custos/limites do Pluggy a confirmar (pesquisa R1). Dedup vira peça crítica do sistema.
