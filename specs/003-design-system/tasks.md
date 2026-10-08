# Tasks: Design System e Shell do App

**Input**: `specs/003-design-system/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto
- **IDs estáveis**: T001–T074 mantêm o número original; as tasks criadas na remediação
  pós-analyze (2026-10-05) são T075–T088 e estão **na posição de execução**. A ordem de
  execução é a ordem do arquivo, não a numérica.

---

## Phase 0: Pré-condição

- [x] T001 Confirmar que a emenda da constitution v1.1.0 e a 001 estão na `main`, e que a 004 já foi integrada (ordem de merge da onda 1: 004 → 003 → 006 → 002); rebasear `003-design-system` em `origin/main`; rodar `npm ci && npm run check` verde antes de qualquer mudança — branch `003-design-system`
- [x] T087 Atualizar `docs/roadmap.md` (003 → `impl`) num commit próprio — `docs/roadmap.md`

## Phase 1: Setup (infraestrutura compartilhada)

- [x] T086 [P] Teste de licenças e auto-hospedagem (vermelho até T002/T006): toda dependência de `package.json` tem licença em {MIT, ISC, Apache-2.0, BSD-*, OFL-1.1} lida de `node_modules/<pkg>/package.json`; existem `src/app/fonts/*.woff2` + `OFL.txt`; nenhum `src/**` referencia `fonts.googleapis`/`fonts.gstatic`/CDN de ícones — `tests/unit/licenses.test.ts` (FR-052)
- [x] T002 Instalar dependências fixadas do plan (`radix-ui`, `lucide-react`, `sonner`, `class-variance-authority`, `tailwind-merge`, `clsx`, `tw-animate-css`, `react-hook-form`, `@hookform/resolvers`; dev: `@axe-core/playwright`, `@testing-library/user-event`, `@testing-library/jest-dom`, `eslint-plugin-better-tailwindcss`) — `package.json`, `package-lock.json` (FR-052)
- [x] T003 Rodar `npx shadcn@4.21.1 init --base radix` primeiro com `--dry-run`; aplicar só `components.json` e `src/lib/utils.ts` (`cn`), preservando `globals.css`/`layout.tsx` da 001 (a variante `dark:` entra no T016) — `components.json`, `src/lib/utils.ts`
- [x] T004 [P] Adicionar projeto Vitest `component` (jsdom 29, `tests/component/**/*.test.tsx`, setup `tests/setup.ts` + `tests/setup-dom.ts` com jest-dom e stubs de `matchMedia`/`ResizeObserver`/`IntersectionObserver`) e script `test:component`; incluir em `check` — `vitest.config.ts`, `tests/setup-dom.ts`, `package.json`
- [x] T005 [P] Playwright: projeto `visual` (só `process.platform === "linux"`, `toHaveScreenshot` com `maxDiffPixelRatio: 0.01`), novos specs em `mobile-chrome`/`demo`, script `test:visual:update` via imagem `mcr.microsoft.com/playwright:v1.63.0-noble`; base URL sempre `http://localhost:<porta>` — `playwright.config.ts`, `package.json`, `scripts/visual-update.mjs`
- [x] T006 [P] Copiar Inter Variable (latin + latin-ext, normal + itálico) de `@fontsource-variable/inter@5.3.0` (via `npm pack`, sem virar dependência) para `src/app/fonts/` com `OFL.txt`, até a parte de fontes do T086 passar (R-04, FR-052)
- [x] T007 [P] ESLint: `eslint-plugin-better-tailwindcss` com `entryPoint: src/app/globals.css`; `no-unknown-classes` em `src/app/**` e `src/components/**` (**inclui `ui/`**); `no-restricted-classes` (proíbe `^dark:`, `\[.*\]`) em `src/app/**` e `src/components/{finance,states,forms,shell,brand}/**` — `eslint.config.mjs` (FR-004)
- [x] T008 CI **sem renomear jobs** (nomes da 001 são os checks obrigatórios da 002): job "Testes unitários" roda `test:unit` e `test:component`; job "Testes ponta a ponta (Playwright)" roda também o projeto `visual`, publica diffs de screenshot no artefato e tem `timeout-minutes` revisto (20 → medir; máx. 25) — `.github/workflows/ci.yml` (FR-049)

## Phase 2: Foundational (bloqueia todas as histórias)

