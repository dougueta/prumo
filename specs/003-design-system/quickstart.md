# Quickstart — 003 · Design System e Shell

Pré-requisito: setup da 001 funcionando (`README#início-rápido`).

## Rodar e ver

```bash
npm run dev            # http://localhost:3000 — APP_ENV=local (chip "Local")
npm run dev:demo       # modo demonstração (selo "Demonstração — dados fictícios")
```

- Shell: abrir `/`, `/extrato`, `/planejamento`, `/investimentos`, `/mais` — no DevTools,
  alternar entre 360px (barra inferior) e 1280px (menu lateral).
- Catálogo: `/catalogo` (não existe em produção).
- Ajustes: `/mais/ajustes` → tema e "Ocultar valores".
- Fora do shell: `/nao-existe` (404 em pt-BR) e `/~offline` — sem navegação, com tema e selo.

## Construir uma tela de feature com o design system (para Claude e Gemini)

1. Consulte `/catalogo` e `specs/003-design-system/contracts/components.md`.
2. Rota da feature no lugar previsto em `contracts/navigation.md` §2, dentro de `src/app/(app)/`
   (telas sem shell, como as de login da 006, seguem §2.1 e usam os mesmos componentes).
3. Comece a página com `<PageHeader title="…" />`.
4. Valores: **sempre** `<Money cents={…} />`; datas: `<RelativeDate date="YYYY-MM-DD" />`.
5. Listas de transações: `<GroupedList>` + `<TransactionItem>`; estados: `EmptyState`,
   `LoadingSkeleton`, `ErrorState` (nunca textos próprios — use os textos padrão). Ícone/cor de
   categoria só por `categoryVisual()` (mapa fixo da 003).
6. Cores/espaços só por classes de token (`bg-surface`, `text-foreground-muted`, `gap-4`).
   `npm run lint` acusa classe fora do tema, valor arbitrário (`w-[13px]`) e `dark:`.
7. Nada de editar `src/components/ui/` — peça variante nova à 003.

## Verificações

```bash
npm run lint && npm run typecheck
npm run test:unit                # format, preferências, navegação, contraste, guarda de tokens, registro
npm run test:component           # componentes em jsdom
npm run test:e2e                 # shell, tema, privacidade, a11y (axe), teclado, catálogo, demo
npm run test:visual:update       # (Docker) regrava baselines visuais Linux — só quando a mudança visual é intencional
```

## Checagem manual (Gate 3)

- Leitor de tela: TalkBack (Android) e NVDA ou Narrador (Windows) no catálogo e no shell.
- Celular real: instalar a PWA, conferir área segura (entalhe) e gesto de voltar fechando diálogo.
- Escala de cinza (SC-004): DevTools → Rendering → "Emulate vision deficiencies: achromatopsia",
  página `/catalogo/money` → 10 exemplos identificáveis como entrada/saída.
