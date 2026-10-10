import { ComingSoon } from "@/components/shell/coming-soon";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import {
  ErrorStateDemo,
  NoResultsDemo,
  PartialErrorDemo,
  SlowLoadingDemo,
  SummaryCardDemo,
} from "../demos";
import { pick } from "../examples";
import type { CatalogEntry } from "../types";

export const ESTADOS: CatalogEntry[] = [
  {
    slug: "empty-state",
    name: "Estado vazio",
    group: "estados",
    description:
      "Lista sem itens ou filtro sem resultado — textos distintos, com ação quando fizer sentido.",
    importPath: "@/components/states/empty-state",
    whenToUse: [
      "Lista ou tela sem conteúdo ainda.",
      'Filtro/busca sem resultado (variant="no-results").',
    ],
    whenNotToUse: ["Enquanto carrega — use LoadingSkeleton.", "Quando deu erro — use ErrorState."],
    a11y: ["Título em cabeçalho; ação é botão ou link com texto."],
    texts: {
      "Lista vazia": "Nada por aqui ainda.",
      "Filtro sem resultado": "Nenhum resultado para este filtro.",
      Ação: "Limpar filtros",
    },
    states: ["vazio", "sem resultados"],
    examples: [
      {
        title: "vazio",
        kind: "do",
        render: () => (
          <EmptyState
            title="Nenhuma transação ainda"
            description="Conecte uma conta ou importe um arquivo para começar."
            action={{ label: "Ir para Mais", href: "/mais" }}
          />
        ),
      },
      { title: "sem resultados", render: () => <NoResultsDemo /> },
      {
        title: "Errado: “R$ 0,00” no lugar de lista vazia",
        kind: "dont",
        note: "Zero não é ausência de dados.",
        render: () => <span>R$ 0,00</span>,
      },
    ],
  },
  {
    slug: "loading-skeleton",
    name: "Carregando (esqueleto)",
    group: "estados",
    description: "Esqueleto no formato do conteúdo final, sem “pulos” quando o conteúdo chega.",
    importPath: "@/components/states/loading-skeleton",
    whenToUse: ["Qualquer bloco que espera dados."],
    whenNotToUse: ["Spinner solto no meio da tela.", "Mais de 10 s — combine com SlowLoading."],
    a11y: ["Contêiner com aria-busy e texto “Carregando…” para leitor de tela."],
    texts: { Leitor: "Carregando…" },
    states: ["lista", "card", "página", "texto"],
    examples: [
      { title: "lista", kind: "do", render: () => <LoadingSkeleton variant="list" rows={3} /> },
      { title: "card", render: () => <LoadingSkeleton variant="card" /> },
      { title: "página", render: () => <LoadingSkeleton variant="page" /> },
      { title: "texto", render: () => <LoadingSkeleton variant="text" rows={2} /> },
      {
        title: "Errado: estado vazio enquanto carrega",
        kind: "dont",
        note: "Mostrar “Nada por aqui” antes da resposta engana o usuário.",
        render: () => <EmptyState />,
      },
    ],
  },
  {
    slug: "slow-loading",
    name: "Carregamento demorado",
    group: "estados",
    description: "Após 10 s, troca o esqueleto por uma mensagem de demora com nova tentativa.",
    importPath: "@/components/states/slow-loading",
    whenToUse: ["Em volta do esqueleto de qualquer carregamento que pode demorar."],
    whenNotToUse: ["Para erros — use ErrorState."],
    a11y: ["A mensagem é anunciada (role=status)."],
    texts: { Demora: "Está demorando mais que o normal.", Botão: "Tentar novamente" },
    states: ["demorando (3 s neste exemplo)"],
    examples: [
      { title: "demorando (3 s neste exemplo)", kind: "do", render: () => <SlowLoadingDemo /> },
      {
        title: "Errado: carregar para sempre",
        kind: "dont",
        note: "Nunca deixe o esqueleto indefinidamente.",
        render: () => <LoadingSkeleton variant="text" rows={1} />,
      },
    ],
  },
  {
    slug: "error-state",
    name: "Erro",
    group: "estados",
    description:
      "Mensagem em português, sem detalhe técnico, com “Tentar novamente”; em bloco (erro parcial) ou página.",
    importPath: "@/components/states/error-state",
    whenToUse: ["Falha ao obter conteúdo de um bloco ou de uma página."],
    whenNotToUse: [
      "Validação de formulário — o erro fica junto ao campo.",
      "Nunca mostre códigos ou mensagens técnicas.",
    ],
    a11y: [
      "Em bloco, é anunciado (role=alert) e só o bloco afetado muda; o resto continua utilizável.",
    ],
    texts: {
      Título: "Não foi possível carregar.",
      Descrição: "Verifique sua conexão e tente de novo.",
      Botão: "Tentar novamente",
    },
    states: ["bloco", "página", "erro parcial"],
    examples: [
      { title: "bloco", kind: "do", render: () => <ErrorStateDemo scope="block" /> },
      { title: "página", render: () => <ErrorStateDemo scope="page" /> },
      {
        title: "erro parcial",
        render: () => (
          <PartialErrorDemo>
            <SummaryCardDemo title="Saldo" cents={pick((t) => t.amountCents > 0).amountCents} />
          </PartialErrorDemo>
        ),
      },
      {
        title: "Errado: detalhe técnico",
        kind: "dont",
        note: "Mensagens internas podem expor dados e não ajudam o usuário.",
        render: () => <ErrorState title="Erro 500" description="TypeError: fetch failed" />,
      },
    ],
  },
  {
    slug: "coming-soon",
    name: "Em breve",
    group: "estados",
    description: "Tela padrão de seção cuja feature ainda não existe.",
    importPath: "@/components/shell/coming-soon",
    whenToUse: ["Destino da navegação ainda sem feature."],
    whenNotToUse: ["Funcionalidade quebrada — corrija ou esconda."],
    a11y: ["“Em breve” é um cabeçalho de seção; o título da tela fica no PageHeader."],
    texts: { Título: "Em breve", Texto: "Esta seção chega numa próxima versão do Prumo." },
    states: ["padrão"],
    examples: [
      { title: "padrão", kind: "do", render: () => <ComingSoon title="Exemplo" /> },
      {
        title: "Errado: página em branco",
        kind: "dont",
        note: "Tela vazia parece erro.",
        render: () => <div className="h-12 rounded-md border border-dashed border-border" />,
      },
    ],
  },
];
