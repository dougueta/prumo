# Tasks: Design System e Shell do App

**Input**: `specs/003-design-system/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: OBRIGATÓRIOS (Constitution V) — cada teste é escrito e falha antes da implementação.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[US#]**: história da spec · **FR-###**: requisito coberto

---

## Phase 0: Pré-condição

- [ ] T001 Confirmar que a 001 está na `main` (merge feito) e rebasear `003-design-system` em `origin/main`; rodar `npm ci && npm run check` verde antes de qualquer mudança — branch `003-design-system`

## Phase 1: Setup (infraestrutura compartilhada)

- [ ] T002 Instalar dependências fixadas do plan (`radix-ui`, `lucide-react`, `sonner`, `class-variance-authority`, `tailwind-merge`, `clsx`, `tw-animate-css`, `react-hook-form`, `@hookform/resolvers`; dev: `@axe-core/playwright`, `@testing-library/user-event`, `@testing-library/jest-dom`, `eslint-plugin-better-tailwindcss`) — `package.json`, `package-lock.json`
- [ ] T003 Rodar `npx shadcn@4.21.1 init --base radix` primeiro com `--dry-run`; aplicar só `components.json` e `src/lib/utils.ts` (`cn`), preservando `globals.css`/`layout.tsx` da 001 — `components.json`, `src/lib/utils.ts`
- [ ] T004 [P] Adicionar projeto Vitest `component` (jsdom 29, `tests/component/**/*.test.tsx`, setup `tests/setup.ts` + `tests/setup-dom.ts` com jest-dom e stubs de `matchMedia`/`ResizeObserver`) e script `test:component`; incluir em `check` — `vitest.config.ts`, `tests/setup-dom.ts`, `package.json`
- [ ] T005 [P] Playwright: projeto `visual` (só `process.platform === "linux"`, `toHaveScreenshot` com `maxDiffPixelRatio: 0.01`), novos specs em `mobile-chrome`/`demo`, script `test:visual:update` via imagem `mcr.microsoft.com/playwright:v1.63.0-noble` — `playwright.config.ts`, `package.json`, `scripts/visual-update.mjs`
- [ ] T006 [P] Copiar Inter Variable (latin + latin-ext, normal + itálico) de `@fontsource-variable/inter@5.3.0` para `src/app/fonts/` com `OFL.txt`; sem dependência em runtime (R-04)
- [ ] T007 [P] ESLint: `eslint-plugin-better-tailwindcss` com `entryPoint: src/app/globals.css`, regras `no-unknown-classes` e `no-restricted-classes` (proíbe `^dark:`, `\[.*\]`) em `src/app/**` e `src/components/{finance,states,forms,shell,brand}/**` — `eslint.config.mjs` (FR-004)
- [ ] T008 CI: job `unit` roda `test:unit` e `test:component`; job `e2e` roda também o projeto `visual` e publica diffs de screenshot no artefato — `.github/workflows/ci.yml` (FR-049)

## Phase 2: Foundational (bloqueia todas as histórias)

### Testes (escrever primeiro)
- [ ] T009 [P] Teste de contraste: lê `src/styles/tokens.css`, extrai tokens claro/escuro e exige todos os pares de research R-03 + data-model §1.3 (falha listando par e razão) — `tests/unit/tokens-contrast.test.ts` (FR-001, FR-003, FR-019)
- [ ] T010 [P] Teste guarda de tokens: varre `src/**/*.{ts,tsx,css}` e falha com literal de cor (`#hex`, `rgb(`, `hsl(`, `oklch(`) fora de `src/styles/tokens.css` e `src/components/brand/` — `tests/unit/tokens-guard.test.ts` (FR-004)
- [ ] T011 [P] Testes de tabela de `formatMoney`, `moneyToSpeech` (todas as linhas de data-model §5, NBSP e U+2212, rejeição de não inteiro/inseguro, sem `/100` no código-fonte) — `tests/unit/format-money.test.ts` (FR-025, FR-026, FR-028)
- [ ] T012 [P] Testes de `formatRelativeDate`, `formatAbsoluteDate`, `dateToSpeech`, `formatPeriod`, `todayInSaoPaulo` (virada do dia, fuso do processo ≠ SP, anos diferentes) — `tests/unit/format-date.test.ts` (FR-029, FR-030)
- [ ] T013 [P] Testes de `parseMoneyInput` (todas as linhas de data-model §5) — `tests/unit/parse-money-input.test.ts` (FR-039)
- [ ] T014 [P] Testes de `parseTheme`/`parsePrivacy`/`serializePreferenceCookie` (valores inválidos → padrão; atributos do cookie) — `tests/unit/preferences.test.ts` (FR-018, FR-031)
- [ ] T015 [P] Teste de navegação: 5 destinos na ordem do contrato; `isActive` por prefixo (`/` exato); `FEATURE_SLOTS` contém cada feature 001–032 de `docs/roadmap.md` exatamente uma vez; rotas únicas — `tests/unit/navigation.test.ts` (FR-007, FR-008)

