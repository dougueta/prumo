# Contrato — Shell e Navegação

Fonte única: `src/lib/navigation.ts` (dados) + `src/app/(app)/layout.tsx` (shell).
Toda feature com tela MUST se encaixar aqui; nenhuma feature cria navegação própria (FR-008).

## 1. Destinos principais (FR-007) — ordem fixa

| # | id | Rótulo | Rota | Ícone (lucide) |
|---|---|---|---|---|
| 1 | `inicio` | Início | `/` | `House` |
| 2 | `extrato` | Extrato | `/extrato` | `ReceiptText` |
| 3 | `planejamento` | Planejamento | `/planejamento` | `CalendarRange` |
| 4 | `investimentos` | Investimentos | `/investimentos` | `TrendingUp` |
| 5 | `mais` | Mais | `/mais` | `Ellipsis` |

- `< 768px`: barra inferior fixa (ícone + rótulo, altura ≥ 56px + área segura inferior).
- `≥ 768px`: menu lateral (logotipo no topo, mesmos itens/ordem; ≥ 1024px com rótulo ao lado
  do ícone, 768–1023px rótulo abaixo do ícone).
- Ativo: `aria-current="page"`, fundo `primary-subtle`, texto `primary`; regra de prefixo
  (`/extrato/123` ativa `extrato`; `/` só ativa `inicio` quando exato).
- **Proibido**: 6º destino; destinos condicionais; ícone sem rótulo.

## 2. Mapa das 32 features (FR-008) — `FEATURE_SLOTS`

| Feature | Onde | Rota prevista |
|---|---|---|
| 001 setup-projeto | plataforma | — |
| 002 revisor-pr | plataforma | — |
| 003 design-system | Mais › Ajustes · Mais › Catálogo (só local/preview) | `/mais/ajustes` · `/catalogo` |
| 004 modelo-dados-core | plataforma | — |
| 005 export-backup | Mais › Exportar e backup | `/mais/exportar` |
| 006 login | Mais › Conta e segurança (login fora do shell: `/entrar`) | `/mais/seguranca` |
| 007 conexao-open-finance | Mais › Contas e conexões | `/mais/contas` |
| 008 sync-automatica | Mais › Contas e conexões (status de sincronização) | `/mais/contas/sincronizacao` |
| 009 importacao-csv-ofx | Mais › Importar arquivos | `/mais/importar` |
| 010 importacao-pdf-fatura | Mais › Importar arquivos (PDF) | `/mais/importar/pdf` |
| 011 deduplicacao | Extrato › Revisar duplicadas | `/extrato/duplicadas` |
| 012 extrato-consolidado | Extrato | `/extrato` |
| 013 filtros-busca | Extrato (filtros na própria tela) | `/extrato?…` |
| 014 categorizacao-ia | Extrato (selo de origem + revisão) | `/extrato/revisar` |
| 015 regras-categorizacao | Mais › Regras de categorização | `/mais/regras` |
| 016 transferencias-internas | Extrato (indicador no item) | — |
| 017 dashboard | Início | `/` |
| 018 faturas-cartao | Planejamento › Cartões e faturas | `/planejamento/cartoes` |
| 019 parcelamentos | Planejamento › Parcelamentos | `/planejamento/parcelamentos` |
| 020 orcamento-categoria | Planejamento › Orçamento | `/planejamento/orcamento` |
| 021 recorrencias-assinaturas | Planejamento › Assinaturas e recorrências | `/planejamento/recorrencias` |
| 022 analise-padroes | Início › Análises | `/analises` |
| 023 motor-alertas | Mais › Alertas | `/mais/alertas` |
| 024 central-notificacoes | Ícone de sino no cabeçalho + Mais › Notificações | `/notificacoes` |
| 025 carteira-investimentos | Investimentos | `/investimentos` |
| 026 import-google-sheets | Investimentos › Importação da planilha | `/investimentos/planilha` |
| 027 evolucao-patrimonial | Investimentos › Evolução (+ card no Início) | `/investimentos/evolucao` |
| 028 metas | Planejamento › Metas | `/planejamento/metas` |
| 029 projecao-fluxo-caixa | Planejamento › Projeção | `/planejamento/projecao` |
| 030 chat-financas | Início › "Pergunte" (ação no cabeçalho do Início) | `/pergunte` |
| 031 diagnostico-mensal | Início › Diagnóstico do mês | `/diagnostico` |
| 032 integracao-gmail-drive | Mais › Importar arquivos › Gmail e Drive | `/mais/importar/google` |

Mudança neste mapa = PR que altera `src/lib/navigation.ts` + este contrato (dona: 003).

## 3. Telas que a 003 entrega

| Rota | Conteúdo |
|---|---|
| `/` | `ComingSoon` "Início" (substituída pela 017) |
| `/extrato` | `ComingSoon` "Extrato" (012) |
| `/planejamento` | `ComingSoon` "Planejamento" (018–021, 028, 029) |
| `/investimentos` | `ComingSoon` "Investimentos" (025) |
| `/mais` | lista de atalhos **existentes**: Ajustes; Catálogo (só local/preview). Itens de features futuras ficam ocultos até existirem (FR-009). |
| `/mais/ajustes` | Tema (Automático/Claro/Escuro) e Ocultar valores (FR-017) |
| `/catalogo/**` | catálogo (contracts/catalog.md) |

## 4. Anatomia do shell (`src/app/(app)/layout.tsx`)

```
<html lang="pt-BR" data-theme? data-privacy?>      ← root layout (cookies)
  <body>
    <SkipLink href="#conteudo">Pular para o conteúdo</SkipLink>
    <DemoBadge/>            ← só preview; sticky; z-demo; não removível
    <EnvIndicator/>         ← só local: chip "Local" no canto do cabeçalho/menu lateral
    <OfflineBanner/>        ← role=status, aria-live=polite
    <SideNav/>  (≥ md)
    <main id="conteudo" tabIndex={-1}>  {children}  </main>
    <BottomNav/> (< md)
    <Toaster/>
```

Cada página abre com `<PageHeader title back? actions? />` (contracts/components.md §5): título
`h1`, voltar opcional (telas internas), até 2 ações visíveis + menu "Mais ações", e sempre o
`PrivacyToggle`. Área segura: `env(safe-area-inset-*)` no cabeçalho e na barra inferior.

## 5. Erros e carregamento de rota

- `src/app/(app)/loading.tsx` → `LoadingSkeleton variant="page"`.
- `src/app/(app)/error.tsx` → `ErrorState` com "Tentar novamente" (`reset()`), sem detalhe técnico.
- `src/app/(app)/not-found.tsx` → `EmptyState` "Página não encontrada" + "Voltar ao início".

## 6. Integração com a 006 (login)

A 006 acrescenta `requireSession()` no início de `src/app/(app)/layout.tsx` e cria `/entrar`
**fora** do route group `(app)` (sem shell). A 003 não toca em `src/proxy.ts`.
