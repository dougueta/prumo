import { CategoryIcon } from "@/components/finance/category-icon";
import { CATEGORY_VISUALS, type CategoryVisualKey } from "@/components/finance/category-visuals";
import { GroupedList } from "@/components/finance/grouped-list";
import { InstitutionAvatar } from "@/components/finance/institution-avatar";
import { Money } from "@/components/finance/money";
import { PeriodLabel } from "@/components/finance/period-label";
import { RelativeDate } from "@/components/finance/relative-date";
import { TransactionItem } from "@/components/finance/transaction-item";
import { EmptyState } from "@/components/states/empty-state";
import { SourceBadgeDemo, SummaryCardDemo } from "../demos";
import {
  CATALOG_TODAY,
  catalogDataset,
  pick,
  recentDates,
  sumCents,
  transactionsOn,
} from "../examples";
import type { CatalogEntry } from "../types";

const salary = () => pick((t) => t.category?.visual === "salario");
const purchase = () => pick((t) => t.category?.visual === "alimentacao" && t.status === "posted");
const longest = () =>
  pick(
    (t) =>
      t.description.length ===
      Math.max(...catalogDataset().transactions.map((tx) => tx.description.length)),
  );

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{children}</div>;
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface px-2">
      {children}
    </ul>
  );
}

