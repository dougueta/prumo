# Research — 003 · Design System e Shell do App

Versões verificadas em 2026-10-02 via `npm view` / `npx shadcn@4.21.1 --help`. Base já
implementada pela 001 (branch `001-setup-projeto`): Next.js 16.3.8, React 19.2.8, TypeScript
5.9.3 strict, Tailwind 4, Vitest 5 (projetos `unit`/`integration`, ambiente node), jsdom 29.1.1,
Testing Library 16, Playwright 1.63 (projetos `chromium`, `mobile-chrome`, `demo`), zod 4.6.
Documentação consultada: `node_modules/next/dist/docs/` da versão instalada (16.3.8).

## R-01 · Biblioteca de componentes (constitution: shadcn/ui + Tailwind)
- **Decision**: **shadcn CLI 4.21.1** com `--base radix` (pacote unificado `radix-ui` 1.6.7),
  CSS variables ligadas, Tailwind 4 (sem `tailwind.config`, tema via `@theme inline`),
  `tw-animate-css` 1.4.0, `class-variance-authority` 0.7.1, `tailwind-merge` 3.7.0, `clsx`.
  Componentes copiados para `src/components/ui/` (código nosso, versionado — não é dependência
  em runtime do shadcn). Peer deps de `radix-ui` aceitam React ^19.
- **Rationale**: é a stack da constitution; o CLI 4.x suporta Tailwind 4 + React 19 + Next 16 e
  gera código editável. Radix (em vez do default `base` = Base UI 1.8) porque ambos os agentes
  (Claude e Gemini) têm muito mais exemplos/familiaridade com Radix, reduzindo divergência.
- **Alternatives**: Base UI (default do CLI; mais novo, menos material de referência); React Aria
  (`--base aria`; ótima acessibilidade, API muito diferente do resto do ecossistema shadcn);
  componentes 100% próprios (reinventar foco/teclado de diálogos e menus = risco de a11y).
- **Verificação na implementação**: rodar `npx shadcn@4.21.1 init --base radix --dry-run`
  antes de escrever; se o CLI tentar sobrescrever `globals.css`/`layout.tsx` da 001, aplicar
  manualmente só os trechos necessários.

## R-02 · Tokens e tema (claro/escuro + manual) sem "piscar"
- **Decision**: tokens semânticos como CSS custom properties em `src/styles/tokens.css`,
  expostos ao Tailwind por `@theme inline` (ex.: `bg-surface`, `text-income`). O tema é um
  atributo `data-theme` no `<html>`:
  - `light`/`dark` → valores fixos; ausente (= "Automático") → `@media (prefers-color-scheme)`.
  - Preferência guardada em **cookie** `prumo_theme` e lida no **root layout com `cookies()`**,
    que já renderiza o atributo certo no HTML do servidor → zero flash, zero script inline.
  - Paleta padrão do Tailwind **removida** (`--color-*: initial`): `bg-red-500` deixa de existir.
  - Componentes nunca usam a variante `dark:`; trocam de tema só via tokens.
- **Rationale**: o guia "Preventing flash before hydration" (Next 16) mostra duas saídas:
  script inline lendo `localStorage`/cookie, ou `cookies()` no servidor — esta última tira as
  páginas do prerender estático. No Prumo **todas as rotas já são dinâmicas** (o `DemoBadge` da
  001 chama `connection()` no root layout; o login 006 tornará tudo sessão-dependente), então
  ler o cookie no servidor não custa nada e elimina o script inline e o `suppressHydrationWarning`.
- **Alternatives**: `next-themes` 0.4.6 (script inline + `localStorage`; dependência extra e
  avisos de `<script>` no React 19); `localStorage` + script inline (funciona, mas mais código e
  divergência servidor/cliente).

