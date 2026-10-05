# Data Model — 003 · Design System e Shell do App

**Banco de dados**: esta feature **não cria tabelas, migrações nem policies RLS** (FR-051).
Não há dados financeiros persistidos. As "entidades" abaixo são estruturas de apresentação:
tokens (CSS), preferências (cookies no aparelho), destinos de navegação e regras de
formatação (funções puras). Dona de todas: feature 003.

## 1. Tokens de cor

Definidos em `src/styles/tokens.css` como custom properties; tema claro em `:root`, escuro em
`[data-theme="dark"]` e em `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`.
Expostos ao Tailwind por `@theme inline` como `--color-<token>` (ex.: `bg-surface`,
`text-income`, `ring-focus`). Contrastes calculados: research R-03.

### 1.1 Semânticos

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` | `#FAF8F5` | `#141312` | fundo da página (neutro quente) |
| `--surface` | `#FFFFFF` | `#1D1B19` | cards, listas, diálogos, menus |
| `--surface-muted` | `#F2EFEA` | `#262320` | áreas secundárias, esqueleto, hover |
| `--foreground` | `#1F2421` | `#EEEAE4` | texto principal |
| `--foreground-muted` | `#5E5850` | `#B3ACA2` | texto secundário (conta, data, ajuda) |
| `--border` | `#E3DED6` | `#3A3632` | divisórias **decorativas** |
| `--border-strong` | `#8C857B` | `#7D766C` | bordas de campos e controles (≥ 3:1) |
| `--primary` | `#0F4C5C` | `#6CBACB` | marca (verde-petróleo), botão principal, item ativo |
| `--primary-foreground` | `#FFFFFF` | `#0B1F25` | texto sobre `primary` |
| `--primary-subtle` | `#DDEBEE` | `#17323A` | fundo do item de navegação ativo, seleção |
| `--info` | `#1E3A5F` | `#93B5E1` | informação (azul profundo) |
| `--info-subtle` | `#E3EAF3` | `#1B2636` | fundo de avisos informativos |
| `--income` | `#2B7249` | `#7DC79C` | valores de entrada (verde suave) e sucesso |
| `--income-subtle` | `#E5F1E9` | `#1C2E23` | fundo de selos de entrada/sucesso |
| `--expense` | `#A14A2B` | `#E59C7E` | valores de saída (terracota suave) |
| `--expense-subtle` | `#F7E7E0` | `#3A241B` | fundo de selos de saída |
| `--warning` | `#7A5200` | `#E9BC5E` | atenção, confiança média, carregamento demorado |
| `--warning-subtle` | `#FBF0D6` | `#33280F` | fundo de alertas de atenção |
| `--danger` | `#B42318` | `#F28B82` | erro, ação destrutiva (nunca para "saída") |
| `--danger-foreground` | `#FFFFFF` | `#141312` | texto sobre `danger` |
| `--danger-subtle` | `#FBE9E7` | `#3B1A17` | fundo de erro |
| `--ai` | `#5B3F96` | `#BCA6EC` | selo de origem IA |
| `--ai-subtle` | `#EFEAF8` | `#2A2340` | fundo do selo IA |
| `--focus` | `#1F6F8B` | `#7FC8DA` | anel de foco (2px + offset 2px) |
| `--demo` | `#FBF0D6` | `#33280F` | fundo do selo "Demonstração — dados fictícios" |
| `--demo-foreground` | `#5C3D00` | `#F3D58F` | texto do selo de demonstração |
| `--overlay` | `#14131299` | `#00000099` | véu atrás de diálogos/painéis (substitui `bg-black/50` do shadcn) |

Aliases exigidos pelos componentes shadcn (mapeados, não são cores novas): `card`/`popover` →
`surface`; `secondary`/`muted`/`accent` → `surface-muted`; `destructive` → `danger`;
`input` → `border-strong`; `ring` → `focus`. Como `--color-*: initial` remove também `black` e
`white`, os primitivos usam `overlay` e `*-foreground` no lugar de `bg-black/50`/`text-white`.

### 1.1a Variante `dark:` (só em `src/components/ui/`)
O Tailwind 4 liga `dark:` a `prefers-color-scheme` por padrão — isso ignoraria "Claro" fixado
manualmente. `src/styles/tokens.css` redefine a variante para seguir o mesmo critério dos tokens:

```css
@custom-variant dark {
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) { @slot; }
  }
}
```