### Testes (escrever primeiro — todos vermelhos antes do T016–T022)
- [x] T009 [P] Teste de contraste e direção da paleta: lê `src/styles/tokens.css`, extrai tokens claro/escuro, exige todos os pares de research R-03 + data-model §1.3 (falha listando par e razão) **e** as regras de paleta do data-model §1.2 (valores de §1.1, faixas de matiz de `primary`/`income`/`expense`, `expense` ≠ `danger`, fundos neutros quentes) — `tests/unit/tokens-contrast.test.ts` (FR-001, FR-002, FR-003, FR-019)
- [x] T010 [P] Teste guarda de tokens: varre `src/**/*.{ts,tsx,css}` e falha com literal de cor (`#hex`, `rgb(`, `hsl(`, `oklch(`) fora de `src/styles/tokens.css`, `src/styles/tokens.ts` e `src/components/brand/` (pega os hex atuais de `src/app/manifest.ts` e `src/app/layout.tsx`) — `tests/unit/tokens-guard.test.ts` (FR-004)
- [x] T084 [P] Teste do contrato de estilos: `tokens.ts` (`THEME_COLOR`, `BRAND_COLOR`, `SPLASH_BACKGROUND`) igual a `tokens.css`; `@custom-variant dark` com os seletores de data-model §1.1a; `--overlay` definido nos dois temas; `@utility pt-safe/pb-safe/pl-safe/pr-safe` usando `env(safe-area-inset-*)`; bloco `prefers-reduced-motion: reduce` zera `--duration-*` — `tests/unit/styles-contract.test.ts` (FR-001, FR-015, FR-018, FR-022)
- [ ] T085 [P] Guarda de escopo (regressão; passa desde o início e é provado por mutação local): `src/components/**`, `src/catalog/**`, `src/lib/{format,preferences,navigation,catalog-access}.ts` e as páginas da 003 em `src/app/(app)/**` não importam `@supabase/*`, `@/lib/supabase/*` nem `@/data/*`; a 003 não adiciona arquivos em `supabase/` (lista do diff contra `origin/main` vazia nesse caminho) — `tests/unit/scope-guard.test.ts` (FR-050, FR-051)
- [ ] T011 [P] Testes de tabela de `formatMoney`, `moneyToSpeech` (todas as linhas de data-model §5, NBSP e U+2212, rejeição de não inteiro/inseguro, sem `/100` no código-fonte) — `tests/unit/format-money.test.ts` (FR-025, FR-026, FR-028)
- [ ] T012 [P] Testes de `formatRelativeDate`, `formatAbsoluteDate`, `dateToSpeech`, `formatPeriod`, `todayInSaoPaulo` (virada do dia; fuso do processo ≠ SP trocando `process.env.TZ` dentro do teste e restaurando no `afterEach`, já que `vitest.config.ts`/`tests/setup.ts` fixam SP; anos diferentes) — `tests/unit/format-date.test.ts` (FR-029, FR-030)
- [ ] T013 [P] Testes de `parseMoneyInput` (todas as linhas de data-model §5) — `tests/unit/parse-money-input.test.ts` (FR-039)
- [ ] T014 [P] Testes de `parseTheme`/`parsePrivacy`/`serializePreferenceCookie` (valores inválidos → padrão; atributos do cookie) — `tests/unit/preferences.test.ts` (FR-018, FR-031)
- [ ] T015 [P] Teste de navegação: 5 destinos na ordem do contrato; `isActive` por prefixo (`/` exato); `FEATURE_SLOTS` contém cada feature 001–032 de `docs/roadmap.md` exatamente uma vez (006 em `/mais/seguranca`); rotas únicas; `OUTSIDE_SHELL_ROUTES` = contracts/navigation.md §2.1 e sem interseção com `FEATURE_SLOTS` — `tests/unit/navigation.test.ts` (FR-007, FR-008)
- [ ] T075 [P] E2E do root layout (contra a página atual da 001, vermelho até o T020): sem cookie → `<html lang="pt-BR">` sem `data-theme`; `prumo_theme=dark`/`light` → atributo no HTML do servidor; `prumo_privacy=on` → `data-privacy="on"`; cookie inválido → padrão; meta viewport contém `viewport-fit=cover`; metas `theme-color` = `THEME_COLOR` (duas por mídia no automático, uma com tema fixo); fonte Inter servida de `/_next/static/media` — `tests/e2e/root-layout.spec.ts` (FR-015, FR-018)
- [ ] T078 [P] `TodayProvider`/`useToday`: valor inicial vindo do servidor sem mismatch; recalcula em `visibilitychange`; `fixed` não recalcula — `tests/component/today-provider.test.tsx` (FR-029)
- [ ] T076 [P] `Button`: variantes primary/secondary/ghost/destructive; `pending` → `disabled` + `aria-busy` + spinner e clique repetido ignorado; tamanhos `sm`/`md` com `min-h-11` e `icon` com `min-h-11 min-w-11`; `icon` sem `aria-label` falha em dev; nenhuma classe `bg-black`/`text-white` nos primitivos (varre `src/components/ui/*`) — `tests/component/button.test.tsx` (FR-020, FR-021, FR-041)
- [ ] T077 [P] `Logo` (`role="img"`, `aria-label="Prumo"`, cores via `currentColor`/tokens, geometria de `logo-geometry.ts`) + `pwa.spec.ts` ampliado: `manifest.theme_color = BRAND_COLOR`, `background_color = SPLASH_BACKGROUND`, ícones 192/512/maskable regenerados (hash diferente do provisório) — `tests/component/logo.test.tsx`, `tests/e2e/pwa.spec.ts` (FR-006)

