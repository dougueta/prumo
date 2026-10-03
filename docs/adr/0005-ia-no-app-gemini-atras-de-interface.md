# ADR 0005 — IA no app: Gemini API atrás da interface AiProvider

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug

## Contexto
O Doug assina Google AI Pro (não inclui créditos de API). O app precisa de IA para
categorização, extração de PDF, chat e diagnóstico.

## Decisão
- Provedor padrão: **Gemini API**, atrás de uma interface própria `AiProvider` no servidor,
  para permitir trocar de provedor (ex.: Claude API) sem reescrever features.
- Tier (gratuito × pago) a definir pela pesquisa R3, priorizando a política de uso de dados
  (Constitution II): se o tier gratuito permitir uso dos dados para treino, usar tier pago
  ou outro provedor para dados financeiros.
- Saída de IA sempre com confiança, corrigível e não-bloqueante (Constitution VI).

## Consequências
A feature que introduzir o primeiro uso de IA (014 ou 010) define e implementa `AiProvider`.