### 1.1b Espelho TS dos tokens usados fora do CSS (`src/styles/tokens.ts`)
Metadados que não podem ler CSS (`viewport.themeColor`, `manifest.ts`, gerador de ícones) usam
constantes exportadas por `src/styles/tokens.ts` — único arquivo `.ts` isento do guarda de cores:

| Constante | Valor | Uso |
|---|---|---|
| `THEME_COLOR.light` / `THEME_COLOR.dark` | `#FAF8F5` / `#141312` (= `--background`) | `<meta name="theme-color">` |
| `BRAND_COLOR` | `#0F4C5C` (= `--primary` claro) | `manifest.theme_color`, ícones |
| `SPLASH_BACKGROUND` | `#0F4C5C` | `manifest.background_color` (tela de abertura com o ícone claro sobre a marca) |

`tests/unit/styles-contract.test.ts` exige igualdade com `tokens.css`.

### 1.2 Pares obrigatórios (contrato do teste de contraste)
`tests/unit/tokens-contrast.test.ts` lê `tokens.css` e exige, nos dois temas, todos os pares da
tabela de research R-03 (≥ 4,5:1 texto; ≥ 3:1 `focus` e `border-strong`) + os pares de
categoria (§1.3, ≥ 3:1). Token novo de texto MUST ser adicionado à lista de pares.
O mesmo teste fixa a **direção da paleta (FR-002)**: valores de `primary`, `income`, `expense`,
`danger` e neutros iguais à tabela §1.1; matiz HSL de `primary` em 185–200° (petróleo), de
`income` em 120–160° (verde), de `expense` em 10–30° (terracota) com saturação < 70% e
`expense` ≠ `danger` (saída nunca usa o vermelho de erro); fundos neutros `background` e
`surface-muted` com matiz quente (20–45°), nos dois temas.

### 1.3 Cores de categoria (ícone / fundo suave)

| Token (`--cat-*` / `--cat-*-subtle`) | Claro | Contraste | Escuro | Contraste |
|---|---|---|---|---|
| `petroleo` | `#1F6B78` / `#DCEFF2` | 5.15 | `#7CC8D6` / `#17333A` | 7.06 |
| `azul` | `#2C5A99` / `#E1EAF7` | 5.71 | `#9BBBEA` / `#1C2A40` | 7.35 |
| `verde` | `#2E7340` / `#E2F2E5` | 4.96 | `#8ACF98` / `#1B3021` | 7.68 |
| `oliva` | `#5E6A1E` / `#EEF1DC` | 5.13 | `#C3CF7E` / `#2A2E14` | 8.37 |
| `ambar` | `#8A5A00` / `#FBEFD5` | 5.20 | `#E9BC5E` / `#33280F` | 8.14 |
| `terracota` | `#A24A2C` / `#F8E5DD` | 4.85 | `#E59C7E` / `#3A241B` | 6.48 |
| `rosa` | `#A23A63` / `#F8E2EB` | 5.14 | `#EE9BBB` / `#3A1C29` | 7.29 |
| `violeta` | `#5E43A0` / `#ECE6F7` | 6.18 | `#BCA6EC` / `#2A2340` | 6.94 |
| `cinza` | `#5E5850` / `#EEEBE6` | 5.91 | `#C4BDB3` / `#2D2A26` | 7.67 |

`CategoryColor = "petroleo" | "azul" | "verde" | "oliva" | "ambar" | "terracota" | "rosa" | "violeta" | "cinza"`.
A cor da categoria é sempre acompanhada de ícone e nome (nunca só cor).

### 1.4 Mapa fixo de ícone/cor por categoria (FR-036; dona: 003)

`src/components/finance/category-visuals.ts` exporta `CATEGORY_VISUALS` e
`categoryVisual(ref)`. As chaves são as **24 categorias de 1º nível** da taxonomia padrão da 004
(004 data-model §4), em slug sem acento; subcategorias herdam o visual do pai. A 004 **não**
guarda ícone/cor (não há coluna e nada muda no schema dela): quem monta o view model (012+)
chama `categoryVisual({ systemKey?, slug })` com a categoria de 1º nível.