### Implementação
- [ ] T016 `src/styles/tokens.css` (data-model §1–2: cores, `--overlay`, categorias, raios, sombras, movimento, z, container; `--color-*: initial` + `@theme inline`; aliases shadcn; `@custom-variant dark` de §1.1a; utilitários `*-safe`) + `src/styles/tokens.ts` (§1.1b) e import em `globals.css` com base, `color-scheme`, foco visível global (`--focus`), `prefers-reduced-motion` e regras de privacidade — até T009/T010/T084 passarem (FR-001, FR-002, FR-003, FR-005, FR-015, FR-019, FR-022)
- [ ] T017 [P] `src/lib/format.ts`: `formatMoney`, `moneyToSpeech`, `parseMoneyInput`, datas e períodos (algoritmos do plan); remover `formatCents`/`formatDate` e atualizar chamadores + `tests/unit/format.test.ts` — até T011–T013 passarem (FR-025, FR-026, FR-028, FR-029, FR-030, FR-039)
- [ ] T018 [P] `src/lib/preferences.ts` até T014 passar (FR-018, FR-031)
- [ ] T019 [P] `src/lib/navigation.ts` (`DESTINATIONS`, `FEATURE_SLOTS` de contracts/navigation.md §2, `OUTSIDE_SHELL_ROUTES` de §2.1, `isActive`) até T015 passar (FR-007, FR-008)
- [ ] T020 Root layout: `next/font/local` (Inter); `cookies()` → `data-theme`/`data-privacy` no `<html>`; `viewport` com `viewportFit: "cover"` e `themeColor` de `tokens.ts` (por mídia no automático, único com tema fixo); `TodayProvider` com `todayInSaoPaulo()`; `DemoBadge` continua no root layout — `src/app/layout.tsx`, `src/components/shell/today-provider.tsx` até T075/T078 passarem (FR-012, FR-015, FR-018, FR-029)
- [ ] T021 Gerar primitivos com `npx shadcn@4.21.1 add button input textarea label field select switch radio-group dialog alert-dialog sheet dropdown-menu popover tooltip skeleton separator badge card sonner` e ajustar a tokens (`Button` variantes primary/secondary/ghost/destructive + `pending`; alvo de toque ≥ 44px; `bg-black/50` → `bg-overlay`, `text-white` → `text-*-foreground`; sem cores literais) — `src/components/ui/*` até T076 passar e `npm run lint` sem `no-unknown-classes` (FR-020, FR-021, FR-041)
- [ ] T022 [P] Logotipo: extrair geometria do fio de prumo para `src/components/brand/logo-geometry.ts`, componente `src/components/brand/logo.tsx` (símbolo + "Prumo", `aria-label`), `scripts/generate-icons.mjs` usando a geometria e as cores de `tokens.ts`; regenerar `public/icons/*`; `src/app/manifest.ts` com cores de `tokens.ts` — até T077 passar (FR-006)

**Checkpoint**: tokens, formatação, preferências, navegação, root layout, primitivos e marca prontos; T009–T015, T075–T078, T084–T086 verdes.

---

## Phase 3: US1 — Shell navegável, mobile-first (P1) 🎯 MVP

**Independent Test**: preview em 360px e 1280px → navegar pelas 5 seções, destaque correto, selo demo, telas "em breve".

### Testes (escrever primeiro)
- [ ] T023 [P] [US1] Componentes `BottomNav`/`SideNav`: 5 links com ícone + rótulo, `aria-current` no ativo, landmark `nav` "Principal", `BottomNav` com `pb-safe` e links `min-h-11` — `tests/component/nav.test.tsx` (FR-007, FR-011, FR-015, FR-021)
- [ ] T088 [P] [US1] `PageHeader`: `h1` com o título; `back` vira link "Voltar" acessível; 1–2 ações visíveis e, a partir da 3ª, menu "Mais ações" (teclado: abre, navega, Esc fecha); `PrivacyToggle` sempre presente; `pt-safe` aplicado — `tests/component/page-header.test.tsx` (FR-010, FR-015)
- [ ] T024 [P] [US1] Componente `OfflineBanner` + `useOnline` (eventos online/offline) e `ComingSoon` ("Em breve" + texto padrão) — `tests/component/offline-banner.test.tsx` (FR-009, FR-014)
- [ ] T025 [P] [US1] E2E shell: 360px barra inferior / 1280px menu lateral; clicar em cada destino muda URL e destaque; voltar/avançar; `ComingSoon` nas 4 seções com h1 = nome da seção; `/mais` lista Ajustes e Catálogo; chip "Local"; 1º Tab foca "Pular para o conteúdo" e leva a `#conteudo`; sem rolagem horizontal; `context.setOffline(true)` mostra e remove o aviso; `/nao-existe` → "Página não encontrada" em pt-BR, com tokens e sem a navegação "Principal" — `tests/e2e/shell.spec.ts` (FR-007, FR-009, FR-011, FR-013, FR-014, FR-016, FR-020, FR-038)
- [ ] T026 [P] [US1] Atualizar E2E da 001 para o shell: `home.spec.ts` (h1 "Início", logo "Prumo" no menu/cabeçalho, `lang=pt-BR`) e `demo.spec.ts` (selo em todas as 5 seções, em `/catalogo`, em `/~offline` e em `/nao-existe`; sem chip "Local"; selo visível com diálogo aberto) — `tests/e2e/home.spec.ts`, `tests/e2e/demo.spec.ts` (FR-006, FR-012, FR-013, FR-050)
- [ ] T079 [P] [US1] `pwa.spec.ts`: depois de uma visita online, `setOffline(true)` + navegação → "Você está sem conexão" com `Logo` e fundo calculado = `--background` (CSS do cache de runtime); `CACHE` do service worker = `prumo-shell-v2` — `tests/e2e/pwa.spec.ts` (FR-006)

