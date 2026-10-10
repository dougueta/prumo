import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PageHeader } from "@/components/shell/page-header";
import { PrivacySwitch } from "@/components/shell/privacy-switch";
import { PrivacyToggle } from "@/components/shell/privacy-toggle";
import { ThemeSelect } from "@/components/shell/theme-select";
import type { CatalogEntry } from "../types";

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground-muted">{children}</p>;
}

export const SHELL: CatalogEntry[] = [
  {
    slug: "app-shell",
    name: "Shell e navegação",
    group: "shell",
    description:
      "Moldura das telas: atalho de conteúdo, menu lateral (≥ 768px), barra inferior (< 768px) e conteúdo com largura máxima. Já aplicada pelo layout (app).",
    importPath: "@/components/shell/app-shell",
    alsoCovers: [
      "@/components/shell/bottom-nav",
      "@/components/shell/side-nav",
      "@/components/shell/skip-link",
    ],
    whenToUse: [
      "Automático para toda rota em src/app/(app)/ — crie a página no lugar previsto em contracts/navigation.md §2.",
    ],
    whenNotToUse: [
      "Telas fora do shell (entrar, desbloquear, sem conexão, 404) — ficam fora de (app).",
      "Nunca crie navegação própria nem um 6º destino.",
    ],
    a11y: [
      "“Pular para o conteúdo” é o primeiro foco.",
      "Navegação “Principal” com aria-current na seção ativa; ícone + rótulo.",
      "Respeita as áreas seguras do aparelho (entalhe/gestos).",
    ],
    texts: { Atalho: "Pular para o conteúdo" },
    states: ["destinos"],
    examples: [
      {
        title: "destinos",
        kind: "do",
        render: () => (
          <Note>
            Início · Extrato · Planejamento · Investimentos · Mais — veja a navegação desta própria
            página (barra inferior no celular, menu lateral no desktop).
          </Note>
        ),
      },
      {
        title: "Errado: navegação dentro da feature",
        kind: "dont",
        note: "Abas ou menus próprios competem com a navegação principal.",
        render: () => <Note>(menu lateral extra criado por uma feature)</Note>,
      },
    ],
  },
  {
    slug: "page-header",
    name: "Cabeçalho da tela",
    group: "shell",
    description:
      "Título (h1), voltar opcional, até 2 ações visíveis (as demais em “Mais ações”) e o botão de ocultar valores.",
    importPath: "@/components/shell/page-header",
    whenToUse: ["Primeira coisa de toda página do shell."],
    whenNotToUse: ["Títulos de seção dentro da página — use h2."],
    a11y: ["“Voltar” e ações só de ícone têm nome acessível; menu navegável por teclado."],
    texts: { Voltar: "Voltar", Menu: "Mais ações" },
    states: ["simples", "com voltar e ações"],
    examples: [
      { title: "simples", kind: "do", render: () => <PageHeader title="Extrato" /> },
      {
        title: "com voltar e ações",
        render: () => (
          <PageHeader
            title="Detalhe"
            back="/catalogo"
            actions={[
              { label: "Adicionar", icon: Plus, href: "/catalogo/page-header" },
              { label: "Editar", icon: Pencil, href: "/catalogo/page-header" },
              { label: "Exportar", icon: Download, href: "/catalogo/page-header" },
              { label: "Excluir", icon: Trash2, href: "/catalogo/page-header" },
            ]}
          />
        ),
      },
      {
        title: "Errado: três ações visíveis",
        kind: "dont",
        note: "A partir da 3ª, as ações vão para “Mais ações”.",
        render: () => <Note>(três ícones lado a lado no cabeçalho)</Note>,
      },
    ],
  },
  {
    slug: "privacy-toggle",
    name: "Ocultar valores (cabeçalho)",
    group: "shell",
    description: "Botão de olho: alterna o modo privacidade em todo o app, na hora.",
    importPath: "@/components/shell/privacy-toggle",
    alsoCovers: ["@/components/shell/privacy-switch"],
    whenToUse: ["Já está em todo PageHeader; nos Ajustes, use PrivacySwitch."],
    whenNotToUse: ["Não crie máscaras próprias: o Money já respeita o modo."],
    a11y: ["aria-pressed + rótulo “Ocultar valores”/“Mostrar valores”."],
    texts: { Ligar: "Ocultar valores", Desligar: "Mostrar valores" },
    states: ["botão", "alternância"],
    examples: [
      { title: "botão", kind: "do", render: () => <PrivacyToggle /> },
      { title: "alternância", render: () => <PrivacySwitch /> },
      {
        title: "Errado: esconder valores com CSS próprio",
        kind: "dont",
        note: "O leitor de tela continuaria lendo o valor.",
        render: () => <Note>(blur aplicado no número)</Note>,
      },
    ],
  },
  {
    slug: "theme-select",
    name: "Tema",
    group: "shell",
    description:
      "Automático (segue o sistema), Claro ou Escuro; aplicado na hora e lembrado no aparelho.",
    importPath: "@/components/shell/theme-select",
    whenToUse: ["Ajustes e catálogo."],
    whenNotToUse: ["Nunca use dark: nas telas — o tema vem dos tokens."],
    a11y: ["Grupo de rádios “Tema” com rótulos em texto."],
    states: ["opções"],
    examples: [
      { title: "opções", kind: "do", render: () => <ThemeSelect /> },
      {
        title: "Errado: cor fixa na tela",
        kind: "dont",
        note: "Cores literais quebram o tema escuro e o contraste.",
        render: () => <Note>(cor literal escrita direto numa tela)</Note>,
      },
    ],
  },
  {
    slug: "offline-banner",
    name: "Aviso offline",
    group: "shell",
    description: "Aparece no shell quando o aparelho perde conexão e some sozinho ao reconectar.",
    importPath: "@/components/shell/offline-banner",
    alsoCovers: ["@/components/shell/use-online"],
    whenToUse: ["Já está no shell; telas não precisam fazer nada."],
    whenNotToUse: ["Para avisar que uma ação falhou offline — use runOnline/notify."],
    a11y: ["Região viva (role=status) anuncia a mudança."],
    texts: { Offline: "Você está offline. Algumas ações não vão funcionar até a conexão voltar." },
    states: ["offline"],
    examples: [
      {
        title: "offline",
        kind: "do",
        render: () => (
          <p className="rounded-md bg-warning-subtle px-4 py-2 text-sm text-warning">
            Você está offline. Algumas ações não vão funcionar até a conexão voltar.
          </p>
        ),
      },
      {
        title: "Errado: bloquear a tela inteira",
        kind: "dont",
        note: "Os dados já carregados continuam úteis offline.",
        render: () => <Note>(tela cheia “Sem internet”)</Note>,
      },
    ],
  },
  {
    slug: "demo-badge",
    name: "Selo de demonstração e indicador de ambiente",
    group: "shell",
    description:
      "Selo “Demonstração — dados fictícios” em pré-visualizações e chip “Local” no ambiente local. Ficam no root layout, acima de tudo.",
    importPath: "@/components/shell/demo-badge",
    alsoCovers: ["@/components/shell/env-indicator"],
    whenToUse: ["Automáticos — nenhuma tela precisa incluir."],
    whenNotToUse: ["Nunca esconda, cubra ou reproduza o selo."],
    a11y: ["Selo com role=status; ficam acima de diálogos (z-demo)."],
    texts: { Selo: "Demonstração — dados fictícios", Ambiente: "Local" },
    states: ["onde aparecem"],
    examples: [
      {
        title: "onde aparecem",
        kind: "do",
        render: () => (
          <Note>
            Em preview, o selo fica fixo no topo de todas as telas; em local, o chip “Local” fica no
            canto. Em produção, nenhum dos dois.
          </Note>
        ),
      },
      {
        title: "Errado: diálogo cobrindo o selo",
        kind: "dont",
        note: "Uma demonstração não pode parecer produção.",
        render: () => <Note>(overlay com z-index acima do selo)</Note>,
      },
    ],
  },
  {
    slug: "logo",
    name: "Logotipo",
    group: "shell",
    description: "Fio de prumo + “Prumo”. A cor vem do contexto (text-primary).",
    importPath: "@/components/brand/logo",
    whenToUse: ["Menu lateral, cabeçalho no celular, telas fora do shell."],
    whenNotToUse: ["Não recrie o símbolo em imagens próprias."],
    a11y: ["role=img com nome “Prumo”; o nome visível não é lido duas vezes."],
    states: ["completo", "símbolo"],
    examples: [
      { title: "completo", kind: "do", render: () => <Logo className="text-primary" /> },
      { title: "símbolo", render: () => <Logo variant="symbol" className="text-primary" /> },
      {
        title: "Errado: logotipo em cor fora da paleta",
        kind: "dont",
        note: "Use sempre um token (text-primary, text-foreground).",
        render: () => <Note>(logo em vermelho)</Note>,
      },
    ],
  },
];
