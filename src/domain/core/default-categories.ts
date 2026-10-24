import type { CategoryKind, InstitutionKind, SystemCategoryKey } from "./types";

/**
 * Taxonomia padrão (data-model §4, Clarificação Q1 — estilo GuiaBolso). Fonte única:
 * `scripts/generate-category-seed.ts` gera a migração `category_templates` a partir daqui e a
 * memória (modo demonstração) copia a mesma lista no bootstrap.
 */

export type CategoryTemplate = {
  key: string;
  parentKey: string | null;
  name: string;
  kind: CategoryKind;
  systemKey: SystemCategoryKey | null;
  sortOrder: number;
};

type Child = [key: string, name: string, systemKey?: SystemCategoryKey];
type Top = {
  key: string;
  name: string;
  kind: CategoryKind;
  systemKey?: SystemCategoryKey;
  children?: Child[];
};

const TREE: Top[] = [
  // Despesas (15)
  {
    key: "food",
    name: "Alimentação",
    kind: "expense",
    children: [
      ["groceries", "Mercado"],
      ["restaurants", "Restaurantes"],
      ["delivery", "Delivery"],
      ["bakery_coffee", "Padaria e café"],
      ["snacks", "Lanches"],
    ],
  },
  {
    key: "housing",
    name: "Moradia",
    kind: "expense",
    children: [
      ["rent_mortgage", "Aluguel ou financiamento"],
      ["condo_fee", "Condomínio"],
      ["electricity", "Energia"],
      ["water", "Água"],
      ["gas", "Gás"],
      ["internet_tv", "Internet e TV"],
      ["maintenance", "Manutenção e reforma"],
      ["furniture", "Móveis e decoração"],
    ],
  },
  {
    key: "transport",
    name: "Transporte",
    kind: "expense",
    children: [
      ["fuel", "Combustível"],
      ["ride_hailing", "Aplicativos de transporte"],
      ["public_transport", "Transporte público"],
      ["parking_tolls", "Estacionamento e pedágio"],
      ["vehicle_maintenance", "Manutenção do veículo"],
      ["vehicle_taxes", "Seguro, IPVA e licenciamento"],
    ],
  },
  {
    key: "health",
    name: "Saúde",
    kind: "expense",
    children: [
      ["health_plan", "Plano de saúde"],
      ["pharmacy", "Farmácia"],
      ["appointments", "Consultas e exames"],
      ["dentist", "Dentista"],
      ["fitness", "Academia e esportes"],
    ],
  },
  {
    key: "education",
    name: "Educação",
    kind: "expense",
    children: [
      ["courses", "Cursos"],
      ["books", "Livros e materiais"],
      ["tuition", "Mensalidade escolar"],
    ],
  },
  {
    key: "leisure",
    name: "Lazer",
    kind: "expense",
    children: [
      ["events", "Cinema, shows e eventos"],
      ["bars", "Bares e baladas"],
      ["hobbies", "Hobbies"],
      ["games", "Jogos"],
    ],
  },
  {
    key: "travel",
    name: "Viagens",
    kind: "expense",
    children: [
      ["tickets", "Passagens"],
      ["lodging", "Hospedagem"],
      ["tours", "Passeios"],
      ["foreign_expenses", "Câmbio e despesas no exterior"],
    ],
  },
  {
    key: "shopping",
    name: "Compras",
    kind: "expense",
    children: [
      ["clothing", "Roupas e calçados"],
      ["electronics", "Eletrônicos"],
      ["home_goods", "Casa e utilidades"],
      ["gifts", "Presentes"],
    ],
  },
  {
    key: "subscriptions",
    name: "Assinaturas e serviços",
    kind: "expense",
    children: [
      ["streaming", "Streaming"],
      ["software", "Aplicativos e software"],
      ["mobile_phone", "Telefonia celular"],
      ["clubs", "Clubes e associações"],
    ],
  },
  {
    key: "personal_care",
    name: "Cuidados pessoais",
    kind: "expense",
    children: [
      ["salon", "Salão e barbearia"],
      ["cosmetics", "Cosméticos e higiene"],
    ],
  },
  {
    key: "pets",
    name: "Pets",
    kind: "expense",
    children: [
      ["pet_supplies", "Ração e produtos"],
      ["vet", "Veterinário"],
    ],
  },
  {
    key: "family",
    name: "Família e filhos",
    kind: "expense",
    children: [
      ["school_daycare", "Escola e creche"],
      ["allowance", "Mesada"],
      ["kids_items", "Brinquedos e roupas infantis"],
    ],
  },
  {
    key: "taxes_fees",
    name: "Impostos, tarifas e juros",
    kind: "expense",
    children: [
      ["bank_fees", "Tarifas bancárias", "bank_fees"],
      ["interest_fines", "Juros e multas"],
      ["iof", "IOF"],
      ["taxes", "Impostos (IR, IPTU, outros)"],
      ["card_annual_fee", "Anuidade de cartão"],
    ],
  },
  {
    key: "donations",
    name: "Doações",
    kind: "expense",
    children: [
      ["donations", "Doações"],
      ["tithes", "Dízimo e contribuições"],
    ],
  },
  {
    key: "other_expenses",
    name: "Outros gastos",
    kind: "expense",
    children: [
      ["cash_withdrawals", "Saques em dinheiro"],
      ["misc", "Diversos"],
    ],
  },
  // Receitas (5)
  {
    key: "salary",
    name: "Salário",
    kind: "income",
    systemKey: "salary",
    children: [
      ["salary", "Salário"],
      ["thirteenth", "13º salário"],
      ["vacation", "Férias"],
      ["bonus", "PLR e bônus"],
    ],
  },
  {
    key: "extra_income",
    name: "Renda extra",
    kind: "income",
    children: [
      ["freelance", "Freelance"],
      ["sales", "Vendas"],
      ["rent_received", "Aluguéis recebidos"],
    ],
  },
  {
    key: "yields",
    name: "Rendimentos",
    kind: "income",
    children: [
      ["interest", "Juros e rendimentos"],
      ["dividends", "Dividendos"],
      ["cashback", "Cashback"],
    ],
  },
  {
    key: "refunds",
    name: "Reembolsos",
    kind: "income",
    children: [
      ["chargebacks", "Estornos"],
      ["expense_refunds", "Reembolsos de despesas"],
    ],
  },
  {
    key: "other_income",
    name: "Outras receitas",
    kind: "income",
    children: [
      ["gifts_received", "Presentes recebidos"],
      ["misc", "Diversos"],
    ],
  },
  // Neutras (3)
  {
    key: "internal_transfer",
    name: "Transferência entre contas",
    kind: "neutral",
    systemKey: "internal_transfer",
  },
  { key: "card_payment", name: "Pagamento de fatura", kind: "neutral", systemKey: "card_payment" },
  {
    key: "investments",
    name: "Investimentos",
    kind: "neutral",
    children: [
      ["contributions", "Aplicações"],
      ["redemptions", "Resgates"],
    ],
  },
  // Rótulo de "sem categoria" (transações nunca a referenciam: category_id NULL).
  { key: "uncategorized", name: "Sem categoria", kind: "expense", systemKey: "uncategorized" },
];