### Implementação
- [ ] T027 [US1] `src/lib/navigation.ts` consumido por `BottomNav` e `SideNav` (cliente, `usePathname`), áreas seguras via `pb-safe`, altura mínima e alvos ≥ 44px — `src/components/shell/bottom-nav.tsx`, `src/components/shell/side-nav.tsx` até T023 passar (FR-007, FR-011, FR-015, FR-021)
- [ ] T028 [US1] `AppShell` + `SkipLink` + `EnvIndicator` (só `local`, renderizado no root layout) + mover `DemoBadge` para `src/components/shell/demo-badge.tsx` com tokens `demo` e `z-demo` (continua importado pelo root layout) — `src/components/shell/app-shell.tsx`, `skip-link.tsx`, `env-indicator.tsx`, `demo-badge.tsx`, `src/app/layout.tsx` até a parte de selo/chip/skip-link de T025/T026 passar (FR-012, FR-013, FR-020)
- [ ] T029 [US1] `PageHeader` (h1, voltar, até 2 ações + menu "Mais ações", slot do `PrivacyToggle`, `pt-safe`) — `src/components/shell/page-header.tsx` até T088 passar (FR-010, FR-015)
- [ ] T030 [US1] `OfflineBanner` + `use-online.ts` e `ComingSoon` até T024 passar — `src/components/shell/offline-banner.tsx`, `src/components/shell/use-online.ts`, `src/components/shell/coming-soon.tsx` (FR-009, FR-014)
- [ ] T031 [US1] Route group `(app)`: `layout.tsx` com `AppShell`, `page.tsx` (Início), `extrato`, `planejamento`, `investimentos`, `mais` (atalhos existentes), `loading.tsx`, `error.tsx`, `not-found.tsx`; `src/app/not-found.tsx` raiz (fora do shell, pt-BR, tokens, `Logo`, "Voltar ao início"); remover `src/app/page.tsx` — `src/app/(app)/**`, `src/app/not-found.tsx` até T025/T026 passarem (FR-007, FR-009, FR-011, FR-016, FR-038)
- [ ] T032 [P] [US1] Página offline com tokens e `Logo` + `public/sw.js` (`CACHE = "prumo-shell-v2"`, cache-first de `/_next/static/css/*` e `/_next/static/media/*`) — `src/app/~offline/page.tsx`, `public/sw.js` até T079 passar (FR-006)

**Checkpoint**: shell navegável em local e demo; telas fora do shell com selo e visual.

---

## Phase 4: US2 — Valores monetários e datas inconfundíveis (P1)

**Independent Test**: `/catalogo/money` e `/catalogo/relative-date` conferem com a tabela de data-model §5 nos dois temas.

### Testes
- [ ] T033 [P] [US2] `Money`: variantes movement/balance/neutral/compact (texto, classe de token, `tabular-nums`), sinal sempre presente em movimentação negativa/positiva (não só cor), `null` → "—"/"valor indisponível", sr-only com fala, máscara presente, popover do compacto com valor completo, `TypeError` com `cents` não inteiro — `tests/component/money.test.tsx` (FR-005, FR-019, FR-025, FR-026, FR-027, FR-028)
- [ ] T034 [P] [US2] `RelativeDate` com `TodayProvider` (Hoje/Ontem/Amanhã/mesmo ano/outro ano, `<time dateTime>`, `aria-label` completo) e `PeriodLabel` — `tests/component/relative-date.test.tsx` (FR-029, FR-030)

### Implementação
- [ ] T035 [US2] `src/components/finance/money.tsx` (Server-compatível; popover só no compacto) até T033 passar (FR-005, FR-025–FR-028)
- [ ] T036 [P] [US2] `src/components/finance/relative-date.tsx` e `src/components/finance/period-label.tsx` até T034 passar (FR-029, FR-030)

---

## Phase 5: US3 — Componentes base e estados padronizados (P1)

**Independent Test**: cada componente no catálogo com todas as variantes/estados, operável por teclado, toque e leitor de tela.