### Implementação
- [ ] T016 `src/styles/tokens.css` (data-model §1–2: cores, categorias, raios, sombras, movimento, z, container; `--color-*: initial` + `@theme inline`; aliases shadcn) e import em `globals.css` com base, `color-scheme`, foco visível global (`--focus`), `prefers-reduced-motion` e regras de privacidade — até T009/T010 passarem (FR-001, FR-002, FR-003, FR-005, FR-019, FR-022)
- [ ] T017 [P] `src/lib/format.ts`: `formatMoney`, `moneyToSpeech`, `parseMoneyInput`, datas e períodos (algoritmos do plan); remover `formatCents`/`formatDate` e atualizar chamadores + `tests/unit/format.test.ts` — até T011–T013 passarem (FR-025, FR-026, FR-029, FR-030, FR-039)
- [ ] T018 [P] `src/lib/preferences.ts` até T014 passar (FR-018, FR-031)
- [ ] T019 [P] `src/lib/navigation.ts` (`DESTINATIONS`, `FEATURE_SLOTS` de contracts/navigation.md §2, `isActive`) até T015 passar (FR-007, FR-008)
- [ ] T020 Root layout: `next/font/local` (Inter), `cookies()` → `data-theme`/`data-privacy` no `<html>`, `TodayProvider` com `todayInSaoPaulo()`, `themeColor` dos tokens `background` — `src/app/layout.tsx`, `src/components/shell/today-provider.tsx` (FR-018, FR-029)
- [ ] T021 Gerar primitivos com `npx shadcn@4.21.1 add button input textarea label field select switch radio-group dialog alert-dialog sheet dropdown-menu popover tooltip skeleton separator badge card sonner` e ajustar a tokens (`Button` variantes primary/secondary/ghost/destructive + `pending`; alvo de toque ≥ 44px; sem cores literais) — `src/components/ui/*` (FR-021, FR-041)
- [ ] T022 [P] Logotipo: extrair geometria do fio de prumo para `src/components/brand/logo-geometry.ts`, componente `src/components/brand/logo.tsx` (símbolo + "Prumo", `aria-label`) e `scripts/generate-icons.mjs` passando a usar a geometria; regenerar `public/icons/*` — (FR-006)

**Checkpoint**: tokens, formatação, preferências, navegação e primitivos prontos.

---

## Phase 3: US1 — Shell navegável, mobile-first (P1) 🎯 MVP

**Independent Test**: preview em 360px e 1280px → navegar pelas 5 seções, destaque correto, selo demo, telas "em breve".

