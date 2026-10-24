# Contrato — Componentes do Design System

API pública que **todas** as features usam para montar telas. Import sempre por
`@/components/<grupo>/<nome>`. Mudança de API = PR na 003 (dona) + atualização do catálogo.
Legenda: **S** = pode ser usado em Server Component sem `"use client"` no chamador;
**C** = Client Component (pode ser renderizado por Server Components normalmente).

## 1. Primitivos (`src/components/ui/` — gerados pelo shadcn, ajustados aos tokens)

`button` · `input` · `textarea` · `label` · `field` · `select` · `switch` · `radio-group` ·
`dialog` · `alert-dialog` · `sheet` · `dropdown-menu` · `popover` · `tooltip` · `skeleton` ·
`separator` · `badge` · `card` · `sonner`.

Regras: features MUST NOT editar `src/components/ui/`; variantes novas são pedidas à 003.
`Button` variantes: `primary` (máx. 1 por tela/diálogo — FR-041), `secondary`, `ghost`
(discreto), `destructive`; tamanhos `sm` (ainda ≥ 44px de área de toque via padding/hit-area),
`md`, `icon` (exige `aria-label`). Prop `pending` → desabilita, mostra spinner e
`aria-busy` (FR-040).

Ajustes obrigatórios no código gerado (T021): sem `bg-black/*`/`text-white` (a paleta padrão
foi removida) → `bg-overlay`, `text-primary-foreground`, `text-danger-foreground`; `dark:` só
aqui em `ui/`, resolvido pela variante redefinida (data-model §1.1a). `no-unknown-classes`
também vale para `ui/`.

## 2. Finanças (`src/components/finance/`)

### `Money` (S) — FR-025..FR-028, FR-005
```ts
type MoneyProps = {
  cents: number | null;                 // inteiro seguro; null = indisponível ("—")
  currency?: string;                    // ISO 4217, padrão "BRL"
  variant?: "movement" | "balance" | "neutral" | "compact"; // padrão "movement"
  size?: "sm" | "md" | "lg" | "xl";     // tokens de texto
  className?: string;                   // só layout (margens/alinhamento), nunca cor
};
```
- `movement`: `+`/`−`, cor `income`/`expense`, zero neutro. `balance`: sem `+`, com `−` para
  negativo, sempre cor `foreground` (saldo não é "gasto"; se a tela quiser destacar saldo
  negativo, usa texto/selo, não cor do número). `neutral`: sem sinal, `foreground`.
  `compact`: abreviado; valor completo num `Popover` (toque/foco/hover) e no texto para leitor.
- Sempre `tabular-nums`; HTML: `<span data-money>` com `[data-money-value]` (visível +
  `sr-only` com `moneyToSpeech`) e `[data-money-mask]` (`R$ ••••`, sr "valor oculto"),
  alternados por `html[data-privacy="on"]` (FR-027).
- `cents` não inteiro/inseguro → `TypeError` em **qualquer** ambiente (dinheiro inválido é bug;
  o `error.tsx` mais próximo mostra `ErrorState`, nunca um valor "chutado").

### `RelativeDate` (C) — FR-029
```ts
type RelativeDateProps = { date: string /* YYYY-MM-DD */; variant?: "relative" | "absolute" };
```
Renderiza `<time dateTime={date}>` com texto visível e `aria-label={dateToSpeech(date)}`.
"Hoje" vem de `useToday()` (`TodayProvider` no root layout:
`{ today: string; fixed?: boolean }`; `fixed` desliga o recálculo — usado no catálogo, data-model §8).

### `PeriodLabel` (S) — FR-030
`{ from: string; to?: string } | { month: string /* YYYY-MM */ }` → "Setembro de 2026",
"1–15 set.", "28 set. – 3 out.".

### `TransactionItem` (S) — FR-032
```ts
type TransactionItemData = {
  id: string;
  description: string;
  amountCents: number;
  currency?: string;
  date: string;                                   // YYYY-MM-DD
  category?: { name: string; visual: CategoryVisualKey } | null; // null = "Sem categoria"; visual via categoryVisual()
  account: { name: string; institutionName: string; institutionIcon?: string };
  status?: "posted" | "pending";
  installment?: { number: number; total: number }; // "3/10"
  nature?: "regular" | "internal_transfer" | "card_payment" | "refund"; // selos "Entre contas" · "Pagamento de fatura" · "Estorno"
  original?: { amountMinor: number; currency: string }; // compra internacional: "US$ 10,00" na linha secundária
  categorization?: SourceBadgeData;               // origem/confiança (§ SourceBadge)
};
type TransactionItemProps = {
  data: TransactionItemData;
  href?: string;             // item navegável (link)
  onSelect?: () => void;     // ou ação (botão); exatamente um dos dois quando acionável
  density?: "normal" | "compact";
  showDate?: boolean;        // false dentro de GroupedList (a data está no cabeçalho)
};
```
Layout: ícone de categoria (40px) · descrição (até 2 linhas, `line-clamp`, texto completo no
`title`/leitor) · linha secundária (categoria · conta · data) · `Money` à direita (nunca
empurrado para fora; valores ≥ R$ 1 bi usam `whitespace-nowrap` e a descrição encolhe).
Pendente → selo "Pendente" + opacidade do valor reduzida via token. `nature` ≠ `regular` →
selo de texto (nunca só ícone). Mapeamento a partir do modelo da 004 (feito pelas features
012+): `amount_cents` → `amountCents`; `booked_on` → `date`; `nature` → `nature`;
`original_amount_minor`/`original_currency` → `original`; `category_source`/`category_confidence`
→ `categorization` (nível pelos limiares da 014); categoria de 1º nível → `categoryVisual()`.