### Testes
- [ ] T082 [P] [US3] `categoryVisual`/`CATEGORY_VISUALS` (24 chaves = categorias de 1º nível lidas de `src/domain/core/default-categories.ts` da 004, já integrada antes — ordem 004 → 003; + `sem-categoria` + `personalizada`; nenhuma categoria de 1º nível sem chave; `systemKey` → chave; slug desconhecido → `personalizada`; `null` → `sem-categoria`; todo ícone existe no `lucide-react`; toda cor ∈ `CategoryColor`) e `institutionInitials` (tabela de data-model §5) — `tests/unit/category-visuals.test.ts` (FR-036)
- [ ] T037 [P] [US3] `TransactionItem` (view models do `examples.ts`/seed 42: categoria via `visual`, conta, pendente, parcela "3/10", natureza "Entre contas"/"Pagamento de fatura"/"Estorno" como texto, moeda original "US$", sem categoria, descrição longa com `line-clamp` e texto completo, valor ≥ R$ 1 bi sem sobrepor/empurrar a descrição em 320px, `href` vs `onSelect`, densidades); `InstitutionAvatar` mostra iniciais sem ícone — `tests/component/transaction-item.test.tsx` (FR-032, FR-036)
- [ ] T038 [P] [US3] `SummaryCard` (delta "↓ −R$ 120,00 vs. agosto": seta + sinal + texto; estados loading/error/empty; valor ≥ R$ 1 bi em 320px) e `GroupedList` (cabeçalho por data, total do dia, `ul/li`) — `tests/component/summary-card.test.tsx` (FR-033, FR-034)
- [ ] T039 [P] [US3] `SourceBadge`: manual/regra/fonte/IA alta/média/baixa ("revisar"), popover explicativo, "Corrigir" chama `onCorrect` — `tests/component/source-badge.test.tsx` (FR-035)
- [ ] T040 [P] [US3] Estados: `EmptyState` (empty/no-results com "Limpar filtros"), `LoadingSkeleton` (`aria-busy`, texto sr), `SlowLoading` (fake timers 10 s), `ErrorState` (textos padrão, "Tentar novamente", sem detalhe técnico; `scope="block"` com dois blocos irmãos → só o que falhou mostra erro e o outro continua interativo) — `tests/component/states.test.tsx` (FR-037, FR-038)
- [ ] T080 [P] [US3] Fronteiras de rota (`renderToStaticMarkup`/jsdom): `(app)/loading.tsx` → esqueleto `aria-busy`; `(app)/error.tsx` e `src/app/global-error.tsx` → textos padrão pt-BR, botão chama `reset()`, nunca exibem `error.message`/`digest`; `(app)/not-found.tsx` e `src/app/not-found.tsx` → `EmptyState` "Página não encontrada" + "Voltar ao início" — `tests/component/route-boundaries.test.tsx` (FR-037, FR-038)
- [ ] T041 [P] [US3] `MoneyInput` (digitar "1.234,5" → "R$ 1.234,50" no blur, cents −123450 com Saída, `inputMode="decimal"`, erros), `DateInput` (chips Hoje/Ontem), `SelectField` (≤ 7 opções → select; > 7 → lista com busca em painel inferior em 360px e diálogo em 1280px), `SwitchField` (rótulo clicável, estado anunciado), `TextareaField` (contador anunciado) — `tests/component/money-input.test.tsx` (FR-039, FR-044)
- [ ] T042 [P] [US3] Formulário de exemplo com `useAppForm`: valida ao sair do campo e no envio, foco no 1º inválido, erro anunciado (`aria-invalid`, `aria-describedby`), `SubmitButton` ignora duplo envio; **offline** (`navigator.onLine=false`) → ação não é chamada, botão volta ao normal e aparece "Sem conexão: nada foi salvo…"; ação rejeitada por rede → mesma mensagem — `tests/component/form.test.tsx` (FR-040, FR-041)
- [ ] T043 [P] [US3] `ConfirmDialog` (texto nomeia ação/objeto, foco inicial "Cancelar", não fecha por toque fora) e `ResponsiveDialog` (sheet < md, dialog ≥ md, Esc, `popstate` fecha, foco volta ao gatilho, véu `bg-overlay`); `notify` (duração ≥ 5 s, `undo` persistente e bloqueado offline, `aria-live`) — `tests/component/dialogs.test.tsx` (FR-024, FR-042, FR-043, FR-044)

### Implementação
- [ ] T044 [P] [US3] `category-visuals.ts` (`CATEGORY_VISUALS`, `categoryVisual`, `CategoryVisualKey`), `category-icon.tsx` e `institution-avatar.tsx` (`institutionInitials`) — `src/components/finance/` até T082 passar (FR-036)
- [ ] T045 [US3] `transaction-item.tsx`, `grouped-list.tsx`, `summary-card.tsx` até T037/T038 passarem — `src/components/finance/` (FR-032, FR-033, FR-034)
- [ ] T046 [P] [US3] `source-badge.tsx` até T039 passar — `src/components/finance/source-badge.tsx` (FR-035)
- [ ] T047 [P] [US3] `empty-state.tsx`, `loading-skeleton.tsx`, `slow-loading.tsx`, `error-state.tsx`; aplicar em `(app)/loading.tsx`/`error.tsx`/`not-found.tsx` e no `src/app/not-found.tsx`; criar `src/app/global-error.tsx` (html/body próprios, `globals.css`, textos padrão) — `src/components/states/`, `src/app/` até T040/T080 passarem (FR-037, FR-038)
- [ ] T048 [US3] `form-field.tsx`, `money-input.tsx`, `date-input.tsx`, `select-field.tsx`, `switch-field.tsx`, `textarea-field.tsx`, `submit-button.tsx`, `use-app-form.ts`, `run-online.ts` até T041/T042 passarem — `src/components/forms/` (FR-039, FR-040, FR-041, FR-044)
- [ ] T049 [US3] `confirm-dialog.tsx`, `responsive-dialog.tsx`, `use-back-to-close.ts`, `notify.ts` (inclui `offlineAction`) + `<Toaster>` **único no root layout** (top-center < md, bottom-right ≥ md) até T043 passar — `src/components/forms/`, `src/components/shell/`, `src/app/layout.tsx` (FR-024, FR-042, FR-043, FR-044)

---

## Phase 6: US4 — Tema claro/escuro e acessibilidade (P2)