### Testes (escrever primeiro)
- [ ] T023 [P] [US1] Componentes `BottomNav`/`SideNav`: 5 links com ícone + rótulo, `aria-current` no ativo, landmark `nav` "Principal" — `tests/component/nav.test.tsx` (FR-007, FR-011)
- [ ] T024 [P] [US1] Componente `OfflineBanner` + `useOnline` (eventos online/offline) e `ComingSoon` — `tests/component/offline-banner.test.tsx` (FR-009, FR-014)
- [ ] T025 [P] [US1] E2E shell: 360px barra inferior / 1280px menu lateral; clicar em cada destino muda URL e destaque; voltar/avançar; `ComingSoon` nas 4 seções; `/mais` lista Ajustes e Catálogo; chip "Local"; sem rolagem horizontal; `context.setOffline(true)` mostra e remove o aviso — `tests/e2e/shell.spec.ts` (FR-007, FR-009, FR-011, FR-013, FR-014, FR-016)
- [ ] T026 [P] [US1] Atualizar E2E: `home.spec.ts` (título do Início, logo "Prumo", `lang=pt-BR`) e `demo.spec.ts` (selo em todas as 5 seções e em `/catalogo`; sem chip "Local"; selo visível com diálogo aberto) — `tests/e2e/home.spec.ts`, `tests/e2e/demo.spec.ts` (FR-012, FR-013)

### Implementação
- [ ] T027 [US1] `src/lib/navigation.ts` consumido por `BottomNav` e `SideNav` (cliente, `usePathname`), áreas seguras `env(safe-area-inset-*)`, altura mínima e alvos ≥ 44px — `src/components/shell/bottom-nav.tsx`, `src/components/shell/side-nav.tsx` até T023 passar (FR-007, FR-011, FR-015, FR-021)
- [ ] T028 [US1] `AppShell` + `SkipLink` + `EnvIndicator` (só `local`) + mover `DemoBadge` para `src/components/shell/demo-badge.tsx` com tokens `demo` e `z-demo` — `src/components/shell/app-shell.tsx`, `skip-link.tsx`, `env-indicator.tsx`, `demo-badge.tsx` (FR-012, FR-013, FR-020)
- [ ] T029 [US1] `PageHeader` (h1, voltar, até 2 ações + menu "Mais ações", slot do `PrivacyToggle`) — `src/components/shell/page-header.tsx` (FR-010)
- [ ] T030 [US1] `OfflineBanner` + `use-online.ts` e `ComingSoon` até T024 passar — `src/components/shell/offline-banner.tsx`, `src/components/shell/use-online.ts`, `src/components/shell/coming-soon.tsx` (FR-009, FR-014)
- [ ] T031 [US1] Route group `(app)`: `layout.tsx` com `AppShell`, `page.tsx` (Início), `extrato`, `planejamento`, `investimentos`, `mais` (atalhos existentes), `loading.tsx`, `error.tsx`, `not-found.tsx`; remover `src/app/page.tsx` — `src/app/(app)/**` até T025/T026 passarem (FR-007, FR-009, FR-011, FR-016)
- [ ] T032 [P] [US1] Página offline com tokens e `Logo` — `src/app/~offline/page.tsx` (FR-006)

**Checkpoint**: shell navegável em local e demo.

---

## Phase 4: US2 — Valores monetários e datas inconfundíveis (P1)

**Independent Test**: `/catalogo/money` e `/catalogo/relative-date` conferem com a tabela de data-model §5 nos dois temas.

### Testes
- [ ] T033 [P] [US2] `Money`: variantes movement/balance/neutral/compact (texto, classe de token, `tabular-nums`), `null` → "—"/"valor indisponível", sr-only com fala, máscara presente, popover do compacto com valor completo — `tests/component/money.test.tsx` (FR-005, FR-025, FR-026, FR-027, FR-028)
- [ ] T034 [P] [US2] `RelativeDate` com `TodayProvider` (Hoje/Ontem/Amanhã/mesmo ano/outro ano, `<time dateTime>`, `aria-label` completo, recálculo em `visibilitychange`) e `PeriodLabel` — `tests/component/relative-date.test.tsx` (FR-029, FR-030)

### Implementação
- [ ] T035 [US2] `src/components/finance/money.tsx` (Server-compatível; popover só no compacto) até T033 passar (FR-005, FR-025–FR-028)
- [ ] T036 [P] [US2] `src/components/finance/relative-date.tsx` e `src/components/finance/period-label.tsx` até T034 passar (FR-029, FR-030)