## R-03 · Paleta "sóbria e calma" (Clarify Q1) e contraste AA
- **Decision**: paleta da tabela do [data-model §1](data-model.md#1-tokens-de-cor). Todos os
  pares texto/fundo foram **calculados** (fórmula de luminância relativa WCAG 2.1) e passam AA;
  o cálculo vira teste automatizado (`tests/unit/tokens-contrast.test.ts`) que lê
  `tokens.css`, para que qualquer ajuste futuro de cor que quebre AA falhe no CI.
- Resumo do cálculo (mín. 4,5:1 texto; 3:1 foco/bordas de controles):

| Par (texto / fundo) | Mín. | Claro | Escuro |
|---|---|---|---|
| `foreground` / `background` | 4.5:1 | 14.87 | 15.49 |
| `foreground` / `surface` | 4.5:1 | 15.76 | 14.33 |
| `foreground` / `surface-muted` | 4.5:1 | 13.74 | 13.04 |
| `foreground-muted` / `background` | 4.5:1 | 6.63 | 8.25 |
| `foreground-muted` / `surface` | 4.5:1 | 7.03 | 7.64 |
| `foreground-muted` / `surface-muted` | 4.5:1 | 6.13 | 6.95 |
| `primary` / `background` | 4.5:1 | 8.97 | 8.42 |
| `primary` / `surface` | 4.5:1 | 9.51 | 7.79 |
| `primary-foreground` / `primary` | 4.5:1 | 9.51 | 7.70 |
| `primary` / `primary-subtle` | 4.5:1 | 7.78 | 6.13 |
| `info` / `surface` | 4.5:1 | 11.50 | 8.13 |
| `info` / `info-subtle` | 4.5:1 | 9.49 | 7.22 |
| `income` / `surface` | 4.5:1 | 5.82 | 8.60 |
| `income` / `background` | 4.5:1 | 5.49 | 9.30 |
| `income` / `income-subtle` | 4.5:1 | 5.02 | 7.18 |
| `expense` / `surface` | 4.5:1 | 5.95 | 7.68 |
| `expense` / `background` | 4.5:1 | 5.61 | 8.30 |
| `expense` / `expense-subtle` | 4.5:1 | 4.95 | 6.48 |
| `warning` / `surface` | 4.5:1 | 6.92 | 9.66 |
| `warning` / `warning-subtle` | 4.5:1 | 6.11 | 8.14 |
| `danger` / `surface` | 4.5:1 | 6.57 | 7.19 |
| `danger` / `danger-subtle` | 4.5:1 | 5.61 | 6.53 |
| `danger-foreground` / `danger` | 4.5:1 | 6.57 | 7.77 |
| `ai` / `surface` | 4.5:1 | 8.09 | 8.02 |
| `ai` / `ai-subtle` | 4.5:1 | 6.85 | 6.94 |
| `demo-foreground` / `demo` | 4.5:1 | 8.73 | 10.15 |
| `focus` / `background` | 3:1 | 5.35 | 9.88 |
| `focus` / `surface` | 3:1 | 5.67 | 9.14 |
| `border-strong` / `surface` | 3:1 | 3.65 | 3.83 |
| `border-strong` / `background` | 3:1 | 3.44 | 4.14 |

  Cores de categoria (ícone sobre fundo suave, mín. 3:1 por ser elemento gráfico; todas também
  passam 4,5:1): ver data-model §1.3 — menor valor 4,85 (claro) / 6,48 (escuro).
- `--border` (1,34 / 1,43) é **decorativo** (divisórias); bordas de controles usam
  `--border-strong` (≥ 3:1, WCAG 1.4.11).
- **Rationale**: verde-petróleo `#0F4C5C` já é a cor provisória dos ícones da 001 — continuidade.
  Entrada = verde suave, saída = terracota (nunca vermelho de alarme); `danger` (vermelho) fica
  reservado a erros/ações destrutivas, sempre com ícone + texto, para não confundir com saída.
- **Alternatives**: OKLCH nos tokens (melhor para gerar escalas, mas hex é verificável por
  qualquer agente e pelo teste de contraste sem conversão; pode migrar depois).

## R-04 · Tipografia
- **Decision**: **Inter Variable** (licença SIL OFL 1.1), auto-hospedada com `next/font/local`
  a partir de arquivos `woff2` (subsets latin + latin-ext) versionados em `src/app/fonts/`
  (copiados do pacote `@fontsource-variable/inter@5.3.0`, com o `OFL.txt`). Números monetários
  com `font-variant-numeric: tabular-nums` (Inter tem `tnum`). Escala tipográfica em tokens
  (data-model §2). Marca "Prumo" = logotipo SVG (não depende de fonte).
- **Rationale**: Inter é extremamente legível em tamanhos pequenos, tem algarismos tabulares e
  acentuação completa; `next/font/local` não faz requisição externa (nem em build, ao contrário
  de `next/font/google`, que baixa no build e falharia sem rede) — R$ 0 e build determinístico.
- **Alternatives**: `next/font/google` (rede no build); fonte de sistema (sem `tnum` garantido
  e aparência diferente entre Android/iOS/Windows — quebra a meta de aparência idêntica);
  Manrope/IBM Plex (boas, mas uma família só basta — Constitution X).

## R-05 · Ícones
- **Decision**: `lucide-react` 1.50.0 (ISC) para ícones de interface e de categoria;
  logotipo próprio (fio de prumo, já desenhado pela 001 em `scripts/generate-icons.mjs`)
  extraído para `src/components/brand/logo.tsx` e reaproveitado pelo gerador de ícones PWA.
- **Rationale**: é o conjunto padrão do shadcn; tree-shakeable; traço consistente.

## R-06 · Modo privacidade (Clarify Q3)
- **Decision**: atributo `data-privacy="on"` no `<html>` (lido do cookie `prumo_privacy` no
  root layout). O componente `Money` renderiza **duas** variantes no HTML — valor e máscara
  `R$ ••••` — e o CSS mostra uma ou outra; `display: none` também remove a variante oculta da
  árvore de acessibilidade, então o leitor de tela anuncia "valor oculto". Alternar o modo =
  trocar o atributo + gravar o cookie: instantâneo, sem re-render, vale para Server e Client
  Components e para qualquer feature futura que use `Money`.
- **Limite declarado**: é proteção **visual** (olhares por cima do ombro), não segurança de
  dados — o valor continua no HTML/payload. Documentado nas regras de uso.
- **Alternatives**: Context React + Money como Client Component (todo valor viraria JS de
  cliente; re-render global); máscara só por CSS sem variante para leitor de tela (vazaria o
  valor por áudio).

## R-07 · Formatação de dinheiro sem float (Constitution III)
- **Decision**: `formatMoney(cents, opts)` em `src/lib/format.ts` (evolui o `formatCents` da
  001) monta a string decimal **exata** (`"1234.56"`) a partir do inteiro (`abs % 100` e
  `(abs - abs % 100) / 100`, exatos para inteiros seguros) e a passa como **string** para
  `Intl.NumberFormat` (suporte a strings decimais — NumberFormat v3, disponível em Node 24 e
  navegadores-alvo). Sinal composto por nós com o caractere `−` (U+2212) / `+`; separador entre
  `R$` e número é o espaço não separável (U+00A0) emitido pelo `Intl`. Compacto via
  `notation: "compact"` (pt-BR gera `mil`/`mi`/`bi`). Rejeita não-inteiros e inteiros fora de
  `Number.isSafeInteger`.
- **Rationale**: elimina `cents / 100` (float) do código de apresentação; testes de tabela
  cobrem os edge cases da spec.

## R-08 · Datas relativas e "hoje" sem divergência servidor/cliente
- **Decision**: funções puras (`formatRelativeDate(date, today)`, `formatAbsoluteDate`,
  `formatPeriod`) operando sobre strings `YYYY-MM-DD` (sem `Date` local). "Hoje" calculado
  no fuso `America/Sao_Paulo` no servidor (root layout) e distribuído por `TodayProvider`
  (Context); o provider recalcula no cliente ao voltar o foco à aba (`visibilitychange`) para
  que um app aberto de madrugada não mostre "Hoje" errado.
- **Rationale**: o guia do Next 16 alerta para mismatch de hidratação com datas; como servidor
  e cliente usam o mesmo fuso fixo e o mesmo `today` inicial, não há mismatch.

## R-09 · Offline, navegação e diálogos
- **Offline**: `useSyncExternalStore` sobre `navigator.onLine` + eventos `online/offline`.
  *Não* usar `useOffline` do Next 16: é **experimental** (`experimental.useOffline`) e muda o
  comportamento de retry de navegação — fica para quando estabilizar.
- **Navegação**: `next/link` + `usePathname()` para o destino ativo; rotas reais por seção
  (URL própria, voltar/avançar nativos).
- **Gesto de voltar fecha diálogo**: hook `useBackToClose` faz `history.pushState` ao abrir e
  fecha no `popstate` (o App Router integra `pushState` nativo ao roteador).
- **Bottom sheet**: componente `sheet` do shadcn (Radix Dialog, `side="bottom"`).
  *Não* usar `drawer` (vaul 1.1.2): sem publicação desde 12/2024.
- **Toasts**: `sonner` 2.0.8 (componente `sonner` do shadcn), `top-center` no celular (não
  cobre a barra inferior) e `bottom-right` no desktop.

## R-10 · Formulários
- **Decision**: `react-hook-form` 7.89 + `@hookform/resolvers` 5.9 (zod 4 já instalado) com os
  componentes `field` do shadcn; validação `mode: "onTouched"` (ao sair do campo) + no envio,
  `shouldFocusError: true`. Campo de data = `<input type="date">` nativo estilizado + atalhos
  "Hoje"/"Ontem" (sem `react-day-picker`: menos peso, teclado nativo no celular).
- **Alternatives**: Server Actions + `useActionState` puros (sem validação ao sair do campo);
  `react-day-picker` (dependência grande sem necessidade agora).

## R-11 · Verificação automática do design system (FR-004, FR-049, SC-002, SC-006)
- **Fundamentos**: `eslint-plugin-better-tailwindcss` 4.7.0 (suporta ESLint 9 e Tailwind 4)
  com `no-unknown-classes` (classe que não existe no tema = erro — e a paleta padrão foi
  removida), `no-restricted-classes` (proíbe valores arbitrários `[...]` e a variante `dark:`
  fora de `src/components/ui/`) + teste `tests/unit/tokens-guard.test.ts` que varre `src/` por
  literais de cor (`#hex`, `rgb(`, `hsl(`, `oklch(`) fora de `src/styles/tokens.css` e do
  logotipo.
- **Acessibilidade**: `@axe-core/playwright` 4.13.0 em todas as páginas do shell e do catálogo,
  nos dois temas (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
- **Comportamento**: novo projeto Vitest `component` (jsdom 29 + Testing Library 16 +
  `@testing-library/user-event` 14.6.7 + `@testing-library/jest-dom` 7.0.1).
- **Aparência**: Playwright `toHaveScreenshot` do catálogo (claro/escuro, celular/desktop) num
  projeto `visual` que só roda em Linux (CI). Baselines geradas/atualizadas pela imagem Docker
  oficial `mcr.microsoft.com/playwright:v1.63.0-noble` (`npm run test:visual:update`), para não
  depender do SO do Doug (Windows).
- **Desempenho (SC-005)**: E2E com emulação de CPU 4× e rede 4G via CDP medindo shell
  utilizável ≤ 2 s e troca de seção ≤ 300 ms (com prefetch do `Link`).

## R-12 · Catálogo navegável
- **Decision**: área do próprio app em `/catalogo` (rotas Next), com registro tipado de
  componentes (`src/catalog/registry.ts`: nome, descrição, regras de uso, textos padrão, a11y,
  exemplos certo/errado) e busca por nome. Bloqueado em `production` com `notFound()` no layout
  do catálogo (função pura `isCatalogEnabled(appEnv)` testada). Exemplos usam o **gerador
  sintético da 001** (`generateDataset({ seed: 42, … })`, memoizado) — Constitution II.
- **Alternatives**: Storybook 9/10 (ferramenta e build paralelos, mais um servidor no CI,
  compatibilidade com Next 16/React 19.2 a validar — custo de complexidade sem ganho para 1
  usuário + 2 agentes); documentação só em Markdown (não mostra estados interativos nem temas).

## R-13 · Coordenação com features paralelas da onda 1
- **006 (login)**: planeja `requireSession` no layout `(app)` e `/entrar` fora do shell. A 003
  cria exatamente o route group `src/app/(app)/` com o shell; a 006 só acrescenta a checagem
  de sessão nesse layout. A 003 **não** altera `src/proxy.ts`.
- **004 (modelo de dados)**: os componentes recebem *view models* próprios (contracts §3)
  — a 004 não precisa existir; features 012+ fazem o mapeamento domínio → view model.
- **001**: a 003 implementa **depois do merge da 001 na `main`** (rebase obrigatório antes do
  T001; hoje a branch `003-design-system` parte de uma `main` só com documentação).