**Independent Test**: alternar tema do sistema e manual, recarregar, navegar só por teclado/leitor, axe 0 violações nos dois temas.

### Testes
- [ ] T050 [P] [US4] `ThemeSelect` (radio Automático/Claro/Escuro altera `data-theme` e grava cookie; cookie bloqueado (`document.cookie` lançando) mantém a mudança na sessão sem erro; atualiza todas as `meta[name=theme-color]` e restaura por mídia no Automático) — `tests/component/theme-select.test.tsx` (FR-017, FR-018)
- [ ] T051 [P] [US4] E2E tema: HTML do servidor sem `data-theme` no automático e com `light`/`dark` pelo cookie; `emulateMedia({colorScheme:"dark"})` → fundo `#141312` antes de qualquer script (`javaScriptEnabled: false`); escolha persiste após reload; **cookie `light` + sistema dark → diálogo e popover de `ui/` com `surface` claro** (variante `dark:` redefinida) — `tests/e2e/theme.spec.ts` (FR-018)
- [ ] T052 [P] [US4] E2E acessibilidade: `@axe-core/playwright` (wcag2a/aa, 21a/aa) em todas as rotas do shell, do catálogo, `/~offline` e `/nao-existe` × claro/escuro × 360/1280 px → 0 violações — `tests/e2e/a11y.spec.ts` (FR-019, FR-020, SC-002)
- [ ] T053 [P] [US4] E2E teclado: "Pular para o conteúdo" é o 1º Tab; foco visível (outline ≥ 2px em cor `focus`) em todo interativo; ordem segue o visual; diálogo prende e devolve foco; `history.back()` com diálogo aberto fecha o diálogo (gesto de voltar) — `tests/e2e/keyboard.spec.ts` (FR-020, FR-024, SC-007)
- [ ] T054 [P] [US4] E2E reflow e movimento: 320 e 1920 px sem rolagem horizontal; texto 200% (`html { font-size: 200% }`) sem conteúdo cortado nas seções; `reducedMotion: "reduce"` → `transition-duration` efetiva 0; alvos de toque ≥ 44×44 na nav e botões — `tests/e2e/reflow.spec.ts` (FR-016, FR-021, FR-022, FR-023, SC-008)

### Implementação
- [ ] T055 [US4] `theme-select.tsx` + página `src/app/(app)/mais/ajustes/page.tsx` (seção Tema) + atualização das `<meta name="theme-color">` (plan "Fluxo — preferências" passo 5) até T050/T051 passarem (FR-017, FR-018)
- [ ] T056 [US4] Corrigir violações apontadas por T052–T054 (rótulos, landmarks, ordem de foco, tamanhos) até passarem — arquivos afetados em `src/components/**` (FR-019–FR-023)

---

## Phase 7: US5 — Modo privacidade (P2)

**Independent Test**: ativar no cabeçalho → todo valor vira `R$ ••••` (inclusive para leitor), recarregar mantém; campos de digitação não mascaram.

### Testes
- [ ] T057 [P] [US5] `PrivacyToggle`: `aria-pressed`, rótulo "Ocultar valores"/"Mostrar valores", alterna `data-privacy` e grava cookie; cookie bloqueado não quebra (mantém na sessão) — `tests/component/privacy-toggle.test.tsx` (FR-031)
- [ ] T058 [P] [US5] E2E privacidade: em `/catalogo/money` e `/catalogo/summary-card` todos os `[data-money]` mostram `R$ ••••` com largura igual entre valores pequenos e grandes; snapshot de acessibilidade contém "valor oculto" e nenhum "R$ 1"; reload mantém via HTML do servidor; o switch "Ocultar valores" em `/mais/ajustes` liga/desliga o mesmo estado que o cabeçalho; `MoneyInput` continua mostrando o digitado — `tests/e2e/privacy.spec.ts` (FR-017, FR-027, FR-031)

### Implementação
- [ ] T059 [US5] `privacy-toggle.tsx` no `PageHeader` + switch "Ocultar valores" em `/mais/ajustes` até T057/T058 passarem — `src/components/shell/privacy-toggle.tsx`, `src/app/(app)/mais/ajustes/page.tsx` (FR-017, FR-031)

---

## Phase 8: US6 — Catálogo navegável e regras de uso (P2)

**Independent Test**: `/catalogo` no preview → achar cada componente, alternar tema/privacidade na página, ver regras de uso; inexistente em produção.

