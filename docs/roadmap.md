# Roadmap — Iniciativas, Features e Ondas

> Fonte da verdade para **números de feature**, **dependências**, **ondas de paralelismo** e
> **agente responsável**. Ao iniciar uma feature use exatamente o número e o slug desta tabela:
> `create-new-feature.sh --number <N> --short-name <slug> "<descrição>"`.
>
> Atualize a coluna **Status** a cada transição (via PR).

## Legenda

- **Status**: `backlog` → `spec` (specify/clarify) → `spec-ok` (Doug aprovou spec) → `plan`
  → `plan-ok` (Doug aprovou plan+tasks) → `impl` → `review` → `done`
- **Agente**: quem implementa. O revisor é sempre o outro (Constitution VIII).
- **MVP**: ✅ = faz parte do primeiro release utilizável.

## Contas do usuário (contexto de produto)

| Tipo | Instituição | Papel |
|---|---|---|
| Conta/carteira | Mercado Pago | recebe parte do salário |
| Conta | Caixa | recebe parte do salário |
| Carteira | PicPay | uso do dia a dia |
| Cartão de crédito | C6 | maior concentração de gastos hoje |
| Cartão de crédito | Caixa | novo — será o centralizador de gastos |

## Backlog

| # | Slug | Iniciativa | Feature | Depende de | Onda | Agente | MVP | Status |
|---|---|---|---|---|---|---|---|---|
| 001 | `setup-projeto` | 0 · Plataforma | Setup: Next.js, Supabase, Vercel, CI (lint/type/test/E2E), PWA base, gerador de dados sintéticos | — | 0 | Claude | ✅ | spec-ok |
| 002 | `revisor-pr` | 0 · Plataforma | Revisor de PR independente (Gemini Code Assist + revisor Claude limpo + branch protection + template de PR) | 001 | 1 | Claude | ✅ | backlog |
| 003 | `design-system` | 0 · Plataforma | Design system e shell do app (navegação, layout mobile-first, componentes base, tema claro/escuro) | 001 | 1 | Claude | ✅ | backlog |
| 004 | `modelo-dados-core` | 0 · Plataforma | Modelo de dados core: contas, transações, categorias, origens, lotes de importação, RLS | 001 | 1 | Claude | ✅ | backlog |
| 005 | `export-backup` | 0 · Plataforma | Exportar todos os dados (CSV/JSON) e rotina de backup | 004 | 6 | Gemini | | backlog |
| 006 | `login` | 1 · Autenticação | Login single-user com allowlist, sessão segura, logout | 001 | 1 | Claude | ✅ | backlog |
| 007 | `conexao-open-finance` | 2 · Contas e conexões | Conectar instituições via Pluggy (widget, contas/cartões, status, reconexão) | 004, 006 | 2 | Claude | ✅ | backlog |
| 008 | `sync-automatica` | 2 · Contas e conexões | Sincronização automática (cron + webhooks Pluggy, retries, log) | 007 | 3 | Claude | ✅ | backlog |
| 009 | `importacao-csv-ofx` | 2 · Contas e conexões | Importação manual CSV/OFX com mapeamento e pré-visualização | 004, 006 | 2 | Claude | ✅ | backlog |
| 010 | `importacao-pdf-fatura` | 2 · Contas e conexões | Importação de PDF de fatura com extração via Gemini + revisão | 009 | 3 | Gemini | ✅ | backlog |
| 011 | `deduplicacao` | 2 · Contas e conexões | Deduplicação entre fontes (Pluggy × CSV × PDF), merge auditável | 008, 009, 010 | 4 | Claude | ✅ | backlog |
| 012 | `extrato-consolidado` | 3 · Extrato | Extrato unificado de todas as contas, paginação, detalhe, edição manual | 003, 004, 006 | 3 | Claude | ✅ | backlog |
| 013 | `filtros-busca` | 3 · Extrato | Filtros (período, conta, categoria, valor, origem) e busca textual | 012 | 4 | Gemini | ✅ | backlog |
| 014 | `categorizacao-ia` | 3 · Extrato | Categorização automática com IA, confiança, correção manual | 012 | 4 | Claude | ✅ | backlog |
| 015 | `regras-categorizacao` | 3 · Extrato | Regras determinísticas (aprendidas das correções + manuais) | 014 | 5 | Claude | ✅ | backlog |
| 016 | `transferencias-internas` | 3 · Extrato | Identificar transferências entre contas próprias e pagamento de fatura | 012 | 4 | Claude | ✅ | backlog |
| 017 | `dashboard` | 4 · Visão geral | Dashboard: saldo consolidado, entradas×saídas, gastos por categoria | 012, 014, 016 | 5 | Claude | ✅ | backlog |
| 018 | `faturas-cartao` | 5 · Cartões | Faturas aberta/fechada, vencimento, por cartão | 007, 016 | 5 | Claude | | backlog |
| 019 | `parcelamentos` | 5 · Cartões | Parcelamentos e compromissos futuros | 018 | 6 | Claude | | backlog |
| 020 | `orcamento-categoria` | 6 · Orçamento | Orçamento mensal por categoria e acompanhamento | 014, 017 | 6 | Gemini | | backlog |
| 021 | `recorrencias-assinaturas` | 7 · Comportamento | Detectar recorrências/assinaturas, aumento de preço, assinatura esquecida | 014 | 6 | Claude | | backlog |
| 022 | `analise-padroes` | 7 · Comportamento | Tendência por categoria, mês × média, sazonalidade, dia/horário, ticket médio, top estabelecimentos | 017, 021 | 7 | Claude | | backlog |
| 023 | `motor-alertas` | 7 · Comportamento | Motor de alertas plugável e explicável (fora do padrão, duplicada, ritmo de gasto, fatura acima da média, tarifa, salário não caiu) | 020, 021 | 7 | Claude | | backlog |
| 024 | `central-notificacoes` | 7 · Comportamento | Central de notificações (in-app, push PWA, e-mail opcional, preferências, silenciar) | 023 | 8 | Gemini | | backlog |
| 025 | `carteira-investimentos` | 8 · Investimentos | Carteira manual: ativos, classes, aportes, resgates, posição | 003, 004, 006 | 2 | Claude | | backlog |
| 026 | `import-google-sheets` | 8 · Investimentos | Importação agendada de Google Sheets (intervalo configurável, mapeamento, log) | 025 | 3 | Gemini | | backlog |
| 027 | `evolucao-patrimonial` | 8 · Investimentos | Evolução patrimonial, alocação por classe, aportes × valorização (+ card no dashboard) | 017, 025, 026 | 5 | Claude | | backlog |
| 028 | `metas` | 9 · Planejamento | Metas (reserva de emergência, reforma do apê…) com progresso | 017 | 7 | Gemini | | backlog |
| 029 | `projecao-fluxo-caixa` | 9 · Planejamento | Projeção de fluxo de caixa (recorrências + parcelas + metas) | 019, 021, 028 | 8 | Claude | | backlog |
| 030 | `chat-financas` | 10 · Inteligência | Chat "pergunte às suas finanças" | 017, 022, 027 | 9 | Claude | | backlog |
| 031 | `diagnostico-mensal` | 10 · Inteligência | Diagnóstico mensal automático | 022, 023, 027 | 9 | Claude | | backlog |
| 032 | `integracao-gmail-drive` | 10 · Inteligência | Gmail/Drive → importação automática de faturas e comprovantes | 010 | 9 | Gemini | | backlog |