| Chave (`CategoryVisualKey`) | Ícone (lucide) | Cor | | Chave | Ícone | Cor |
|---|---|---|---|---|---|---|
| `alimentacao` | `UtensilsCrossed` | `terracota` | | `salario` (⚙ `salary`) | `Briefcase` | `verde` |
| `moradia` | `House` | `ambar` | | `renda-extra` | `Coins` | `verde` |
| `transporte` | `Car` | `azul` | | `rendimentos` | `TrendingUp` | `petroleo` |
| `saude` | `HeartPulse` | `rosa` | | `reembolsos` | `Undo2` | `oliva` |
| `educacao` | `GraduationCap` | `violeta` | | `outras-receitas` | `PiggyBank` | `verde` |
| `lazer` | `Ticket` | `rosa` | | `transferencia-entre-contas` (⚙ `internal_transfer`) | `ArrowLeftRight` | `cinza` |
| `viagens` | `Plane` | `azul` | | `pagamento-de-fatura` (⚙ `card_payment`) | `CreditCard` | `cinza` |
| `compras` | `ShoppingBag` | `violeta` | | `investimentos` | `ChartLine` | `petroleo` |
| `assinaturas-e-servicos` | `Repeat` | `petroleo` | | `sem-categoria` (⚙ `uncategorized`) | `CircleHelp` | `cinza` |
| `cuidados-pessoais` | `Sparkles` | `rosa` | | `personalizada` (fallback) | `Tag` | `cinza` |
| `pets` | `PawPrint` | `oliva` | | | | |
| `familia-e-filhos` | `Baby` | `ambar` | | | | |
| `impostos-tarifas-e-juros` (⚙ `bank_fees` no filho) | `Landmark` | `cinza` | | | | |
| `doacoes` | `HandHeart` | `verde` | | | | |
| `outros-gastos` | `Ellipsis` | `cinza` | | | | |

Resolução (`categoryVisual`): `systemKey` conhecido → chave correspondente; senão `slug` no
mapa; senão `personalizada`. `null` (sem categoria) → `sem-categoria`. Função pura e testada
(`tests/unit/category-visuals.test.ts`): 24 chaves + 2 especiais, todo ícone existe no
`lucide-react` instalado, toda cor ∈ `CategoryColor`.

## 2. Demais fundamentos

| Grupo | Tokens | Valores |
|---|---|---|
| Fonte | `--font-sans` | Inter Variable, fallback `system-ui, sans-serif` |
| Escala de texto | `text-xs` · `sm` · `base` · `lg` · `xl` · `2xl` · `3xl` | 12/16 · 14/20 · 16/24 · 18/28 · 20/28 · 24/32 · 30/36 px (tamanho/altura de linha) — em `rem` |
| Pesos | `font-normal` · `medium` · `semibold` | 400 · 500 · 600 (sem 700+: tom calmo) |
| Números | utilitário `tabular-nums` | obrigatório em `Money` e colunas numéricas |
| Espaçamento | escala padrão do Tailwind 4 (`--spacing: 0.25rem`) | uso recomendado: 1, 2, 3, 4, 6, 8, 12 |
| Raios | `--radius-sm` · `md` · `lg` · `xl` · `full` | 6 · 10 · 14 · 20 px · 9999px (cards = `lg`, botões/campos = `md`) |
| Sombras | `--shadow-sm` · `--shadow-md` | só em elementos sobrepostos (menus, diálogos, barra inferior) |
| Movimento | `--duration-fast` · `--duration-base` · `--ease-standard` | 120 ms · 200 ms · `cubic-bezier(.2,0,0,1)`; zerados com `prefers-reduced-motion: reduce` |
| Camadas | `--z-nav` · `--z-overlay` · `--z-toast` · `--z-demo` | 30 · 40 · 50 · 60 (selo demo acima de diálogos — edge case da spec) |
| Largura | `--container-content` | 64rem (largura máxima do conteúdo no desktop) |
| Toque | utilitário `min-h-11 min-w-11` | 44×44 px mínimos (FR-021) |
| Área segura | `@utility pt-safe` / `pb-safe` / `pl-safe` / `pr-safe` | `padding-*: env(safe-area-inset-*)` (só têm efeito com `viewport-fit=cover`, definido no root layout — FR-015); usados no `PageHeader` e na `BottomNav` |
| Breakpoint do shell | `md` (48rem = 768 px) | `< md`: barra inferior · `≥ md`: menu lateral |

## 3. Preferências de exibição (cookies no aparelho)

| Cookie | Valores | Padrão | Atributo no `<html>` |
|---|---|---|---|
| `prumo_theme` | `auto` \| `light` \| `dark` | `auto` | `data-theme` ausente (auto) / `light` / `dark` |
| `prumo_privacy` | `on` \| `off` | `off` | `data-privacy="on"` / ausente |