### Testes
- [ ] T060 [P] [US6] `isCatalogEnabled` (local/preview true, production false) — `tests/unit/catalog-access.test.ts` (FR-046)
- [ ] T061 [P] [US6] Registro do catálogo: invariantes de contracts/catalog.md §2 (todo componente exportado registrado; regras completas; slugs únicos; `states` cobre todas as variantes da API em contracts/components.md) — `tests/unit/catalog-registry.test.ts` (FR-045, FR-047, SC-001)
- [ ] T083 [P] [US6] `examples.ts`: determinístico (duas chamadas = mesmo resultado); toda linha da tabela de data-model §7 aparece ao menos uma vez; descrições/valores só do dataset seed 42 (nenhum literal fora dos casos-limite permitidos); `CATALOG_TODAY = anchorDate` — `tests/unit/catalog-examples.test.ts` (FR-045, FR-050)
- [ ] T062 [P] [US6] E2E catálogo: busca "valor" encontra "Valor monetário"; cada página tem seções "Quando usar", "Quando não usar", "Acessibilidade", "Textos padrão", "Certo × errado"; toggles de tema/privacidade refletem na hora; guia de escrita lista os textos padrão — `tests/e2e/catalog.spec.ts` (FR-045, FR-047, FR-048)
- [ ] T063 [P] [US6] Visual: screenshot de cada página do catálogo × claro/escuro × 360/1280 px (baselines Linux geradas por `test:visual:update`; "hoje" fixo em `CATALOG_TODAY`, então as datas relativas não mudam) — `tests/e2e/visual.spec.ts` (FR-045, FR-049, SC-001)

### Implementação
- [ ] T064 [US6] `src/lib/catalog-access.ts` + `src/app/(app)/catalogo/layout.tsx` (`notFound()` em produção, navegação lateral do catálogo, busca, `<TodayProvider today={CATALOG_TODAY} fixed>`) até T060 passar (FR-046)
- [ ] T065 [US6] `src/catalog/registry.ts` + `src/catalog/examples.ts` (gerador seed 42, memoizado, derivação de data-model §7) + entradas em `src/catalog/entries/*.tsx` para todos os componentes de finance/states/forms/shell até T061/T083 passarem (FR-045, FR-047, FR-050)
- [ ] T066 [US6] Páginas `catalogo/page.tsx`, `[slug]/page.tsx`, `fundamentos/[topic]/page.tsx` (cores com nome/valor/contraste, tipografia, espaçamento, ícones — inclui o mapa de categorias —, movimento) e `escrita/page.tsx` até T062 passar — `src/app/(app)/catalogo/**` (FR-045, FR-047, FR-048)
- [ ] T067 [US6] Gerar baselines visuais (`npm run test:visual:update`) e versionar, até T063 passar — `tests/e2e/visual.spec.ts-snapshots/` (FR-049)

---

## Phase 9: Polish & transversais

- [ ] T068 [P] E2E desempenho: CDP CPU 4× + rede "Fast 4G" → navegação principal visível e clicável ≤ 2 s após `goto("/")`; troca de seção ≤ 300 ms; JS de cliente transferido na 1ª carga de `/` ≤ 120 kB gzip (soma dos `script` via `performance.getEntriesByType("resource")`) — `tests/e2e/perf.spec.ts` (SC-005)
- [ ] T081 [P] E2E da tela de exemplo (vermelho até T069): `/catalogo/exemplo-extrato` renderiza; nenhum elemento com `style` inline de cor/tamanho; toda `color`/`background-color`/`border-color` calculada ∈ conjunto de tokens do tema ativo (claro e escuro); tamanhos de fonte ∈ escala de data-model §2 — `tests/e2e/example-screen.spec.ts` (FR-004, SC-006)
- [ ] T069 Tela de exemplo só com componentes do catálogo (`/catalogo/exemplo-extrato`, contracts/catalog.md §5), incluída em T052/T063; lint sem violações — `src/app/(app)/catalogo/exemplo-extrato/page.tsx` até T081 passar (FR-004, SC-006)
- [ ] T070 [P] Acrescentar seção "UI: use o design system" em `AGENTS.md` (link para `/catalogo`, `contracts/components.md`, `contracts/navigation.md` §2/§2.1, regras de lint; telas fora do shell também usam o DS) — `AGENTS.md` (FR-047)
- [ ] T071 Rodar `quickstart.md` do zero (Windows Git Bash) e corrigir divergências — `specs/003-design-system/quickstart.md`
- [ ] T072 Verificação manual (Doug) dos critérios de aprovação: escala de cinza 10/10 (SC-004), TalkBack/VoiceOver + NVDA/Narrador (SC-007), PWA no celular (confirmação complementar de área segura e de gesto de voltar fechando diálogo — já cobertos por T075/T084/T088/T053) — evidência no PR, sem dados reais
- [ ] T073 Registrar no PR: licenças (saída do T086), minutos de CI e escopo (saída do T085: nenhuma migração/tabela; nenhuma tela de feature além de `ComingSoon`) — descrição do PR (FR-051, FR-052)
- [ ] T074 Atualizar `docs/roadmap.md` (003 → `review`) e abrir PR `003 · Design system e shell` com rótulos `autor:claude` + `iniciativa:0`, milestone `0 · Plataforma` e template `.github/pull_request_template.md` se já existir; Doug revisa identidade no preview (SC-009)

---

## Dependencies & Execution Order

- T001 (v1.1.0 + 001 + 004 na `main`) → T087 → Phase 1 → Phase 2 → histórias.
- Na Phase 2, os testes T009–T015, T075–T078, T084–T086 vêm antes de T016–T022; T075/T077 são E2E (precisam de `next build`).
- US1 (shell) primeiro: as demais histórias são verificadas dentro do shell e do catálogo.
- US2 depende só da Phase 2 — **pode rodar em paralelo com US1**.
- US3 depende de US2 (`Money`, `RelativeDate` dentro de `TransactionItem`/`SummaryCard`); T047 depende de T031 (arquivos de rota).
- US4 depende de US1 (rotas) e de US3 para o axe completo; T055 cria `/mais/ajustes`.
- US5 depende de US2 (`Money`) e T055 (página Ajustes); T058 usa páginas do catálogo → após T066
  (ou rodar contra `/catalogo/money` assim que T065/T066 existirem).
