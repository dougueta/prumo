# Implementation Plan: Design System e Shell do App

**Branch**: `003-design-system` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-design-system/spec.md` (Gate 1 aprovado)

## Summary

Construir sobre a base da 001 o design system do Prumo: tokens semânticos (paleta sóbria
verde-petróleo/azul profundo + neutros quentes, entrada verde suave, saída terracota — todos
com contraste AA **calculado** e testado), tema Automático/Claro/Escuro e modo privacidade
lidos de cookies no servidor (sem "piscar"), shell responsivo (barra inferior < 768px, menu
lateral ≥ 768px) com os destinos Início · Extrato · Planejamento · Investimentos · Mais e o
mapa das 32 features, componentes base de finanças (Money, RelativeDate, TransactionItem,
SummaryCard, SourceBadge…), estados padronizados, formulários (MoneyInput em centavos exatos),
diálogos/toasts, e um catálogo navegável em `/catalogo` (só local/preview) com regras de uso.
Verificação automática de tokens (lint), acessibilidade (axe), comportamento (jsdom) e
aparência (screenshots Linux). Escolhas detalhadas em [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdados da 001)
**Primary Dependencies**: Next.js 16.3.8 (App Router), React 19.2.8, Tailwind 4; **novas**:
shadcn CLI 4.21.1 (`--base radix`, só em dev via `npx`), `radix-ui` 1.6.7, `lucide-react`
1.50.0, `sonner` 2.0.8, `class-variance-authority` 0.7.1, `tailwind-merge` 3.7.0, `clsx`,
`tw-animate-css` 1.4.0, `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1; fonte Inter
Variable (OFL) auto-hospedada via `next/font/local`
**Dev (novas)**: `@axe-core/playwright` 4.13.0 (introduzida aqui para toda a onda; a 006
reutiliza), `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1,
`eslint-plugin-better-tailwindcss` 4.7.0
**Storage**: nenhum banco; preferências em cookies do aparelho (`prumo_theme`, `prumo_privacy`)
**Testing**: Vitest 5 — projetos `unit` (node), **`component` (jsdom 29, novo)**; Playwright
1.63 — `chromium`, `mobile-chrome`, `demo`, **`visual` (novo, só Linux)**
**Target Platform**: PWA — Chrome Android, Safari iOS, desktop (Chrome/Edge/Firefox/Safari recentes)
**Project Type**: web app (Next.js full-stack, projeto único)
**Performance Goals**: shell utilizável ≤ 2 s (4G, CPU 4×), troca de seção ≤ 300 ms (SC-005);
JS de cliente do shell ≤ 120 kB gzip (nav, toggles, toaster)
**Constraints**: R$ 0; AA nos dois temas; 320–1920 px sem rolagem horizontal; texto 200%;
nenhuma requisição externa em runtime (fontes/ícones locais); sem `float` para dinheiro
**Scale/Scope**: 1 usuário; ~9 rotas (5 seções, Ajustes, catálogo); ~30 componentes;
base visual para 29 features seguintes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 003 aprovada (Gate 1, 2026-10-02); branch `003-design-system` | ✅ |
| II. Privacidade | Sem dados reais: exemplos do catálogo vêm do gerador sintético (seed 42); cookies só com preferência visual; modo privacidade documentado como proteção visual; nenhum segredo; fontes/ícones locais (sem terceiros vendo acessos) | ✅ |
| III. Dinheiro exato | `Money` recebe centavos inteiros; `formatMoney` sem `cents/100` (string decimal → `Intl`); `parseMoneyInput` devolve inteiro exato; teste de tabela + rejeição de não-inteiros | ✅ |
| IV. Rastreabilidade | N/A (sem transações); `TransactionItem` exibe origem/fonte quando fornecida | ✅ |
| V. Test-first | Toda task de implementação tem teste vermelho antes, inclusive na Phase 2 (layout raiz, primitivos, logo); matriz FR → teste automatizado 100% em tasks.md; CI ganha `test:component` e `visual` sem renomear jobs | ✅ |
| VI. IA assistente | `SourceBadge` obrigatório para categoria por IA: origem, confiança, explicação e "Corrigir"; baixa confiança = "revisar" | ✅ |
| VII. Donos / demo | Nenhuma tabela; shell e catálogo funcionam 100% em modo demonstração; selo demo acima de diálogos; contratos de UI com dona 003 | ✅ |
| VIII. Revisão independente | PR `autor:claude` → revisor Gemini | ✅ |
| IX. Qualidade dos artefatos | data-model (tokens, cookies, navegação, tabelas de formatação, máquina de estados), contracts (componentes, navegação, catálogo), Gherkin abaixo, libs e estrutura definidas. *data-model sem tipos SQL: a feature não tem banco (declarado)* | ✅ |
| X. Simplicidade | Sem Storybook, sem next-themes, sem vaul, sem date-picker; tema/privacidade por atributo + cookie; uma família tipográfica | ✅ |
| Custo R$ 0 | Todas as libs MIT/ISC/OFL; nenhum serviço novo; minutos de CI extras estimados +3 min/PR (≈ +150 min/mês, dentro dos 2.000 gratuitos) | ✅ |

**Re-check pós-design**: ✅ sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/003-design-system/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (components.md · navigation.md · catalog.md)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root) — novos (+) e alterados (~)

```text
src/
├── app/
│   ├── layout.tsx                 ~ fontes, cookies → data-theme/data-privacy, viewport (viewportFit cover,
│   │                                themeColor de tokens.ts), DemoBadge + EnvIndicator (todas as telas),
│   │                                TodayProvider, Toaster único
│   ├── globals.css                ~ importa tokens, base, reduced motion, privacidade, utilitários *-safe
│   ├── manifest.ts                ~ theme_color/background_color de src/styles/tokens.ts (FR-006)
│   ├── not-found.tsx              + 404 raiz fora do shell (pt-BR, tokens, Logo)
│   ├── global-error.tsx           + erro no root layout / (app)/layout (html+body próprios)
│   ├── page.tsx                   − removido (Início passa para (app)/page.tsx)
│   ├── fonts/                     + InterVariable*.woff2 + OFL.txt
│   ├── ~offline/page.tsx          ~ visual com tokens e Logo
│   └── (app)/
│       ├── layout.tsx             + AppShell (a 006 acrescenta a guarda nas páginas/actions e em getDataClient)
│       ├── loading.tsx · error.tsx · not-found.tsx   +
│       ├── page.tsx               + Início (ComingSoon)
│       ├── extrato/page.tsx · planejamento/page.tsx · investimentos/page.tsx   +
│       ├── mais/page.tsx · mais/ajustes/page.tsx                               +
│       └── catalogo/layout.tsx · page.tsx · [slug]/page.tsx · fundamentos/[topic]/page.tsx · escrita/page.tsx ·
│           exemplo-extrato/page.tsx  +
├── styles/tokens.css              + tokens claro/escuro, @theme inline, @custom-variant dark, z/motion/radius, overlay
├── styles/tokens.ts               + espelho TS (THEME_COLOR, BRAND_COLOR, SPLASH_BACKGROUND) — data-model §1.1b
├── lib/
│   ├── format.ts                  ~ formatMoney, moneyToSpeech, parseMoneyInput, datas, períodos
│   ├── preferences.ts             + cookies de tema/privacidade (puro)
│   ├── navigation.ts              + DESTINATIONS, FEATURE_SLOTS, isActive
│   ├── catalog-access.ts          + isCatalogEnabled(appEnv)
│   └── utils.ts                   + cn() (shadcn)
├── components/
│   ├── ui/                        + primitivos shadcn (contracts/components.md §1)
│   ├── brand/logo.tsx             + fio de prumo (SVG)
│   ├── shell/                     + app-shell, bottom-nav, side-nav, page-header, privacy-toggle,
│   │                                theme-select, env-indicator, skip-link, offline-banner,
│   │                                today-provider, use-online, use-back-to-close, coming-soon
│   ├── demo-badge.tsx             → movido para shell/demo-badge.tsx (tokens demo); continua renderizado no root layout
│   ├── finance/                   + money, relative-date, period-label, transaction-item, summary-card,
│   │                                grouped-list, source-badge, category-icon, category-visuals, institution-avatar
│   ├── states/                    + empty-state, loading-skeleton, slow-loading, error-state
│   └── forms/                     + form-field, money-input, date-input, select-field, switch-field,
│                                    textarea-field, submit-button, use-app-form, run-online, confirm-dialog,
│                                    responsive-dialog, notify
└── catalog/                       + registry.ts, examples.ts (derivação data-model §7), entries/*.tsx
public/sw.js                       ~ CACHE v2; cache-first de /_next/static/{css,media}/ (offline estilizado)
scripts/generate-icons.mjs         ~ usa a geometria de src/components/brand/logo-geometry.ts e cores de tokens.ts
components.json                    + config do shadcn (aliases @/components/ui, @/lib/utils)
eslint.config.mjs                  ~ better-tailwindcss (no-unknown-classes, no-restricted-classes)
vitest.config.ts                   ~ projeto component (jsdom)
playwright.config.ts               ~ projetos visual + specs novos em mobile-chrome/demo
.github/workflows/ci.yml           ~ job unit roda também component; e2e inclui visual
tests/
├── unit/        + format-money, format-date, parse-money-input, preferences, navigation,
│                  catalog-access, tokens-contrast, tokens-guard, styles-contract, licenses,
│                  scope-guard, category-visuals, catalog-examples, catalog-registry  (~ format.test.ts)
├── component/   + button, logo, today-provider, nav, page-header, offline-banner, money,
│                  relative-date, transaction-item, summary-card, source-badge, states,
│                  route-boundaries, money-input, form, dialogs, privacy-toggle, theme-select
├── e2e/         + root-layout, shell, theme, privacy, a11y, keyboard, reflow, catalog, perf,
│                  visual, example-screen  (~ home.spec.ts, demo.spec.ts, pwa.spec.ts)
└── setup-dom.ts + jest-dom, stubs de matchMedia/ResizeObserver/IntersectionObserver
```

**Structure Decision**: projeto Next.js único (001). Shell no route group `(app)` (criado pela
003; a 006 só acrescenta a guarda). Telas sem shell: `/entrar`, `/entrar/codigo`, `/desbloquear`
(006), `/~offline` (001), 404 raiz (003) — contracts/navigation.md §2.1. Tudo que precisa valer
em toda tela (selo demo, indicador de ambiente, Toaster, TodayProvider, tema) fica no root
layout. Catálogo dentro do shell.

## Design Detalhado

### Algoritmo — `formatMoney(cents, { variant = "movement", currency = "BRL" })` (FR-025/026)
1. `cents === null` → `"—"`. Se `!Number.isSafeInteger(cents)` → `TypeError`.
2. `abs = Math.abs(cents)`; `frac = abs % 100`; `int = (abs - frac) / 100` (exatos).
3. `decimal = \`${int}.${String(frac).padStart(2,"0")}\``.
4. `variant === "compact"` → `Intl.NumberFormat("pt-BR", {style:"currency", currency,
   notation:"compact", maximumFractionDigits:1}).format(decimal)`; senão formatador padrão
   (2 casas). Formatadores memoizados por `(currency, compact)`.
5. Sinal: `movement` → `+` se `cents > 0`, `−` (U+2212) se `< 0`, nada se `0`;
   `balance`/`compact` → `−` só se `< 0`; `neutral` → nunca. Resultado = sinal + texto.
6. `moneyToSpeech`: tipo ("entrada de"/"saída de"/"saldo negativo de"/"") + `int` reais
   ("1 real"/"N reais"; omitido se 0 e `frac > 0`) + "e" + `frac` centavos ("1 centavo"/"N
   centavos"); 0 → "zero reais"; moeda ≠ BRL → `Intl` com `currencyDisplay: "name"`.

### Algoritmo — `parseMoneyInput(text)` (FR-039)
1. `t = text.trim()`, remove `R$`, espaços e NBSP. Vazio → erro "Informe um valor.".
2. Começa com `-` → erro "Use o seletor Entrada/Saída para o sinal.".
3. Só `[0-9.,]` permitidos; senão erro "Informe um valor.".
4. Se contém `,`: parte decimal = após a **última** vírgula; inteira = antes, sem `.`.
   Se não contém `,`: se casa `^\d{1,3}(\.\d{3})+$` → `.` é milhar; senão, se tem um único `.`
   → decimal; senão erro.
5. Decimal com > 2 dígitos → erro "Use no máximo 2 casas decimais."; completa com zeros.
6. Inteira > 12 dígitos → erro "Valor muito alto.". `cents = Number(int) * 100 + Number(dec)`
   (inteiros < 2^53, exato). Retorna `{ ok: true, cents }`.

### Algoritmo — datas (FR-029/030)
- Datas são `YYYY-MM-DD`; `diffDays(a, b)` via `Date.UTC` dos componentes (sem fuso local).
- `formatRelativeDate(d, today)`: diff 0 → "Hoje"; −1 → "Ontem"; +1 → "Amanhã"; mesmo ano →
  `${dia} ${MES_ABREV[m]}` ("28 set."); outro ano → + ` ${ano}`. `MES_ABREV` é tabela fixa
  (`jan.` … `dez.`; "maio" sem ponto → `mai.`) — não usa `Intl` (que gera "28 de set.").
- `formatPeriod`: mês → `Intl` `{month:"long", year:"numeric"}` com 1ª letra maiúscula
  ("Setembro de 2026"); intervalo no mesmo mês → "1–15 set."; meses diferentes →
  "28 set. – 3 out."; anos diferentes → com ano nas duas pontas.
- `today`: `todayInSaoPaulo()` no root layout → `TodayProvider`; no cliente, recalcula em
  `visibilitychange` (estado inicial = valor do servidor → sem mismatch de hidratação).

### Fluxo — preferências (FR-017, FR-018, FR-031)
1. Root layout: `const jar = await cookies()`; `theme = parseTheme(jar.get(THEME_COOKIE))`;
   `privacy = parsePrivacy(jar.get(PRIVACY_COOKIE))`.
2. `<html lang="pt-BR" data-theme={theme === "auto" ? undefined : theme}
   data-privacy={privacy === "on" ? "on" : undefined}>` — HTML já sai certo (sem flash).
3. `ThemeSelect`/`PrivacyToggle` (cliente) recebem o valor inicial por props; ao mudar:
   atualizam o atributo em `document.documentElement`, gravam o cookie (`setPreference`) e
   ajustam `<meta name="theme-color">`. Falha ao gravar cookie → mantém a mudança na sessão
   (edge case "armazenamento bloqueado").
4. CSS: `[data-money-mask]{display:none}`; `html[data-privacy="on"] [data-money-value]
   {display:none}`; `html[data-privacy="on"] [data-money-mask]{display:inline}`.
5. `theme-color`: o servidor emite duas metas por mídia (`THEME_COLOR.light/dark`) no
   automático e uma só quando o cookie fixa o tema. No cliente, ao escolher Claro/Escuro,
   `ThemeSelect` põe o `content` de **todas** as `meta[name="theme-color"]` na cor do tema
   escolhido; ao voltar para Automático, restaura cada meta ao valor da sua mídia.

### Tema nos primitivos shadcn (`dark:`)
O código gerado em `src/components/ui/` usa `dark:`. No Tailwind 4 essa variante segue
`prefers-color-scheme` por padrão, o que ignoraria "Claro" fixado com o sistema escuro. Por isso
`tokens.css` redefine `@custom-variant dark` (data-model §1.1a) com o mesmo critério dos tokens.
O `init` do shadcn (T003) não grava o `globals.css` da 001; a variante entra no T016. Como
`--color-*: initial` também remove `black`/`white`, o T021 troca `bg-black/50`→`bg-overlay` e
`text-white`→`text-*-foreground`, e o lint `no-unknown-classes` passa a valer também em `ui/`.

### Viewport e área segura (FR-015)
`export const viewport = { viewportFit: "cover", themeColor: [...] }` no root layout: sem
`viewport-fit=cover`, `env(safe-area-inset-*)` vale 0 e o cabeçalho e a barra não se ajustam ao
entalhe. Os utilitários `pt-safe`/`pb-safe` (data-model §2) são aplicados no `PageHeader` e na
`BottomNav`.

### PWA: tela de abertura e página offline (FR-006)
- `manifest.ts` lê `BRAND_COLOR`/`SPLASH_BACKGROUND` de `src/styles/tokens.ts` (sem hex literal
  fora do espelho); ícones regenerados com a geometria do `Logo`.
- `public/sw.js` (001) só pré-armazena o HTML de `/~offline`, então o CSS e as fontes não
  carregariam sem conexão. A 003 sobe `CACHE` para `prumo-shell-v2` e adiciona **cache-first**
  para `GET /_next/static/css/*` e `/_next/static/media/*` (arquivos com hash e imutáveis, sem
  dado financeiro — Constitution II). Depois da primeira visita online, a página offline sai com
  tokens e fonte.

### Telas fora do shell e erros de rota (Next 16)
- URL inexistente → `src/app/not-found.tsx` (raiz). No Next 16, o `not-found` de um route group
  só trata `notFound()` chamado dentro dele, e a página padrão é em inglês e ignora `data-theme`.
- Erro no root layout ou em `(app)/layout.tsx` → `src/app/global-error.tsx`, porque o `error.tsx`
  do segmento não captura erros do próprio layout.
- `DemoBadge`, `EnvIndicator`, `Toaster` e `TodayProvider` ficam no root layout para valerem
  também em `/entrar`, `/desbloquear`, `/~offline` e na 404.

### Ação sem conexão (edge case "offline durante ação")
`runOnline(action)` (forms) checa `navigator.onLine`: se estiver offline, não chama a ação e
dispara `notify.offlineAction()`; se a ação rejeitar por rede, faz o mesmo. `SubmitButton` e
`notify.undo` usam esse caminho. Nada é dado como salvo.

### Máquina de estados — bloco de conteúdo
Ver data-model §6. Transições proibidas: `loading → empty` sem resposta; `error` sem
"Tentar novamente" quando `onRetry` existe; `slow` antes de 10 s.

### Máquina de estados — diálogo (`ResponsiveDialog`/`ConfirmDialog`)
`closed → open` (push de histórico, foco preso, foco inicial: primeiro campo ou "Cancelar")
→ `closed` por Esc | botão | toque fora (não em `ConfirmDialog`) | `popstate` → foco volta ao
gatilho. Proibido: `open` sem `title` acessível; fechar `ConfirmDialog` destrutivo por toque fora.

### Padrões e bibliotecas
- **Permitidas**: as do Technical Context + as da 001.
- **Proibidas**: `next-themes`, `vaul`, `react-day-picker`, Storybook, `moment`/`dayjs`/
  `date-fns` (datas por funções próprias), libs de estado global; `float` para dinheiro;
  cores fora de `tokens.css`; variante `dark:` e valores arbitrários `[...]` em
  `src/components/{finance,states,forms,shell}` e `src/app/`; `process.env` fora de `env.ts`.
- Server Components por padrão; `"use client"` só em: nav (pathname), toggles, `RelativeDate`,
  `SourceBadge`, formulários, diálogos, `OfflineBanner`, `SlowLoading`, `TodayProvider`.

### Critérios de aceite (Gherkin, com verificação de estado)

```gherkin
Funcionalidade: Shell e navegação
  Cenário: Barra inferior no celular
    Dado a viewport de 360x780 e APP_ENV=local
    Quando abro "/extrato"
    Então vejo a navegação "Principal" com 5 links na ordem Início, Extrato, Planejamento, Investimentos, Mais
    E o link "Extrato" tem aria-current="page"
    E o menu lateral não está visível
    E vejo o chip "Local" e não vejo "Demonstração — dados fictícios"

  Cenário: Menu lateral no desktop e voltar do navegador
    Dado a viewport de 1280x800
    Quando abro "/" e clico em "Planejamento"
    Então a URL é "/planejamento", o h1 é "Planejamento" e vejo o texto "Em breve"
    Quando volto no navegador
    Então a URL é "/" e "Início" tem aria-current="page"

  Cenário: Selo de demonstração acima de diálogos
    Dado APP_ENV=preview
    Quando abro "/catalogo/confirm-dialog" e abro o diálogo de exemplo
    Então o selo "Demonstração — dados fictícios" continua visível e não coberto pelo overlay

  Cenário: Selo e visual também fora do shell
    Dado APP_ENV=preview
    Quando abro "/nao-existe"
    Então vejo o h1 "Página não encontrada", o link "Voltar ao início" e o selo de demonstração
    E não vejo a navegação "Principal"

  Cenário: Área segura habilitada
    Quando abro "/"
    Então a meta viewport contém "viewport-fit=cover"

Funcionalidade: Tema
  Cenário: Automático segue o sistema sem piscar
    Dado nenhum cookie "prumo_theme" e o navegador em prefers-color-scheme dark
    Quando abro "/"
    Então o HTML recebido não tem atributo data-theme
    E a cor de fundo do body já é #141312 no primeiro quadro
  Cenário: Escolha manual persiste
    Dado que em "/mais/ajustes" escolho "Claro" com o sistema em dark
    Quando recarrego a página
    Então o cookie "prumo_theme" vale "light" e o HTML do servidor tem data-theme="light"
  Cenário: Primitivos seguem o tema manual, não o sistema
    Dado o cookie "prumo_theme=light" e o navegador em prefers-color-scheme dark
    Quando abro o diálogo de exemplo em "/catalogo/confirm-dialog"
    Então a cor de fundo do diálogo é a de "surface" claro (#FFFFFF)

Funcionalidade: Modo privacidade
  Cenário: Ocultar valores
    Dado o catálogo "/catalogo/money" com valores visíveis
    Quando aciono "Ocultar valores" no cabeçalho
    Então todo [data-money] mostra "R$ ••••"
    E a árvore de acessibilidade lê "valor oculto" e não contém "R$ 1.234,56"
    E o cookie "prumo_privacy" vale "on"
    Quando recarrego
    Então o HTML do servidor já tem data-privacy="on"

Funcionalidade: Valores e datas
  Cenário: Formatação de movimentação
    Dado cents = -4590 na variante movement
    Então o texto visível é "−R$ 45,90" na cor do token expense
    E o texto para leitor de tela é "saída de 45 reais e 90 centavos"
  Cenário: Campo de valor
    Dado o MoneyInput com direção "Saída"
    Quando digito "1.234,5" e saio do campo
    Então o campo mostra "R$ 1.234,50" e o formulário recebe -123450

Funcionalidade: Catálogo
  Cenário: Indisponível em produção
    Dado isCatalogEnabled("production")
    Então o resultado é false e o layout do catálogo chama notFound()
  Cenário: Sem violações de acessibilidade
    Dado cada página de "/catalogo" nos temas claro e escuro
    Quando roda o axe com wcag2a, wcag2aa, wcag21a, wcag21aa
    Então há 0 violações
```

## Ações externas na implementação (exigem o Doug)

1. **Nenhum serviço novo, nenhum custo.**
2. Revisar a identidade visual na pré-visualização do PR (SC-009) — de preferência no celular.
3. Checagem manual com leitor de tela no celular (TalkBack/VoiceOver) e PWA instalada
   (SC-007; confirmação em aparelho real complementar aos testes automáticos de FR-015/FR-024)
   — evidência no PR, sem dados reais.
4. Pré-condição de processo: **emenda da constitution v1.1.0 e 001 integradas na `main`**
   antes do T001 (rebase desta branch). Ordem de merge da onda 1 (D-D): **004 → 003 → 006 → 002**
   — a 003 faz rebase sobre a 004; a 006 faz rebase sobre a 003 e já usa o design system.

## Riscos aceitos e pontos abertos

| # | Item | Situação | Justificativa / mitigação |
|---|---|---|---|
| R1 | Root layout lê `cookies()` → todas as rotas dinâmicas; troca de seção depende de ida ao servidor (SC-005 ≤ 300 ms) | **Risco aceito** | As rotas já são dinâmicas (`DemoBadge`/`connection()` da 001; sessão da 006). `(app)/loading.tsx` dá resposta imediata (esqueleto) e o `Link` faz prefetch do trecho estático; o T068 mede e falha o CI se estourar |
| R2 | Área segura real (entalhe) não pode ser emulada no Chromium do CI | **Risco aceito** | Teste automático cobre `viewport-fit=cover` + utilitários `*-safe` aplicados (T075/T084/T023/T088); confirmação visual em aparelho real fica no T072 como evidência complementar |
| R3 | Página offline estilizada só depois da 1ª visita online (CSS/fonte vêm do cache em runtime, não do precache) | **Risco aceito** | Os nomes com hash não são conhecidos pelo `sw.js` estático; sem estilo, a página continua legível e em português (comportamento da 001) |
| R4 | `global-not-found` (experimental no Next 16) não é usado | **Risco aceito** | Há um único root layout; `app/not-found.tsx` basta (doc not-found.md) |
| R5 | Mapa de ícone/cor de categoria depende da taxonomia de 1º nível da 004 (nomes/chaves) | **Risco aceito** | A 004 integra antes (ordem 004 → 003); o T082 lê `src/domain/core/default-categories.ts` e falha se alguma categoria de 1º nível ficar sem chave. Categorias personalizadas caem em `personalizada`. A 004 não muda |
| R6 | Verificações de percepção (SC-004 escala de cinza, SC-009 aprovação do Doug, leitores de tela reais em SC-007) | **Manual por natureza** | São critérios de aprovação; os FRs correspondentes têm teste automatizado (sinal sempre presente, axe, teclado) |

## Complexity Tracking

Nenhuma violação.
