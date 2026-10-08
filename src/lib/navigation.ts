import {
  CalendarRange,
  Ellipsis,
  House,
  ReceiptText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/**
 * Fonte única da navegação do Prumo (spec 003, contracts/navigation.md). Mudança aqui = PR na
 * 003 (dona) + atualização do contrato. Nenhuma feature cria navegação própria (FR-008).
 */
export type DestinationId = "inicio" | "extrato" | "planejamento" | "investimentos" | "mais";

export type Destination = {
  id: DestinationId;
  label: string;
  href: `/${string}`;
  icon: LucideIcon;
  /** Destaque do destino ativo (regra de prefixo; "/" só quando exato). */
  matches: (pathname: string) => boolean;
};

/** `/extrato/123` ativa `/extrato`; `/` só ativa quando exato. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function destination(
  id: DestinationId,
  label: string,
  href: `/${string}`,
  icon: LucideIcon,
  extraPrefixes: string[] = [],
): Destination {
  return {
    id,
    label,
    href,
    icon,
    matches: (pathname) =>
      isActive(href, pathname) || extraPrefixes.some((prefix) => isActive(prefix, pathname)),
  };
}

/** FR-007 — exatamente 5 destinos, nesta ordem. Proibido: 6º destino, destino condicional. */
export const DESTINATIONS: readonly Destination[] = [
  destination("inicio", "Início", "/", House),
  destination("extrato", "Extrato", "/extrato", ReceiptText),
  destination("planejamento", "Planejamento", "/planejamento", CalendarRange),
  destination("investimentos", "Investimentos", "/investimentos", TrendingUp),
  // O catálogo (só local/preview) é atalho de "Mais".
  destination("mais", "Mais", "/mais", Ellipsis, ["/catalogo"]),
];

export function activeDestination(pathname: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.matches(pathname));
}

export type FeatureSlot = {
  feature: `${number}`;
  destination: DestinationId | "plataforma";
  /** Rota prevista; `null` = sem tela própria. */
  path: string | null;
  label: string;
};

/** FR-008 — onde cada feature do roadmap se encaixa (contracts/navigation.md §2). */
export const FEATURE_SLOTS: readonly FeatureSlot[] = [
  { feature: "001", destination: "plataforma", path: null, label: "Setup do projeto" },
  { feature: "002", destination: "plataforma", path: null, label: "Revisor de PR" },
  {
    feature: "003",
    destination: "mais",
    path: "/mais/ajustes",
    label: "Ajustes · Catálogo do design system (/catalogo, só local/preview)",
  },
  { feature: "004", destination: "plataforma", path: null, label: "Modelo de dados core" },
  { feature: "005", destination: "mais", path: "/mais/exportar", label: "Exportar e backup" },
  { feature: "006", destination: "mais", path: "/mais/seguranca", label: "Conta e segurança" },
  { feature: "007", destination: "mais", path: "/mais/contas", label: "Contas e conexões" },
  {
    feature: "008",
    destination: "mais",
    path: "/mais/contas/sincronizacao",
    label: "Status de sincronização",
  },
  { feature: "009", destination: "mais", path: "/mais/importar", label: "Importar arquivos" },
  { feature: "010", destination: "mais", path: "/mais/importar/pdf", label: "Importar PDF" },
  {
    feature: "011",
    destination: "extrato",
    path: "/extrato/duplicadas",
    label: "Revisar duplicadas",
  },
  { feature: "012", destination: "extrato", path: "/extrato", label: "Extrato" },
  { feature: "013", destination: "extrato", path: null, label: "Filtros e busca (no Extrato)" },
  { feature: "014", destination: "extrato", path: "/extrato/revisar", label: "Revisar categorias" },
  {
    feature: "015",
    destination: "mais",
    path: "/mais/regras",
    label: "Regras de categorização",
  },
  {
    feature: "016",
    destination: "extrato",
    path: null,
    label: "Transferências internas (indicador no item)",
  },
  { feature: "017", destination: "inicio", path: "/", label: "Dashboard" },
  {
    feature: "018",
    destination: "planejamento",
    path: "/planejamento/cartoes",
    label: "Cartões e faturas",
  },
  {
    feature: "019",
    destination: "planejamento",
    path: "/planejamento/parcelamentos",
    label: "Parcelamentos",
  },
  {
    feature: "020",
    destination: "planejamento",
    path: "/planejamento/orcamento",
    label: "Orçamento",
  },
  {
    feature: "021",
    destination: "planejamento",
    path: "/planejamento/recorrencias",
    label: "Assinaturas e recorrências",
  },
  { feature: "022", destination: "inicio", path: "/analises", label: "Análises" },
  { feature: "023", destination: "mais", path: "/mais/alertas", label: "Alertas" },
  {
    feature: "024",
    destination: "mais",
    path: "/notificacoes",
    label: "Notificações (sino no cabeçalho)",
  },
  { feature: "025", destination: "investimentos", path: "/investimentos", label: "Carteira" },
  {
    feature: "026",
    destination: "investimentos",
    path: "/investimentos/planilha",
    label: "Importação da planilha",
  },
  {
    feature: "027",
    destination: "investimentos",
    path: "/investimentos/evolucao",
    label: "Evolução patrimonial",
  },
  { feature: "028", destination: "planejamento", path: "/planejamento/metas", label: "Metas" },
  {
    feature: "029",
    destination: "planejamento",
    path: "/planejamento/projecao",
    label: "Projeção",
  },
  { feature: "030", destination: "inicio", path: "/pergunte", label: "Pergunte às finanças" },
  { feature: "031", destination: "inicio", path: "/diagnostico", label: "Diagnóstico do mês" },
  {
    feature: "032",
    destination: "mais",
    path: "/mais/importar/google",
    label: "Gmail e Drive",
  },
];

export type OutsideShellRoute = { path: string; owner: "001" | "003" | "006"; label: string };

/** Telas sem AppShell (contracts/navigation.md §2.1); "*" = URL inexistente (404 raiz). */
export const OUTSIDE_SHELL_ROUTES: readonly OutsideShellRoute[] = [
  { path: "/entrar", owner: "006", label: "Entrar" },
  { path: "/entrar/codigo", owner: "006", label: "Código de acesso" },
  { path: "/desbloquear", owner: "006", label: "Desbloquear" },
  { path: "/~offline", owner: "001", label: "Sem conexão" },
  { path: "*", owner: "003", label: "Página não encontrada" },
];