- US6 depende de US2/US3 (componentes a catalogar); T052, T058, T063 dependem do catálogo.
- Phase 9 depois de todas as histórias; T074 por último.
- Entre features: a 006 faz rebase sobre a 003 integrada e não recria `(app)/layout.tsx`/`(app)/page.tsx` (contracts/navigation.md §6).

## Parallel Opportunities

- Phase 1: T086, T004, T005, T006, T007 juntos.
- Phase 2: T009–T015, T075–T078, T084, T085 (testes) juntos; T017, T018, T019, T022 juntos.
- US1 ∥ US2 após a Phase 2 (arquivos disjuntos: `shell/` × `finance/money|relative-date`).
- US3: T082, T037–T043, T080 juntos; T044, T046, T047 em paralelo.
- US4/US5/US6: testes [P] de cada fase juntos.

## Implementation Strategy

1. MVP: Phases 0–2 + US1 + US2 → shell com valores/datas corretos (já desbloqueia 012 e 025).
2. US3 → componentes de finanças e estados (necessários para 012/017).
3. US4 + US5 → tema, a11y e privacidade.
4. US6 → catálogo + visual; Polish; PR (revisão Gemini) + Gate 3.

## Rastreabilidade FR → Testes automatizados → Implementação

| FR | Testes | Implementação |
|---|---|---|
| 001 | T009, T084 | T016 |
| 002 | T009 | T016 |
| 003 | T009 | T016 |
| 004 | T010, T081 | T007 (lint), T016, T069 |
| 005 | T033 | T016, T035 |
| 006 | T077, T079, T026 | T022, T032 |
| 007 | T015, T023, T025 | T019, T027, T031 |
| 008 | T015 | T019 |
| 009 | T024, T025 | T030, T031 |
| 010 | T088 | T029 |
| 011 | T023, T025 | T027, T031 |
| 012 | T026 | T020, T028 |
| 013 | T025, T026 | T028 |
| 014 | T024, T025 | T030 |
| 015 | T075, T084, T023, T088 | T016, T020, T027, T029 |
| 016 | T025, T054 | T031 |
| 017 | T050, T058 | T055, T059 |
| 018 | T014, T075, T084, T050, T051 | T016, T018, T020, T055 |
| 019 | T009, T033, T052 | T016, T056 |
| 020 | T076, T025, T052, T053 | T021, T028, T056 |
| 021 | T076, T023, T054 | T021, T027, T056 |
| 022 | T084, T054 | T016, T056 |
| 023 | T054 | T056 |
| 024 | T043, T053 | T049 |
| 025 | T011, T033 | T017, T035 |
| 026 | T011, T033 | T017, T035 |
| 027 | T033, T058 | T035 |
| 028 | T011, T033 | T017, T035 |
| 029 | T012, T078, T034 | T017, T020, T036 |
| 030 | T012, T034 | T017, T036 |
| 031 | T014, T057, T058 | T018, T059 |
| 032 | T037 | T045 |
| 033 | T038 | T045 |
| 034 | T038 | T045 |
| 035 | T039 | T046 |
| 036 | T082, T037 | T044 |
| 037 | T040, T080 | T047 |
| 038 | T040, T080, T025 | T031, T047 |
| 039 | T013, T041 | T017, T048 |
| 040 | T042 | T048 |
| 041 | T076, T042 | T021, T048 |
| 042 | T043 | T049 |
| 043 | T043 | T049 |
| 044 | T041, T043 | T048, T049 |
| 045 | T061, T083, T062, T063 | T065, T066 |
| 046 | T060 | T064 |
| 047 | T061, T062 | T065, T066, T070 |
| 048 | T062 | T066 |
| 049 | T063 | T008, T067 |
| 050 | T085, T026, T083 | T065 (restrição: nenhum acesso a banco) |
| 051 | T085 | — (restrição de escopo; registro em T073) |
| 052 | T086 | T002, T006 (registro em T073) |

**Edge cases** → testes: valores extremos T037/T038 · centavos e ausente T011/T033 · moeda ≠ BRL T011/T037 ·
descrição longa T037 · virada do dia T012 · vazio × filtro T040 · demora T040 · erro parcial T040 ·
offline durante ação T042/T043 · duplo envio T042/T076 · 6º destino T015 · preferências
indisponíveis T050/T057 · 320/1920 px T054 · selo sobre diálogo T026 · endereço inexistente
T025/T080 · telas fora do shell T026/T052.

| SC | Testes automatizados | Manual (aprovação) |
|---|---|---|
| SC-001 | T061, T062, T063 | — |
| SC-002 | T052 | — |
| SC-003 | T011, T012 | — |
| SC-004 | T033 (sinal sempre presente) | T072 |
| SC-005 | T068 | — |
| SC-006 | T081 | — |
| SC-007 | T053, T052 | T072 (leitores de tela reais) |
| SC-008 | T054 | — |
| SC-009 | — | T074 (Doug no preview) |
