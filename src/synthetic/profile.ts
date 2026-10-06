/**
 * Perfil sintético que espelha a estrutura financeira do Doug com nomes 100% fictícios (FR-015):
 * 2 contas que recebem salário, 1 carteira digital e 2 cartões (um concentra os gastos).
 */

export const INSTITUTIONS = [
  { id: "inst-aurora", name: "Banco Aurora (simulado)", kind: "bank" },
  { id: "inst-horizonte", name: "Banco Horizonte (simulado)", kind: "bank" },
  { id: "inst-orbita", name: "Banco Órbita (simulado)", kind: "bank" },
  { id: "inst-pix", name: "Carteira Pix (simulada)", kind: "wallet" },
] as const;

export const ACCOUNTS = {
  aurora: {
    id: "acc-aurora",
    institutionId: "inst-aurora",
    name: "Conta Aurora (simulada)",
    type: "checking",
    receivesSalary: true,
  },
  horizonte: {
    id: "acc-horizonte",
    institutionId: "inst-horizonte",
    name: "Conta Horizonte (simulada)",
    type: "checking",
    receivesSalary: true,
  },
  pix: {
    id: "acc-pix",
    institutionId: "inst-pix",
    name: "Carteira Pix (simulada)",
    type: "wallet",
    receivesSalary: false,
  },
  orbitaCard: {
    id: "card-orbita",
    institutionId: "inst-orbita",
    name: "Cartão Órbita (simulado)",
    type: "credit_card",
    receivesSalary: false,
    creditLimitCents: 1_500_000,
    closingDay: 3,
    dueDay: 10,
  },
  horizonteCard: {
    id: "card-horizonte",
    institutionId: "inst-horizonte",
    name: "Cartão Horizonte (simulado)",
    type: "credit_card",
    receivesSalary: false,
    creditLimitCents: 800_000,
    closingDay: 25,
    dueDay: 5,
  },
} as const;

export const SALARIES = [
  {
    accountId: ACCOUNTS.aurora.id,
    day: 5,
    cents: 520_000,
    description: "Salário Empresa Fictícia",
  },
  {
    accountId: ACCOUNTS.horizonte.id,
    day: 20,
    cents: 380_000,
    description: "Salário Empresa Fictícia (2ª parte)",
  },
] as const;

/** `raiseFromMonth`: índice do mês (0-based) a partir do qual o preço sobe. */
export const SUBSCRIPTIONS = [
  {
    description: "Streaming Filmes Fictício",
    accountId: ACCOUNTS.orbitaCard.id,
    day: 8,
    cents: 3_990,
    raisedCents: 4_490,
    raiseFromMonth: 6,
  },
  {
    description: "Música Fictícia Premium",
    accountId: ACCOUNTS.orbitaCard.id,
    day: 12,
    cents: 2_190,
  },
  { description: "Academia Fictícia", accountId: ACCOUNTS.horizonteCard.id, day: 2, cents: 11_990 },
  { description: "Nuvem Fictícia 100 GB", accountId: ACCOUNTS.orbitaCard.id, day: 15, cents: 990 },
  {
    description: "Jornal Fictício Digital",
    accountId: ACCOUNTS.orbitaCard.id,
    day: 20,
    cents: 2_990,
  },
  {
    description: "App de Idiomas Fictício",
    accountId: ACCOUNTS.horizonteCard.id,
    day: 22,
    cents: 4_490,
  },
] as const;

/** Faixas de valor em centavos por tipo de estabelecimento fictício. */
export const MERCHANTS = [
  { description: "Mercado Vila Fictícia", min: 4_000, max: 45_000 },
  { description: "Padaria Pão Imaginário", min: 800, max: 4_500 },
  { description: "Restaurante Sabor Fictício", min: 3_500, max: 18_000 },
  { description: "Delivery Comida Fictícia", min: 2_500, max: 9_000 },
  { description: "Posto Combustível Fictício", min: 10_000, max: 30_000 },
  { description: "Transporte por App Fictício", min: 1_200, max: 6_500 },
  { description: "Farmácia Saúde Fictícia", min: 1_500, max: 15_000 },
  { description: "Loja de Roupas Fictícia", min: 8_000, max: 40_000 },
  { description: "Livraria Página Fictícia", min: 3_000, max: 12_000 },
  { description: "Cinema Tela Fictícia", min: 2_500, max: 8_000 },
  { description: "Pet Shop Fictício", min: 3_000, max: 20_000 },
  { description: "Café Grão Fictício", min: 700, max: 3_500 },
] as const;

export const INSTALLMENT_PURCHASES = [
  {
    description: "Loja de Eletro Fictícia",
    accountId: ACCOUNTS.orbitaCard.id,
    startMonth: 1,
    day: 14,
    total: 6,
    cents: 25_000,
  },
  {
    description: "Móveis Fictícios",
    accountId: ACCOUNTS.horizonteCard.id,
    startMonth: 3,
    day: 9,
    total: 10,
    cents: 18_990,
  },
  {
    description: "Agência de Viagem Fictícia",
    accountId: ACCOUNTS.orbitaCard.id,
    startMonth: 7,
    day: 18,
    total: 3,
    cents: 45_000,
  },
] as const;

export const WALLET_TOP_UP_CENTS = 30_000;
export const MONTHLY_FEE = {
  accountId: ACCOUNTS.horizonte.id,
  day: 10,
  cents: 3_500,
  description: "Tarifa Pacote de Serviços (simulada)",
} as const;
export const REFUND = {
  accountId: ACCOUNTS.orbitaCard.id,
  month: 4,
  day: 16,
  cents: 8_990,
  description: "Estorno Loja de Roupas Fictícia",
} as const;
export const INTERNATIONAL = {
  accountId: ACCOUNTS.orbitaCard.id,
  month: 5,
  day: 11,
  usdMinor: 2_000,
  brlCents: 11_180,
  description: "Software Fictício Inc. (USD)",
} as const;