---

## Phase 5: US3 — Componentes base e estados padronizados (P1)

**Independent Test**: cada componente no catálogo com todas as variantes/estados, operável por teclado, toque e leitor de tela.

### Testes
- [ ] T037 [P] [US3] `TransactionItem` (dados do gerador seed 42: categoria, conta, pendente, parcela "3/10", "Entre contas", sem categoria, descrição longa com `line-clamp` e texto completo, `href` vs `onSelect`, densidades) — `tests/component/transaction-item.test.tsx` (FR-032, FR-036)
- [ ] T038 [P] [US3] `SummaryCard` (delta com seta + sinal + texto; estados loading/error/empty) e `GroupedList` (cabeçalho por data, total do dia, `ul/li`) — `tests/component/summary-card.test.tsx` (FR-033, FR-034)
- [ ] T039 [P] [US3] `SourceBadge`: manual/regra/IA alta/média/baixa ("revisar"), popover explicativo, "Corrigir" chama `onCorrect` — `tests/component/source-badge.test.tsx` (FR-035)
- [ ] T040 [P] [US3] Estados: `EmptyState` (empty/no-results com "Limpar filtros"), `LoadingSkeleton` (`aria-busy`, texto sr), `SlowLoading` (fake timers 10 s), `ErrorState` (textos padrão, "Tentar novamente", sem detalhe técnico) — `tests/component/states.test.tsx` (FR-037, FR-038)
- [ ] T041 [P] [US3] `MoneyInput` (digitar "1.234,5" → "R$ 1.234,50" no blur, cents −123450 com Saída, `inputMode="decimal"`, erros), `DateInput` (chips Hoje/Ontem), `SelectField` — `tests/component/money-input.test.tsx` (FR-039)
- [ ] T042 [P] [US3] Formulário de exemplo com `useAppForm`: valida ao sair do campo e no envio, foco no 1º inválido, erro anunciado (`aria-invalid`, `aria-describedby`), `SubmitButton` ignora duplo envio — `tests/component/form.test.tsx` (FR-040, FR-041)
- [ ] T043 [P] [US3] `ConfirmDialog` (texto nomeia ação/objeto, foco inicial "Cancelar", não fecha por toque fora) e `ResponsiveDialog` (sheet < md, dialog ≥ md, Esc, `popstate` fecha, foco volta ao gatilho); `notify` (duração ≥ 5 s, `undo` persistente, `aria-live`) — `tests/component/dialogs.test.tsx` (FR-024, FR-042, FR-043, FR-044)

### Implementação
- [ ] T044 [P] [US3] `category-icon.tsx` (`CATEGORY_ICONS`, `CategoryColor`) e `institution-avatar.tsx` — `src/components/finance/` (FR-036)
- [ ] T045 [US3] `transaction-item.tsx`, `grouped-list.tsx`, `summary-card.tsx` até T037/T038 passarem — `src/components/finance/` (FR-032, FR-033, FR-034)
- [ ] T046 [P] [US3] `source-badge.tsx` até T039 passar — `src/components/finance/source-badge.tsx` (FR-035)
- [ ] T047 [P] [US3] `empty-state.tsx`, `loading-skeleton.tsx`, `slow-loading.tsx`, `error-state.tsx` até T040 passar; aplicar em `(app)/loading.tsx`/`error.tsx`/`not-found.tsx` — `src/components/states/` (FR-037, FR-038)
- [ ] T048 [US3] `form-field.tsx`, `money-input.tsx`, `date-input.tsx`, `select-field.tsx`, `submit-button.tsx`, `use-app-form.ts` até T041/T042 passarem — `src/components/forms/` (FR-039, FR-040, FR-041)
- [ ] T049 [US3] `confirm-dialog.tsx`, `responsive-dialog.tsx`, `use-back-to-close.ts`, `notify.ts` + `<Toaster>` no shell (top-center < md, bottom-right ≥ md) até T043 passar — `src/components/forms/`, `src/components/shell/` (FR-024, FR-042, FR-043, FR-044)