## Ondas de paralelismo

Uma onda só começa a **implementar** quando as dependências de cada feature estão `done`.
Specs (`specify`/`clarify`) da onda seguinte podem ser escritas antecipadamente, em lote.
Limite: **máx. 3 features em `impl` simultaneamente**.

| Onda | Features | Paralelo possível |
|---|---|---|
| 0 | 001 | — (base de tudo) |
| 1 | 002 · 003 · 004 · 006 | 4 independentes → rodar 3 + 1 |
| 2 | 007 · 009 · 025 | 3 |
| 3 | 008 · 010 · 012 · 026 | 4 → 3 + 1 |
| 4 | 011 · 013 · 014 · 016 | 4 → 3 + 1 |
| 5 | 015 · 017 · 018 · 027 | 4 → 3 + 1 |
| 6 | 005 · 019 · 020 · 021 | 4 → 3 + 1 |
| 7 | 022 · 023 · 028 | 3 |
| 8 | 024 · 029 | 2 |
| 9 | 030 · 031 · 032 | 3 |

**MVP utilizável** = ondas 0–5 restritas às features ✅ (001–004, 006–017).

## Fora do backlog do app (trabalho do Gemini sem código)

- Pesquisa de investimentos, taxas e tarifas (Deep Research) → resultados em `docs/research/`.
- Segunda opinião sobre o diagnóstico financeiro mensal.

## Referência legada

`../controle-financeiro` é um app anterior do Doug (Vite + React, parsers, metas, insights por IA).
Pode ser consultado em pesquisas (`research.md`), mas **nenhum código é copiado sem passar
por spec/plan** desta base.