export const DEFAULT_CATEGORIES: readonly CategoryTemplate[] = TREE.flatMap((top, topIndex) => [
  {
    key: top.key,
    parentKey: null,
    name: top.name,
    kind: top.kind,
    systemKey: top.systemKey ?? null,
    sortOrder: (topIndex + 1) * 10,
  },
  ...(top.children ?? []).map(([key, name, systemKey], childIndex) => ({
    key: `${top.key}.${key}`,
    parentKey: top.key,
    name,
    kind: top.kind,
    systemKey: systemKey ?? null,
    sortOrder: (childIndex + 1) * 10,
  })),
]);

/** Catálogo de instituições de referência (data-model §2.2) — não é dado pessoal (FR-005). */
export type CatalogInstitution = {
  id: string;
  name: string;
  kind: InstitutionKind;
  bankCode: string | null;
};

const catalogId = (code: string) => `00000000-0000-4000-a000-000000000${code}`;

export const CATALOG_INSTITUTIONS: readonly CatalogInstitution[] = [
  { id: catalogId("323"), name: "Mercado Pago", kind: "digital_wallet", bankCode: "323" },
  { id: catalogId("104"), name: "Caixa Econômica Federal", kind: "bank", bankCode: "104" },
  { id: catalogId("380"), name: "PicPay", kind: "digital_wallet", bankCode: "380" },
  { id: catalogId("336"), name: "C6 Bank", kind: "bank", bankCode: "336" },
  { id: catalogId("260"), name: "Nubank", kind: "bank", bankCode: "260" },
  { id: catalogId("077"), name: "Banco Inter", kind: "bank", bankCode: "077" },
  { id: catalogId("341"), name: "Itaú", kind: "bank", bankCode: "341" },
  { id: catalogId("237"), name: "Bradesco", kind: "bank", bankCode: "237" },
  { id: catalogId("001"), name: "Banco do Brasil", kind: "bank", bankCode: "001" },
  { id: catalogId("033"), name: "Santander", kind: "bank", bankCode: "033" },
  { id: catalogId("999"), name: "Outra instituição", kind: "other", bankCode: null },
];

/** Gera o SQL da migração de seed (determinístico; R-12). */
export function buildCatalogSeedSql(): string {
  const q = (value: string | null) =>
    value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  const templates = DEFAULT_CATEGORIES.map(
    (c) =>
      `  (${q(c.key)}, ${q(c.parentKey)}, ${q(c.name)}, ${q(c.kind)}, ${q(c.systemKey)}, ${c.sortOrder})`,
  ).join(",\n");
  const institutions = CATALOG_INSTITUTIONS.map(
    (i) => `  (${q(i.id)}, NULL, ${q(i.name)}, ${q(i.kind)}, ${q(i.bankCode)})`,
  ).join(",\n");
  return `-- Feature 004 · modelo-dados-core (dona). GERADO por scripts/generate-category-seed.ts a partir
-- de src/domain/core/default-categories.ts — não edite à mão (research R-12).
-- Modelos de categoria (data-model §4) e catálogo de instituições de referência (§2.2, FR-005).

INSERT INTO public.category_templates (key, parent_key, name, kind, system_key, sort_order) VALUES
${templates};

INSERT INTO public.institutions (id, owner_id, name, kind, bank_code) VALUES
${institutions};
`;
}