---

## Phase 6: US4 — Tema claro/escuro e acessibilidade (P2)

**Independent Test**: alternar tema do sistema e manual, recarregar, navegar só por teclado/leitor, axe 0 violações nos dois temas.

### Testes
- [ ] T050 [P] [US4] `ThemeSelect` (radio Automático/Claro/Escuro altera `data-theme` e grava cookie; cookie bloqueado não quebra) — `tests/component/theme-select.test.tsx` (FR-017, FR-018)
- [ ] T051 [P] [US4] E2E tema: HTML do servidor sem `data-theme` no automático e com `light`/`dark` pelo cookie; `emulateMedia({colorScheme:"dark"})` → fundo `#141312` antes de qualquer script (`javaScriptEnabled: false`); escolha persiste após reload — `tests/e2e/theme.spec.ts` (FR-018)
- [ ] T052 [P] [US4] E2E acessibilidade: `@axe-core/playwright` (wcag2a/aa, 21a/aa) em todas as rotas do shell e do catálogo × claro/escuro × 360/1280 px → 0 violações — `tests/e2e/a11y.spec.ts` (FR-019, FR-020, SC-002)
- [ ] T053 [P] [US4] E2E teclado: "Pular para o conteúdo" é o 1º Tab; foco visível (outline ≥ 2px em cor `focus`) em todo interativo; ordem segue o visual; diálogo prende e devolve foco — `tests/e2e/keyboard.spec.ts` (FR-020, FR-024, SC-007)
- [ ] T054 [P] [US4] E2E reflow e movimento: 320 e 1920 px sem rolagem horizontal; texto 200% (`html { font-size: 200% }`) sem conteúdo cortado nas seções; `reducedMotion: "reduce"` → `transition-duration` efetiva 0; alvos de toque ≥ 44×44 na nav e botões — `tests/e2e/reflow.spec.ts` (FR-016, FR-021, FR-022, FR-023, SC-008)

### Implementação
- [ ] T055 [US4] `theme-select.tsx` + página `src/app/(app)/mais/ajustes/page.tsx` (seção Tema) + atualização de `<meta name="theme-color">` até T050/T051 passarem (FR-017, FR-018)
- [ ] T056 [US4] Corrigir violações apontadas por T052–T054 (rótulos, landmarks, ordem de foco, tamanhos) até passarem — arquivos afetados em `src/components/**` (FR-019–FR-023)

---

## Phase 7: US5 — Modo privacidade (P2)

**Independent Test**: ativar no cabeçalho → todo valor vira `R$ ••••` (inclusive para leitor), recarregar mantém; campos de digitação não mascaram.

### Testes
- [ ] T057 [P] [US5] `PrivacyToggle`: `aria-pressed`, rótulo "Ocultar valores"/"Mostrar valores", alterna `data-privacy` e grava cookie — `tests/component/privacy-toggle.test.tsx` (FR-031)
- [ ] T058 [P] [US5] E2E privacidade: em `/catalogo/money` e `/catalogo/summary-card` todos os `[data-money]` mostram `R$ ••••` com largura igual entre valores pequenos e grandes; snapshot de acessibilidade contém "valor oculto" e nenhum "R$ 1"; reload mantém via HTML do servidor; `MoneyInput` continua mostrando o digitado — `tests/e2e/privacy.spec.ts` (FR-027, FR-031)

### Implementação
- [ ] T059 [US5] `privacy-toggle.tsx` no `PageHeader` + switch "Ocultar valores" em `/mais/ajustes` até T057/T058 passarem — `src/components/shell/privacy-toggle.tsx`, `src/app/(app)/mais/ajustes/page.tsx` (FR-017, FR-031)

---

## Phase 8: US6 — Catálogo navegável e regras de uso (P2)

**Independent Test**: `/catalogo` no preview → achar cada componente, alternar tema/privacidade na página, ver regras de uso; inexistente em produção.

