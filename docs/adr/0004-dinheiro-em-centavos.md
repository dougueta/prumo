# ADR 0004 — Dinheiro em centavos inteiros e datas em America/Sao_Paulo

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug

## Decisão
Valores monetários como inteiros em centavos (`BIGINT amount_cents`, negativo = saída).
Proibido float para dinheiro em qualquer camada. Data de transação `DATE` em
`America/Sao_Paulo`; timestamps técnicos `TIMESTAMPTZ` em UTC. Formatação só na apresentação.

## Rationale
Erros de arredondamento de ponto flutuante são inaceitáveis em finanças; o fuso evita
transações "mudarem de dia" perto da meia-noite.