export const FINANCAS: CatalogEntry[] = [
  {
    slug: "money",
    name: "Valor monetário",
    group: "financas",
    description:
      "Mostra dinheiro a partir de centavos inteiros, em pt-BR, com sinal, cor semântica, leitura por extenso e máscara do modo privacidade.",
    importPath: "@/components/finance/money",
    alsoCovers: ["@/components/finance/money-compact"],
    whenToUse: [
      "Todo valor em dinheiro exibido no app (listas, cards, detalhes, totais).",
      "movement para entradas e saídas; balance para saldos; neutral para totais de categoria; compact só em cards com pouco espaço.",
    ],
    whenNotToUse: [
      "Campos de digitação de valor — use MoneyInput.",
      "Nunca formate dinheiro à mão (toFixed, cents / 100, template string).",
    ],
    a11y: [
      "O leitor de tela ouve o valor por extenso: “saída de 45 reais e 90 centavos”.",
      "Com o modo privacidade, a leitura vira “valor oculto”.",
      "Entrada e saída têm sinal (+ / −), não só cor; algarismos tabulares alinham colunas.",
      "Na variante compacta, o valor completo abre num popover acessível por toque e teclado.",
    ],
    texts: {
      "Valor oculto (leitor)": "valor oculto",
      "Valor ausente (leitor)": "valor indisponível",
    },
    states: ["movimentação", "saldo", "neutra", "compacta", "ausente", "outra moeda"],
    examples: [
      {
        title: "movimentação",
        kind: "do",
        render: () => (
          <Row>
            <Money cents={salary().amountCents} />
            <Money cents={purchase().amountCents} />
            <Money cents={0} />
            <Money cents={1} />
            <Money cents={-1} />
          </Row>
        ),
      },
      {
        title: "saldo",
        render: () => (
          <Row>
            <Money cents={salary().amountCents} variant="balance" size="lg" />
            <Money cents={purchase().amountCents} variant="balance" size="lg" />
          </Row>
        ),
      },
      {
        title: "neutra",
        render: () => <Money cents={purchase().amountCents} variant="neutral" />,
      },
      {
        title: "compacta",
        render: () => (
          <Row>
            <Money cents={salary().amountCents * 100} variant="compact" size="xl" />
            <Money cents={100000000000} variant="compact" size="xl" />
          </Row>
        ),
      },
      { title: "ausente", render: () => <Money cents={null} /> },
      {
        title: "outra moeda",
        render: () => {
          const intl = pick((t) => t.original !== undefined);
          return (
            <Money cents={intl.original?.amountMinor ?? 0} currency={intl.original?.currency} />
          );
        },
      },
      {
        title: "Errado: valor só com cor, sem sinal",
        kind: "dont",
        note: "Quem não distingue cores não sabe se é entrada ou saída. O Money sempre põe + ou −.",
        render: () => <span className="text-expense tabular-nums">R$ 45,90</span>,
      },
    ],
  },
  {
    slug: "relative-date",
    name: "Data",
    group: "financas",
    description:
      "Data de transação relativa (Hoje, Ontem, 28 set.) ou absoluta (28/09/2026), no fuso de São Paulo.",
    importPath: "@/components/finance/relative-date",
    whenToUse: ["Datas de transações, faturas e eventos em listas e detalhes."],
    whenNotToUse: [
      "Horários técnicos (logs) — não fazem parte da interface.",
      "Períodos (mês, intervalo) — use PeriodLabel.",
    ],
    a11y: [
      "O leitor de tela ouve a data completa (“Ontem, 29 de setembro de 2026”).",
      "Passar o mouse mostra a data absoluta.",
    ],
    states: ["relativa", "absoluta"],
    examples: [
      {
        title: "relativa",
        kind: "do",
        render: () => (
          <Row>
            {[CATALOG_TODAY, ...recentDates(4).filter((d) => d !== CATALOG_TODAY)]
              .slice(0, 4)
              .map((date) => (
                <RelativeDate key={date} date={date} />
              ))}
            <RelativeDate date={catalogDataset().transactions[0].date} />
          </Row>
        ),
      },
      {
        title: "absoluta",
        render: () => <RelativeDate date={CATALOG_TODAY} variant="absolute" />,
      },
      {
        title: "Errado: formato americano ou ISO",
        kind: "dont",
        note: "Nunca mostre 2026-09-28 ou 09/28/2026.",
        render: () => <span>2026-09-28</span>,
      },
    ],
  },
  {
    slug: "period-label",
    name: "Período",
    group: "financas",
    description: "Mês/ano ou intervalo de datas em pt-BR, para filtros e resumos.",
    importPath: "@/components/finance/period-label",
    whenToUse: ["Título de resumo mensal, filtro de período, cabeçalho de fatura."],
    whenNotToUse: ["Data de uma transação — use Data."],
    a11y: ["Texto simples, lido como está (“Setembro de 2026”)."],
    states: ["mês", "intervalo"],
    examples: [
      { title: "mês", kind: "do", render: () => <PeriodLabel month={CATALOG_TODAY.slice(0, 7)} /> },
      {
        title: "intervalo",
        render: () => (
          <Row>
            <PeriodLabel from={recentDates(10).at(-1) ?? CATALOG_TODAY} to={CATALOG_TODAY} />
          </Row>
        ),
      },
      {
        title: "Errado: mês em número",
        kind: "dont",
        note: "Prefira “Setembro de 2026” a “09/2026”.",
        render: () => <span>09/2026</span>,
      },
    ],
  },
  {
    slug: "transaction-item",
    name: "Item de transação",
    group: "financas",
    description:
      "Linha de transação: ícone da categoria, descrição, categoria · conta · data, valor e indicadores (pendente, parcela, natureza, moeda original, origem da categoria).",
    importPath: "@/components/finance/transaction-item",
    whenToUse: ["Extrato, últimas transações, detalhes de fatura — toda lista de transações."],
    whenNotToUse: ["Resumos agregados — use SummaryCard.", "Tabelas de planilha."],
    a11y: [
      "A linha inteira é um único link ou botão (acionável por teclado).",
      "Indicadores são texto (“Pendente”, “3/10”, “Entre contas”), nunca só ícone ou cor.",
      "A descrição longa é cortada em 2 linhas, com o texto completo no título.",
    ],
    texts: { Pendente: "Pendente", "Sem categoria": "Sem categoria" },
    states: [
      "normal",
      "compacta",
      "pendente",
      "parcela",
      "entre contas",
      "pagamento de fatura",
      "estorno",
      "moeda original",
      "sem categoria",
      "descrição longa",
    ],
    examples: [
      {
        title: "normal",
        kind: "do",
        render: () => (
          <List>
            <TransactionItem data={purchase()} href="/catalogo/transaction-item" />
            <TransactionItem data={salary()} href="/catalogo/transaction-item" />
          </List>
        ),
      },
      {
        title: "compacta",
        render: () => (
          <List>
            <TransactionItem data={purchase()} density="compact" />
          </List>
        ),
      },
      {
        title: "pendente",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.status === "pending")} />
          </List>
        ),
      },
      {
        title: "parcela",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.installment !== undefined)} />
          </List>
        ),
      },
      {
        title: "entre contas",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.nature === "internal_transfer")} />
          </List>
        ),
      },
      {
        title: "pagamento de fatura",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.nature === "card_payment")} />
          </List>
        ),
      },
      {
        title: "estorno",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.nature === "refund")} />
          </List>
        ),
      },
      {
        title: "moeda original",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.original !== undefined)} />
          </List>
        ),
      },
      {
        title: "sem categoria",
        render: () => (
          <List>
            <TransactionItem data={pick((t) => t.category === null)} />
          </List>
        ),
      },
      {
        title: "descrição longa",
        render: () => (
          <List>
            <TransactionItem
              data={{
                ...longest(),
                description: `${longest().description} · ${salary().description} · ${purchase().description}`,
              }}
            />
          </List>
        ),
      },
      {
        title: "Errado: valor empurrado para fora ou só cor de categoria",
        kind: "dont",
        note: "Não monte linhas próprias: o valor nunca pode sair da tela e a categoria sempre tem nome.",
        render: () => (
          <span className="text-foreground-muted">(linha montada à mão — não faça)</span>
        ),
      },
    ],
  },
  {
    slug: "summary-card",
    name: "Card de resumo",
    group: "financas",
    description:
      "Título, valor principal e variação opcional com seta + sinal + texto; estados próprios.",
    importPath: "@/components/finance/summary-card",
    whenToUse: ["Saldo, entradas × saídas do mês, total de fatura, patrimônio."],
    whenNotToUse: ["Listas de itens — use GroupedList + TransactionItem."],
    a11y: [
      "Título é um cabeçalho (h2).",
      "Variação traz seta, sinal e texto (“↓ −R$ 120,00 vs. agosto”), não só cor.",
    ],
    states: ["pronto", "variação", "compacto", "carregando", "erro", "vazio"],
    examples: [
      {
        title: "pronto",
        kind: "do",
        render: () => <SummaryCardDemo title="Saldo" cents={salary().amountCents} />,
      },
      {
        title: "variação",
        render: () => (
          <SummaryCardDemo
            title="Saídas do mês"
            variant="movement"
            cents={sumCents(transactionsOn(recentDates(1)[0]))}
            delta={{
              cents: purchase().amountCents,
              label: "vs. agosto",
              trend: "down",
              good: true,
            }}
          />
        ),
      },
      {
        title: "compacto",
        render: () => (
          <SummaryCardDemo title="Patrimônio" cents={salary().amountCents * 100} compact />
        ),
      },
      {
        title: "carregando",
        render: () => <SummaryCardDemo title="Saldo" cents={null} state="loading" />,
      },
      { title: "erro", render: () => <SummaryCardDemo title="Saldo" cents={null} state="error" /> },
      {
        title: "vazio",
        render: () => <SummaryCardDemo title="Saldo" cents={null} state="empty" />,
      },
      {
        title: "Errado: variação só com cor",
        kind: "dont",
        note: "“R$ 120,00” em verde não diz se subiu ou desceu. Use delta.",
        render: () => <span className="text-income">R$ 120,00</span>,
      },
    ],
  },
  {
    slug: "grouped-list",
    name: "Lista agrupada por data",
    group: "financas",
    description: "Agrupa itens por data com cabeçalho relativo e total opcional do dia.",
    importPath: "@/components/finance/grouped-list",
    whenToUse: ["Extrato e qualquer lista cronológica de transações."],
    whenNotToUse: ["Listas sem data (categorias, contas)."],
    a11y: ["Lista semântica (ul/li); cada dia é uma seção com cabeçalho."],
    states: ["com grupos", "vazia"],
    examples: [
      {
        title: "com grupos",
        kind: "do",
        render: () => (
          <GroupedList
            groups={recentDates(2).map((date) => ({
              date,
              totalCents: sumCents(transactionsOn(date)),
              items: transactionsOn(date).map((item) => (
                <TransactionItem key={item.id} data={item} showDate={false} />
              )),
            }))}
          />
        ),
      },
      {
        title: "vazia",
        render: () => (
          <GroupedList groups={[]} emptyState={<EmptyState title="Nenhuma transação ainda" />} />
        ),
      },
      {
        title: "Errado: data repetida em cada item",
        kind: "dont",
        note: "Dentro de grupos, use showDate={false}: a data já está no cabeçalho.",
        render: () => <span className="text-foreground-muted">Hoje · Hoje · Hoje</span>,
      },
    ],
  },
  {
    slug: "source-badge",
    name: "Selo de origem da categoria",
    group: "financas",
    description:
      "Mostra de onde veio a categoria (Manual, Regra, Fonte, IA com confiança) e permite corrigir.",
    importPath: "@/components/finance/source-badge",
    whenToUse: [
      "Toda categoria que não foi definida pelo usuário — obrigatório para IA (Constitution VI).",
    ],
    whenNotToUse: ["Para indicar status da transação — use os indicadores do item."],
    a11y: [
      "É um botão: toque/Enter explica a origem e oferece “Corrigir”.",
      "Confiança baixa diz “revisar” em texto.",
    ],
    texts: {
      IA: "Categoria sugerida pela IA com confiança média. Você pode corrigir — sua correção vira regra.",
      Fonte: "Categoria informada pela instituição.",
    },
    states: ["manual", "regra", "fonte", "IA alta", "IA média", "IA baixa"],
    examples: [
      { title: "manual", kind: "do", render: () => <SourceBadgeDemo origin="manual" /> },
      { title: "regra", render: () => <SourceBadgeDemo origin="rule" /> },
      { title: "fonte", render: () => <SourceBadgeDemo origin="source" /> },
      { title: "IA alta", render: () => <SourceBadgeDemo origin="ai" confidence="high" /> },
      { title: "IA média", render: () => <SourceBadgeDemo origin="ai" confidence="medium" /> },
      { title: "IA baixa", render: () => <SourceBadgeDemo origin="ai" confidence="low" /> },
      {
        title: "Errado: categoria da IA sem selo",
        kind: "dont",
        note: "Sem o selo o usuário não sabe que pode (e deve) revisar.",
        render: () => <span>Alimentação</span>,
      },
    ],
  },
  {
    slug: "category-icon",
    name: "Ícone de categoria",
    group: "financas",
    description:
      "Ícone e cor de cada categoria de 1º nível, do mapa fixo do design system (categoryVisual).",
    importPath: "@/components/finance/category-icon",
    alsoCovers: ["@/components/finance/category-visuals"],
    whenToUse: ["Ao lado do nome da categoria em listas e detalhes."],
    whenNotToUse: ["Nunca escolha cor de categoria na feature — use categoryVisual()."],
    a11y: ["Decorativo (aria-hidden): o nome da categoria sempre aparece junto."],
    states: ["mapa completo"],
    examples: [
      {
        title: "mapa completo",
        kind: "do",
        render: () => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(CATEGORY_VISUALS) as CategoryVisualKey[]).map((key) => (
              <span key={key} className="flex items-center gap-2 text-sm">
                <CategoryIcon visual={key} size="sm" />
                {key}
              </span>
            ))}
          </div>
        ),
      },
      {
        title: "Errado: ícone sem nome",
        kind: "dont",
        note: "Cor e ícone sozinhos não bastam — sempre mostre o nome.",
        render: () => <CategoryIcon visual="alimentacao" />,
      },
    ],
  },
  {
    slug: "institution-avatar",
    name: "Avatar de instituição",
    group: "financas",
    description: "Ícone da instituição ou, sem ícone, iniciais em círculo neutro.",
    importPath: "@/components/finance/institution-avatar",
    whenToUse: ["Listas de contas e conexões."],
    whenNotToUse: ["Ícones de marcas de terceiros servidos de fora do app."],
    a11y: ["Decorativo: o nome da instituição aparece ao lado."],
    states: ["iniciais"],
    examples: [
      {
        title: "iniciais",
        kind: "do",
        render: () => (
          <Row>
            {catalogDataset().institutions.map((institution) => (
              <span key={institution.id} className="flex items-center gap-2 text-sm">
                <InstitutionAvatar name={institution.name} />
                {institution.name}
              </span>
            ))}
          </Row>
        ),
      },
      {
        title: "Errado: logotipo baixado de site externo",
        kind: "dont",
        note: "Nenhuma requisição externa em runtime (privacidade e custo zero).",
        render: () => (
          <span className="text-foreground-muted">&lt;img src=&quot;https://…&quot;&gt;</span>
        ),
      },
    ],
  },
];