### Testes
- [ ] T060 [P] [US6] `isCatalogEnabled` (local/preview true, production false) — `tests/unit/catalog-access.test.ts` (FR-046)
- [ ] T061 [P] [US6] Registro do catálogo: invariantes de contracts/catalog.md §2 (todo componente exportado registrado; regras completas; slugs únicos) — `tests/unit/catalog-registry.test.ts` (FR-045, FR-047)
- [ ] T062 [P] [US6] E2E catálogo: busca "valor" encontra "Valor monetário"; cada página tem seções "Quando usar", "Quando não usar", "Acessibilidade", "Textos padrão", "Certo × errado"; toggles de tema/privacidade refletem na hora; guia de escrita lista os textos padrão — `tests/e2e/catalog.spec.ts` (FR-045, FR-047, FR-048)
- [ ] T063 [P] [US6] Visual: screenshot de cada página do catálogo × claro/escuro × 360/1280 px (baselines Linux geradas por `test:visual:update`) — `tests/e2e/visual.spec.ts` (FR-049)

### Implementação
- [ ] T064 [US6] `src/lib/catalog-access.ts` + `src/app/(app)/catalogo/layout.tsx` (`notFound()` em produção, navegação lateral do catálogo, busca) até T060 passar (FR-046)
- [ ] T065 [US6] `src/catalog/registry.ts` + `src/catalog/examples.ts` (gerador seed 42, memoizado) + entradas em `src/catalog/entries/*.tsx` para todos os componentes de finance/states/forms/shell até T061 passar (FR-045, FR-047, FR-050)
- [ ] T066 [US6] Páginas `catalogo/page.tsx`, `[slug]/page.tsx`, `fundamentos/[topic]/page.tsx` (cores com nome/valor/contraste, tipografia, espaçamento, ícones, movimento) e `escrita/page.tsx` até T062 passar — `src/app/(app)/catalogo/**` (FR-045, FR-047, FR-048)
- [ ] T067 [US6] Gerar baselines visuais (`npm run test:visual:update`) e versionar — `tests/e2e/visual.spec.ts-snapshots/` (FR-049)

---

## Phase 9: Polish & transversais

- [ ] T068 [P] E2E desempenho: CDP CPU 4× + rede "Fast 4G" → navegação principal visível e clicável ≤ 2 s após `goto("/")`; troca de seção ≤ 300 ms — `tests/e2e/perf.spec.ts` (SC-005)
- [ ] T069 [P] Tela de exemplo só com componentes do catálogo (`/catalogo/exemplo-extrato`) usada por T052/T063 como prova de SC-006; lint sem violações — `src/app/(app)/catalogo/exemplo-extrato/page.tsx` (FR-004, SC-006)
- [ ] T070 [P] Acrescentar seção "UI: use o design system" em `AGENTS.md` (link para `/catalogo`, `contracts/components.md`, regras de lint) — `AGENTS.md` (FR-047)
- [ ] T071 Rodar `quickstart.md` do zero (Windows Git Bash) e corrigir divergências — `specs/003-design-system/quickstart.md`
- [ ] T072 Verificação manual (Doug): escala de cinza 10/10 (SC-004), TalkBack/VoiceOver + NVDA/Narrador (SC-007), PWA no celular (área segura, gesto de voltar fecha diálogo) — evidência no PR, sem dados reais (FR-015, FR-024)
- [ ] T073 Confirmar custo R$ 0 (licenças MIT/ISC/OFL listadas no PR; minutos de CI) e escopo (`git diff --stat origin/main -- supabase/` vazio: nenhuma migração/tabela; nenhuma tela de feature além de `ComingSoon`) — descrição do PR (FR-051, FR-052)
- [ ] T074 Atualizar `docs/roadmap.md` (003 → `review`) e abrir PR `003 · Design system e shell` com rótulo `autor:claude`, milestone `0 · Plataforma`; Doug revisa identidade no preview (SC-009)

---

## Dependencies & Execution Order

