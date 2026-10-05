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
| 006 login | Mais › Conta e segurança (sessões, histórico, biometria); entrada e desbloqueio **fora do shell** (§2.1) | `/mais/seguranca` |
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

### 2.1 Rotas fora do shell — `OUTSIDE_SHELL_ROUTES`

Sem `AppShell` (sem navegação principal), mas com root layout: tokens, tema, `DemoBadge`,
`EnvIndicator`, `Toaster`, `TodayProvider`.

| Rota | Dona | Onde fica no código |
|---|---|---|
| `/entrar` · `/entrar/codigo` | 006 | `src/app/(public)/entrar/**` |
| `/desbloquear` | 006 | fora de `(app)` (ex.: `src/app/(public)/desbloquear/`) — a 006 decide a pasta, não o shell |
| `/~offline` | 001 (visual: 003) | `src/app/~offline/page.tsx` |
| 404 raiz (URL inexistente) | 003 | `src/app/not-found.tsx` |
| erro na raiz | 003 | `src/app/global-error.tsx` |

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

## 4. Anatomia

Root layout (`src/app/layout.tsx`) — vale para **todas** as telas, dentro e fora do shell:

```
<html lang="pt-BR" data-theme? data-privacy?>      ← cookies lidos no servidor
  <body>
    <DemoBadge/>            ← só preview; sticky; z-demo; não removível (FR-012, ADR 0006)
    <EnvIndicator/>         ← só local: chip "Local" fixo no canto (z-demo)
    <TodayProvider today={todayInSaoPaulo()}>  {children}  </TodayProvider>
    <Toaster/>              ← único do app
    <ServiceWorkerRegister/>  (001)
```
`viewport`: `viewportFit: "cover"` + `themeColor` de `src/styles/tokens.ts` (por mídia no
automático; único quando o cookie fixa o tema).

Shell (`src/app/(app)/layout.tsx`, criado pela 003):

```
<SkipLink href="#conteudo">Pular para o conteúdo</SkipLink>
<OfflineBanner/>        ← role=status, aria-live=polite
<SideNav/>  (≥ md)
<main id="conteudo" tabIndex={-1}>  {children}  </main>
<BottomNav/> (< md, pb-safe)
```

Cada página abre com `<PageHeader title back? actions? />` (contracts/components.md §5): título
`h1` = nome da seção/tela, voltar opcional (telas internas), até 2 ações visíveis + menu "Mais
ações", e sempre o `PrivacyToggle`. Área segura: utilitários `pt-safe`/`pb-safe`
(`env(safe-area-inset-*)`, efetivos com `viewport-fit=cover`) no cabeçalho e na barra inferior.

## 5. Erros e carregamento de rota

- `src/app/(app)/loading.tsx` → `LoadingSkeleton variant="page"`.
- `src/app/(app)/error.tsx` → `ErrorState scope="page"` com "Tentar novamente" (`reset()`), sem detalhe técnico.
- `src/app/(app)/not-found.tsx` → `EmptyState` "Página não encontrada" + "Voltar ao início"
  (para `notFound()` chamado dentro do shell, ex.: catálogo em produção).
- `src/app/not-found.tsx` (raiz, **fora do shell**) → mesma mensagem para URL inexistente. No
  Next 16, URLs sem rota usam o `not-found` da raiz, não o do grupo; sem ele aparece a página
  padrão em inglês, que ignora `data-theme`.
- `src/app/global-error.tsx` → erro no próprio root layout ou no `(app)/layout.tsx`
  (o `error.tsx` de um segmento não captura erros do layout desse segmento); tem `<html>`/`<body>`
  próprios, importa `globals.css`, textos padrão em pt-BR.

## 6. Integração com a 006 (login) — ordem de merge 004 → 003 → 006

- A 003 cria o grupo `(app)`: `(app)/layout.tsx` (AppShell), `(app)/page.tsx` (Início) e remove
  `src/app/page.tsx`. A 006 **não** recria esses arquivos; faz rebase sobre a 003 e só
  acrescenta a guarda: `requireSession()` em cada `page.tsx`/action/handler protegido e dentro
  de `getDataClient()` — não só no layout, porque no Next 16 o layout não re-renderiza na navegação.
- `/entrar`, `/entrar/codigo` e `/desbloquear` ficam fora do shell (§2.1) e já são construídos
  com os componentes da 003 (primitivos `ui/`, `forms/`, `states/`, `notify`, `Logo`, tokens).
  O lint de fundamentos da 003 (paleta padrão removida, `no-unknown-classes`) vale também para elas.
- `/mais/seguranca` (sessões, histórico, biometria) é tela da 006 **dentro** do shell (D-B).
- A 006 acrescenta `<SessionGuard/>` no root layout, sem remover `DemoBadge`, `EnvIndicator`,
  `Toaster` nem `TodayProvider`.
- A 003 não toca em `src/proxy.ts` (004 e 006 tocam).
- Cookies: a 003 usa `prumo_theme`/`prumo_privacy`; a 006 e a 004 usam outros nomes `prumo_*`.