- Atributos: `Path=/; Max-Age=31536000; SameSite=Lax; Secure` (em https). Não `HttpOnly`
  (escritos pelo cliente). Não contêm dado pessoal nem financeiro.
- Valor inválido/ausente ou cookies bloqueados → padrão, sem erro (edge case da spec).
- Parsing puro em `src/lib/preferences.ts` (`parseTheme`, `parsePrivacy`), lido no root layout
  com `cookies()` e gravado no cliente por `setPreference()`.

## 4. Destinos de navegação

`src/lib/navigation.ts` — fonte única (contrato completo em [contracts/navigation.md](contracts/navigation.md)).

```ts
type DestinationId = "inicio" | "extrato" | "planejamento" | "investimentos" | "mais";
type Destination = {
  id: DestinationId;
  label: string;          // "Início", "Extrato", "Planejamento", "Investimentos", "Mais"
  href: `/${string}`;     // "/", "/extrato", "/planejamento", "/investimentos", "/mais"
  icon: LucideIcon;       // House, ReceiptText, CalendarRange, TrendingUp, Ellipsis
  matches: (pathname: string) => boolean; // destaque do destino ativo (prefixo)
};
type FeatureSlot = {
  feature: `${number}`;   // "012"
  destination: DestinationId | "plataforma";
  path: string | null;    // rota prevista, ex.: "/planejamento/faturas"; null = sem tela
  label: string;
};
type OutsideShellRoute = { path: string; owner: "001" | "003" | "006"; label: string };
// OUTSIDE_SHELL_ROUTES: /entrar, /entrar/codigo, /desbloquear (006) · /~offline (001) · 404 raiz (003)
```

Invariantes (testadas): exatamente 5 destinos, ordem fixa; cada uma das 32 features do
`docs/roadmap.md` aparece exatamente uma vez em `FEATURE_SLOTS`; nenhum `path` repetido;
nenhum `path` de `FEATURE_SLOTS` coincide com `OUTSIDE_SHELL_ROUTES`.

## 5. Regras de formatação (funções puras em `src/lib/format.ts`)

Entradas monetárias: `cents` inteiro seguro (Constitution III). `NBSP` = U+00A0; `−` = U+2212.

| Função / variante | Entrada | Saída esperada |
|---|---|---|
| `formatMoney` movimentação | `123456` | `+R$ 1.234,56` |
| | `-4590` | `−R$ 45,90` |
| | `0` | `R$ 0,00` |
| | `1` / `-1` / `99` | `+R$ 0,01` / `−R$ 0,01` / `+R$ 0,99` |
| `formatMoney` saldo | `123456` / `-4590` | `R$ 1.234,56` / `−R$ 45,90` |
| `formatMoney` neutra | `-4590` | `R$ 45,90` (sem sinal; uso: totais de categoria) |
| `formatMoney` compacta | `1234500` / `123400000` / `100000000000` | `R$ 12,3 mil` / `R$ 1,2 mi` / `R$ 1 bi` |
| moeda ≠ BRL | `1000`, `USD` | `+US$ 10,00` |
| ausente | `null` | `—` (leitura "valor indisponível") |
| não inteiro | `10.5` | lança `TypeError` |
| `moneyToSpeech` | `-4590` movimentação | `saída de 45 reais e 90 centavos` |
| | `100` / `1` | `entrada de 1 real` / `entrada de 1 centavo` |
| | `-4590` saldo | `saldo negativo de 45 reais e 90 centavos` |
| `formatRelativeDate(d, today)` | `today` | `Hoje` |
| | `today − 1` / `today + 1` | `Ontem` / `Amanhã` |
| | mesmo ano | `28 set.` |
| | outro ano | `28 set. 2025` |
| `formatAbsoluteDate` | `2026-09-28` | `28/09/2026` |
| `dateToSpeech` | `2026-09-28` | `28 de setembro de 2026` |
| `formatPeriod` | mês `2026-09` | `Setembro de 2026` |
| | `2026-09-01`–`2026-09-15` | `1–15 set.` |
| | `2026-09-28`–`2026-10-03` | `28 set. – 3 out.` |

`parseMoneyInput(text)` (campo de valor) → `{ ok: true, cents } | { ok: false, error }`:

| Texto digitado | Resultado |
|---|---|
| `1234,5` · `1.234,50` · `R$ 1.234,50` · `1234,50` | `123450` |
| `1.234` (sem vírgula, grupos de 3) | `123400` |
| `0,01` | `1` |
| `12,345` | erro "Use no máximo 2 casas decimais." |
| `abc` · vazio | erro "Informe um valor." |
| `-10` | erro "Use o seletor Entrada/Saída para o sinal." |
| > `999.999.999.999,99` | erro "Valor muito alto." |

O campo devolve sempre valor **positivo** em centavos; o sinal vem do seletor Entrada/Saída
(`-cents` para saída).

`institutionInitials(name)` (FR-036, `InstitutionAvatar`): remove trechos entre parênteses,
ignora as palavras `banco`, `de`, `do`, `da`, `dos`, `das`, `e` (sem diferenciar maiúsculas);
com ≥ 2 palavras restantes → 1ª letra das duas primeiras; com 1 → 2 primeiras letras; vazio → `?`.
Resultado em maiúsculas, com acentos preservados.

| Nome | Iniciais |
|---|---|
| `Banco Aurora (simulado)` | `AU` |
| `Carteira Pix (simulada)` | `CP` |
| `Banco do Horizonte Digital` | `HD` |
| `Órbita` | `ÓR` |
| `Banco` | `?` |

## 6. Estados de UI (máquina de estados do bloco de conteúdo)

```
idle → loading → (success | empty | error)
loading → slow (após 10 s sem resposta) → (success | empty | error)
error → loading (Tentar novamente)
success ⇄ offline-banner (independente: conexão é estado do shell, não do bloco)
```
Proibido: `loading` sem esqueleto; `error` com detalhe técnico; `empty` exibido enquanto
`loading`; `success` com `R$ 0,00` no lugar de valor ausente.

Escopo: `ErrorState scope="block"` afeta só o bloco que falhou (os blocos irmãos continuam em
`success`); `scope="page"` só em `error.tsx` de rota.

Ação que exige conexão (formulários, `SubmitButton`, `notify.undo`): com `navigator.onLine`
falso, a ação **não é chamada**, o botão volta ao estado normal e aparece
`notify.error("Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar.")` (edge case
"offline durante ação"). Se a conexão cair durante o envio e a ação rejeitar, idem.

## 7. Exemplos do catálogo a partir do gerador sintético (Constitution II)

`src/catalog/examples.ts` deriva view models de `generateDataset({ seed: 42, months: 12,
anchorDate: "2026-09-30" })` por regras **determinísticas** (nada escrito à mão). O gerador da
001 não tem categoria, status nem categorização; elas vêm do `kind` e de um hash estável do
`id` (`h = fnv1a(id) % 100`):

| `kind` | Categoria (`CategoryVisualKey`) | Categorização (`SourceBadgeData`) | `nature` |
|---|---|---|---|
| `salary` | `salario` | `source` | `regular` |
| `purchase` | `h < 30` alimentacao · `< 50` transporte · `< 70` compras · `< 85` lazer · senão saude; **`h % 13 === 0` → sem categoria** | `h < 60` IA alta · `< 85` IA média · senão IA baixa | `regular` |
| `subscription` | `assinaturas-e-servicos` | `rule` | `regular` |
| `installment` | `compras` (+ `installment`) | IA alta | `regular` |
| `transfer_internal` | `transferencia-entre-contas` | `rule` | `internal_transfer` |
| `card_bill_payment` | `pagamento-de-fatura` | `rule` | `card_payment` |
| `refund` | `reembolsos` | `source` | `refund` |
| `international` | `viagens` (+ `original` da `originalCurrency`) | IA média | `regular` |
| `fee` | `impostos-tarifas-e-juros` | `source` | `regular` |
| `income_other` | `outras-receitas` | `manual` | `regular` |

`status = "pending"` quando `date ≥ anchorDate − 1 dia`; senão `posted`. Nomes de categoria
vêm da taxonomia (rótulo do 1º nível); conta/instituição vêm do próprio dataset. Teste:
`tests/unit/catalog-examples.test.ts` (determinismo, todas as linhas da tabela representadas,
nenhum valor fora do dataset).

## 8. "Hoje" do catálogo

O catálogo envolve os exemplos em `<TodayProvider today={CATALOG_TODAY} fixed>` com
`CATALOG_TODAY = "2026-09-30"` (= `anchorDate`): datas relativas e baselines visuais não mudam
com o dia real. `fixed` desliga o recálculo em `visibilitychange`. O shell (fora dos exemplos)
continua usando `todayInSaoPaulo()`.