- T001 (001 na `main`) → Phase 1 → Phase 2 → histórias.
- US1 (shell) primeiro: as demais histórias são verificadas dentro do shell e do catálogo.
- US2 depende só da Phase 2 — **pode rodar em paralelo com US1**.
- US3 depende de US2 (`Money`, `RelativeDate` dentro de `TransactionItem`/`SummaryCard`).
- US4 depende de US1 (rotas) e de US3 para o axe completo; T055 cria `/mais/ajustes`.
- US5 depende de US2 (`Money`) e T055 (página Ajustes); T058 usa páginas do catálogo → após T066
  (ou rodar contra `/catalogo/money` assim que T065/T066 existirem).
- US6 depende de US2/US3 (componentes a catalogar); T052, T058, T063 dependem do catálogo.
- Phase 9 depois de todas as histórias; T074 por último.

## Parallel Opportunities

- Phase 1: T004, T005, T006, T007 juntos.
- Phase 2: T009–T015 (testes) juntos; T017, T018, T019, T022 juntos.
- US1 ∥ US2 após a Phase 2 (arquivos disjuntos: `shell/` × `finance/money|relative-date`).
- US3: T037–T043 juntos; T044, T046, T047 em paralelo.
- US4/US5/US6: testes [P] de cada fase juntos.

## Implementation Strategy

1. MVP: Phases 0–2 + US1 + US2 → shell com valores/datas corretos (já desbloqueia 012 e 025).
2. US3 → componentes de finanças e estados (necessários para 012/017).
3. US4 + US5 → tema, a11y e privacidade.
4. US6 → catálogo + visual; Polish; PR (revisão Gemini) + Gate 3.

## Rastreabilidade FR → Tasks

| FR | Tasks | | FR | Tasks |
|---|---|---|---|---|
| 001 | T009, T016 | | 027 | T033, T035, T058 |
| 002 | T016 | | 028 | T011, T033, T035 |
| 003 | T009, T016 | | 029 | T012, T017, T020, T034, T036 |
| 004 | T007, T010, T069 | | 030 | T012, T017, T034, T036 |
| 005 | T016, T033, T035 | | 031 | T014, T018, T057, T058, T059 |
| 006 | T022, T032 | | 032 | T037, T045 |
| 007 | T015, T019, T023, T025, T027, T031 | | 033 | T038, T045 |
| 008 | T015, T019 | | 034 | T038, T045 |
| 009 | T024, T025, T030, T031 | | 035 | T039, T046 |
| 010 | T029 | | 036 | T037, T044 |
| 011 | T023, T025, T027, T031 | | 037 | T040, T047 |
| 012 | T026, T028 | | 038 | T040, T047 |
| 013 | T025, T026, T028 | | 039 | T013, T017, T041, T048 |
| 014 | T024, T025, T030 | | 040 | T042, T048 |
| 015 | T027, T072 | | 041 | T021, T042, T048 |
| 016 | T025, T031, T054 | | 042 | T043, T049 |
| 017 | T050, T055, T059 | | 043 | T043, T049 |
| 018 | T014, T018, T020, T050, T051, T055 | | 044 | T043, T049 |
| 019 | T009, T016, T052, T056 | | 045 | T061, T062, T065, T066 |
| 020 | T028, T052, T053, T056 | | 046 | T060, T064 |
| 021 | T021, T027, T054, T056 | | 047 | T061, T062, T065, T066, T070 |
| 022 | T016, T054, T056 | | 048 | T062, T066 |
| 023 | T054, T056 | | 049 | T008, T063, T067 |
| 024 | T043, T049, T053, T072 | | 050 | T026, T065 |
| 025 | T011, T017, T033, T035 | | 051 | T073 |
| 026 | T011, T017, T033, T035 | | 052 | T073 |

| SC | Tasks |
|---|---|
| SC-001 | T061, T062 |
| SC-002 | T052 |
| SC-003 | T011, T012 |
| SC-004 | T072 |
| SC-005 | T068 |
| SC-006 | T069 |
| SC-007 | T053, T072 |
| SC-008 | T054 |
| SC-009 | T074 |
