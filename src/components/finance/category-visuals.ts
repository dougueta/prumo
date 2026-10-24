/**
 * Mapa fixo de ícone/cor por categoria de 1º nível (spec 003, data-model §1.4; FR-036).
 * Nenhuma feature escolhe cor de categoria por conta própria; subcategorias herdam do pai.
 * A 004 não guarda ícone/cor: quem monta o view model chama `categoryVisual()`.
 */
export const CATEGORY_COLORS = [
  "petroleo",
  "azul",
  "verde",
  "oliva",
  "ambar",
  "terracota",
  "rosa",
  "violeta",
  "cinza",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export type CategoryVisual = { icon: string; color: CategoryColor };

export const CATEGORY_VISUALS = {
  alimentacao: { icon: "UtensilsCrossed", color: "terracota" },
  moradia: { icon: "House", color: "ambar" },
  transporte: { icon: "Car", color: "azul" },
  saude: { icon: "HeartPulse", color: "rosa" },
  educacao: { icon: "GraduationCap", color: "violeta" },
  lazer: { icon: "Ticket", color: "rosa" },
  viagens: { icon: "Plane", color: "azul" },
  compras: { icon: "ShoppingBag", color: "violeta" },
  "assinaturas-e-servicos": { icon: "Repeat", color: "petroleo" },
  "cuidados-pessoais": { icon: "Sparkles", color: "rosa" },
  pets: { icon: "PawPrint", color: "oliva" },
  "familia-e-filhos": { icon: "Baby", color: "ambar" },
  "impostos-tarifas-e-juros": { icon: "Landmark", color: "cinza" },
  doacoes: { icon: "HandHeart", color: "verde" },
  "outros-gastos": { icon: "Ellipsis", color: "cinza" },
  salario: { icon: "Briefcase", color: "verde" },
  "renda-extra": { icon: "Coins", color: "verde" },
  rendimentos: { icon: "TrendingUp", color: "petroleo" },
  reembolsos: { icon: "Undo2", color: "oliva" },
  "outras-receitas": { icon: "PiggyBank", color: "verde" },
  "transferencia-entre-contas": { icon: "ArrowLeftRight", color: "cinza" },
  "pagamento-de-fatura": { icon: "CreditCard", color: "cinza" },
  investimentos: { icon: "ChartLine", color: "petroleo" },
  "sem-categoria": { icon: "CircleHelp", color: "cinza" },
  personalizada: { icon: "Tag", color: "cinza" },
} as const satisfies Record<string, CategoryVisual>;

export type CategoryVisualKey = keyof typeof CATEGORY_VISUALS;

/** Chaves de sistema da 004 (⚙) → visual. */
const SYSTEM_KEYS: Record<string, CategoryVisualKey> = {
  salary: "salario",
  internal_transfer: "transferencia-entre-contas",
  card_payment: "pagamento-de-fatura",
  uncategorized: "sem-categoria",
  bank_fees: "impostos-tarifas-e-juros",
};

/** Chaves (`key`) de 1º nível da taxonomia da 004 → visual. */
const CORE_KEYS: Record<string, CategoryVisualKey> = {
  food: "alimentacao",
  housing: "moradia",
  transport: "transporte",
  health: "saude",
  education: "educacao",
  leisure: "lazer",
  travel: "viagens",
  shopping: "compras",
  subscriptions: "assinaturas-e-servicos",
  personal_care: "cuidados-pessoais",
  pets: "pets",
  family: "familia-e-filhos",
  taxes_fees: "impostos-tarifas-e-juros",
  donations: "doacoes",
  other_expenses: "outros-gastos",
  salary: "salario",
  extra_income: "renda-extra",
  yields: "rendimentos",
  refunds: "reembolsos",
  other_income: "outras-receitas",
  internal_transfer: "transferencia-entre-contas",
  card_payment: "pagamento-de-fatura",
  investments: "investimentos",
  uncategorized: "sem-categoria",
};

/** "Assinaturas e serviços" → "assinaturas-e-servicos" (sem acento, sem pontuação). */
export function slugifyCategoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isKey(value: string): value is CategoryVisualKey {
  return Object.hasOwn(CATEGORY_VISUALS, value);
}

/**
 * Categoria de 1º nível → chave do visual. `systemKey` conhecido → chave correspondente; senão
 * `slug` (slug pt-BR do nome ou `key` da 004); senão `personalizada`. `null` → `sem-categoria`.
 */
export function categoryVisual(
  ref: { systemKey?: string | null; slug?: string | null } | null,
): CategoryVisualKey {
  if (ref === null) return "sem-categoria";
  if (ref.systemKey && SYSTEM_KEYS[ref.systemKey]) return SYSTEM_KEYS[ref.systemKey];
  if (ref.slug) {
    if (isKey(ref.slug)) return ref.slug;
    if (CORE_KEYS[ref.slug]) return CORE_KEYS[ref.slug];
  }
  return "personalizada";
}