### `SummaryCard` (S) — FR-033
```ts
type SummaryCardProps = {
  title: string;
  cents: number | null;
  variant?: "balance" | "movement" | "neutral";   // repassa ao Money
  compact?: boolean;
  delta?: { cents: number; label: string; trend: "up" | "down" | "flat"; good: boolean };
  // ex.: { cents: -12000, label: "vs. agosto", trend: "down", good: true } → "↓ −R$ 120,00 vs. agosto" (seta + sinal U+2212 + texto)
  state?: "ready" | "loading" | "error" | "empty";
  onRetry?: () => void;
  href?: string;
};
```
Variação: seta + sinal + texto (não só cor); cor `income` quando `good`, `expense` caso contrário.

### `GroupedList` (S) — FR-034
`{ groups: { date: string; totalCents?: number; items: ReactNode[] }[]; emptyState?: ReactNode }`
→ cabeçalho por grupo (`RelativeDate` + total opcional com `Money variant="movement"`), lista
semântica `<ul>`/`<li>`.

### `SourceBadge` (C) — FR-035, Constitution VI
```ts
type SourceBadgeData =
  | { origin: "manual" }
  | { origin: "rule"; ruleName?: string }
  | { origin: "ai"; confidence: "high" | "medium" | "low" }
  | { origin: "source"; sourceName?: string };     // categoria informada pelo banco/arquivo (004: category_source='source')
type SourceBadgeProps = SourceBadgeData & { onCorrect?: () => void };
```
Textos: "Manual", "Regra", "Fonte" (popover: "Categoria informada por {sourceName|a
instituição}."), "IA · confiança alta|média", "IA · revisar" (baixa, cor `warning`).
Toque abre `Popover` explicando a origem ("Categoria sugerida pela IA com confiança média.
Você pode corrigir — sua correção vira regra.") + botão "Corrigir" (se `onCorrect`). Os
limiares de confiança são da feature 014; o componente só recebe o nível.

### `CategoryIcon` (S) / `InstitutionAvatar` (S) — FR-036
`CategoryIcon { visual: CategoryVisualKey; size?: "sm"|"md" }` — ícone e cor vêm **só** do
mapa fixo `CATEGORY_VISUALS` (data-model §1.4; features não escolhem cor de categoria).
`categoryVisual({ systemKey?, slug? } | null): CategoryVisualKey`. `InstitutionAvatar { name:
string; icon?: string }` → iniciais em círculo (`cinza`) por `institutionInitials` (data-model §5)
quando não há ícone.

## 3. Estados (`src/components/states/`) — FR-037, FR-038

| Componente | Props | Comportamento |
|---|---|---|
| `EmptyState` (S) | `title, description?, icon?, action?: {label, href? onClick?}, variant?: "empty" \| "no-results"` | `no-results` traz ação padrão "Limpar filtros" (callback obrigatório) |
| `LoadingSkeleton` (S) | `variant: "list" \| "card" \| "page" \| "text"; rows?` | formato do conteúdo final; `aria-busy` no contêiner + texto sr "Carregando…" |
| `SlowLoading` (C) | `startedAt?; thresholdMs = 10000; onRetry` | troca o esqueleto por "Está demorando mais que o normal." + "Tentar novamente" |
| `ErrorState` (S) | `title?, description?, onRetry?, scope?: "page" \| "block"` | padrão "Não foi possível carregar." / "Verifique sua conexão e tente de novo."; `role="alert"` só em `block` novo; `block` ocupa só o bloco (erro parcial) |
| `OfflineBanner` (C) | — (no shell) | "Você está offline. Algumas ações não vão funcionar até a conexão voltar." |
| `ComingSoon` (S) | `title, description?` | "Em breve" padronizado |

## 4. Formulários e ações (`src/components/forms/`) — FR-039..FR-044

| Componente | API | Notas |
|---|---|---|
| `FormField` (C) | `name, label, help?, children` (integra react-hook-form) | erro abaixo do campo, `aria-describedby`, `aria-invalid` |
| `MoneyInput` (C) | `name, label, direction?: "income"\|"expense"\|"choose"` | `inputMode="decimal"`, `parseMoneyInput`, formata no blur, entrega cents com sinal; seletor Entrada/Saída quando `choose` |
| `DateInput` (C) | `name, label` | `<input type="date">` + chips "Hoje"/"Ontem" (fuso SP) |
| `SelectField` (C) | `name, label, options: {value,label,icon?}[]` | categoria/conta com ícone; até 7 opções → `select`; **> 7 opções** → lista com busca em `ResponsiveDialog` (painel inferior `< md`) — FR-044 |
| `SwitchField` (C) | `name, label, help?` | `switch` com rótulo clicável; estado anunciado |
| `TextareaField` (C) | `name, label, help?, maxLength?` | contador de caracteres anunciado ao se aproximar do limite |
| `SubmitButton` (C) | `children` | `pending` automático pelo estado do formulário; ignora duplo envio; **offline → não envia** e chama `notify.offlineAction()` (data-model §6) |
| `useAppForm` | `useAppForm(schema, defaults)` | `mode: "onTouched"`, `shouldFocusError: true`, zod resolver |
| `ConfirmDialog` (C) | `title, description?, confirmLabel, onConfirm, destructive?` | `alert-dialog`; foco inicial em "Cancelar"; texto nomeia ação e objeto |
| `ResponsiveDialog` (C) | `open, onOpenChange, title, children` | `< md`: `sheet` inferior; `≥ md`: `dialog`; fecha com Esc e gesto de voltar (`useBackToClose`) |
| `toast` | `notify.success(msg)`, `notify.error(msg)`, `notify.info(msg)`, `notify.undo(msg, onUndo)`, `notify.offlineAction()` | ≥ 5 s; `undo` fica até ser dispensado; anunciado (`aria-live`); `<Toaster>` único no **root layout** (vale também fora do shell) |
| `runOnline` | `runOnline(action): Promise<boolean>` | usado por `SubmitButton`/`notify.undo`: sem conexão não chama `action` e mostra "Sem conexão: nada foi salvo…" |

## 5. Shell (`src/components/shell/`)

`AppShell`, `BottomNav`, `SideNav`, `PageHeader { title; back?: string; actions?: Action[] }`
(`Action = { label; icon; onClick? | href? }`, máx. 2 visíveis; da 3ª em diante vão para o menu
"Mais ações"; `back` renderiza link "Voltar" com `aria-label`; título em `h1`; `pt-safe`),
`PrivacyToggle`, `ThemeSelect`, `DemoBadge` (movido da 001 para `shell/`, **renderizado no
root layout**), `EnvIndicator` (também no root layout), `SkipLink`, `TodayProvider` /
`useToday`, `useOnline`, `useBackToClose`, `Logo`.

Telas fora do shell (`/entrar`, `/entrar/codigo`, `/desbloquear` da 006; `/~offline`; 404 raiz)
usam os mesmos primitivos, `forms/`, `states/`, `Logo` e tokens — sem `AppShell`.

## 6. Funções puras (`src/lib/format.ts`, `src/lib/preferences.ts`)

`formatMoney`, `moneyToSpeech`, `parseMoneyInput`, `formatRelativeDate`, `formatAbsoluteDate`,
`dateToSpeech`, `formatPeriod`, `todayInSaoPaulo`, `addDays` — tabela de exemplos em
data-model §5. `parseTheme`, `parsePrivacy`, `THEME_COOKIE`, `PRIVACY_COOKIE`.
`formatCents`/`formatDate` da 001 são substituídas (`formatMoney(c, {variant:"balance"})` /
`formatAbsoluteDate`) e os chamadores atualizados.

## 7. Textos padrão (guia de escrita — FR-048)

| Situação | Texto |
|---|---|
| Erro genérico (bloco) | "Não foi possível carregar." · "Verifique sua conexão e tente de novo." |
| Botão de nova tentativa | "Tentar novamente" |
| Lista vazia (genérico) | "Nada por aqui ainda." |
| Filtro sem resultado | "Nenhum resultado para este filtro." · ação "Limpar filtros" |
| Demora | "Está demorando mais que o normal." |
| Offline | "Você está offline. Algumas ações não vão funcionar até a conexão voltar." |
| Ação offline | "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar." |
| Confirmação destrutiva | "Excluir {objeto} '{nome}'?" · "Esta ação não pode ser desfeita." · "Excluir" / "Cancelar" |
| Desfazer | "{Objeto} excluído." · ação "Desfazer" |
| Em breve | "Em breve" · "Esta seção chega numa próxima versão do Prumo." |
| Página inexistente | "Página não encontrada" · "O endereço pode ter mudado." · ação "Voltar ao início" |
| Erro inesperado (raiz) | "Algo deu errado." · "Tente de novo em instantes." · "Tentar novamente" |
| Valor oculto (leitor) | "valor oculto" |
| Valor ausente (leitor) | "valor indisponível" |

Termos padronizados: **entrada** / **saída** (nunca "crédito/débito" para movimentação),
**transação**, **conta**, **cartão**, **fatura**, **categoria**, **saldo**. Tom: direto,
calmo, segunda pessoa ("você"), sem exclamação, sem jargão técnico.
