# ADR 0006 — Ambientes no plano gratuito e pré-visualização em modo demonstração

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug · **Origem**: spec 001 (clarify)

## Contexto
O Doug quer custo R$ 0. A conta dele no plano gratuito do Supabase admite 2 projetos ativos e
um já é usado pelo projeto Helux — sobra 1 vaga.

## Decisão
- `production`: o único projeto Supabase gratuito do Prumo.
- `local`: Supabase local via Docker (Supabase CLI).
- `CI`: Supabase efêmero dentro do próprio job (Supabase CLI), destruído ao final.
- `preview` (Vercel, por PR): **modo demonstração** — sem banco; dados sintéticos em memória,
  selo "Demonstração — dados fictícios", gravações só na sessão.
- Pausa por inatividade do plano gratuito deve ser evitada ou detectada (spec 001 FR-023).

## Consequências
- Todo acesso a dados passa por uma camada de repositórios com duas implementações:
  Supabase e memória (demo). **Toda feature com dados MUST funcionar no modo demonstração.**
- Revisão de PR pelo Doug acontece na demo; fluxos com banco são garantidos pelos testes
  ponta a ponta do CI.

## Alternativas rejeitadas
- Supabase Pro (~US$ 25+/mês): fora do teto R$ 0. Reavaliar se o projeto crescer.
- Produção e previews no mesmo projeto: risco a dados reais (Constitution II).
