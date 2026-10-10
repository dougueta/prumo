import { Button } from "@/components/ui/button";
import { ConfirmDialogDemo, FieldDemo, FormDemo, NotifyDemo, ResponsiveDialogDemo } from "../demos";
import { catalogDataset, pick } from "../examples";
import type { CatalogEntry } from "../types";

const accountOptions = () =>
  catalogDataset()
    .accounts.slice(0, 5)
    .map((account) => ({ value: account.id, label: account.name }));

const manyOptions = () => {
  const seen = new Set<string>();
  return catalogDataset()
    .transactions.filter((t) => !seen.has(t.description) && seen.add(t.description))
    .slice(0, 12)
    .map((t) => ({ value: t.id, label: t.description }));
};

export const FORMULARIOS: CatalogEntry[] = [
  {
    slug: "form-field",
    name: "Formulário e campo de texto",
    group: "formularios",
    description:
      "Form (envio protegido contra offline), FormField (rótulo, ajuda e erro junto ao campo) e TextField. Use com useAppForm(schema, defaults).",
    importPath: "@/components/forms/form-field",
    alsoCovers: ["@/components/forms/use-app-form", "@/components/forms/run-online"],
    whenToUse: ["Todo formulário do app."],
    whenNotToUse: ["Ações de um toque (use Button)."],
    a11y: [
      "Valida ao sair do campo e ao enviar; o foco vai ao primeiro campo com erro.",
      "Erro ligado ao campo por aria-describedby e anunciado (role=alert).",
      "Sem conexão, nada é enviado e o usuário é avisado.",
    ],
    texts: { Offline: "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar." },
    states: ["formulário completo", "campo de texto"],
    examples: [
      { title: "formulário completo", kind: "do", render: () => <FormDemo /> },
      { title: "campo de texto", render: () => <FieldDemo field="text" /> },
      {
        title: "Errado: placeholder no lugar do rótulo",
        kind: "dont",
        note: "O placeholder some ao digitar e não é rótulo acessível.",
        render: () => (
          <input
            aria-label="Exemplo errado"
            placeholder="Descrição"
            className="min-h-11 rounded-md border border-border-strong bg-surface px-3"
          />
        ),
      },
    ],
  },
  {
    slug: "money-input",
    name: "Campo de valor",
    group: "formularios",
    description:
      "Digitação pt-BR (1234,5 ou 1.234,50), teclado numérico, formata ao sair e entrega centavos exatos com o sinal da direção.",
    importPath: "@/components/forms/money-input",
    whenToUse: ["Qualquer valor digitado pelo usuário."],
    whenNotToUse: ["Para exibir valores — use Valor monetário."],
    a11y: [
      "Rótulo visível; erros em português junto ao campo; Entrada/Saída é um grupo de rádios.",
    ],
    texts: {
      "Valor inválido": "Informe um valor.",
      "Casas decimais": "Use no máximo 2 casas decimais.",
      Sinal: "Use o seletor Entrada/Saída para o sinal.",
      "Muito alto": "Valor muito alto.",
    },
    states: ["saída", "entrada", "escolher"],
    examples: [
      { title: "saída", kind: "do", render: () => <FieldDemo field="money-expense" /> },
      { title: "entrada", render: () => <FieldDemo field="money-income" /> },
      { title: "escolher", render: () => <FieldDemo field="money-choose" /> },
      {
        title: "Errado: sinal digitado no campo",
        kind: "dont",
        note: "“-45,90” é recusado: o sinal vem do seletor Entrada/Saída.",
        render: () => <span>-45,90</span>,
      },
    ],
  },
  {
    slug: "date-input",
    name: "Campo de data",
    group: "formularios",
    description: "Data nativa do aparelho com atalhos “Hoje” e “Ontem” (fuso de São Paulo).",
    importPath: "@/components/forms/date-input",
    whenToUse: ["Data de transação, vencimento, início de meta."],
    whenNotToUse: ["Períodos com início e fim — use dois campos ou um filtro de período."],
    a11y: ["Campo nativo (teclado e leitor do sistema); atalhos são botões com texto."],
    states: ["com atalhos"],
    examples: [
      { title: "com atalhos", kind: "do", render: () => <FieldDemo field="date" /> },
      {
        title: "Errado: data em texto livre",
        kind: "dont",
        note: "Texto livre gera datas inválidas e formatos mistos.",
        render: () => <span>“28 de set”</span>,
      },
    ],
  },
  {
    slug: "select-field",
    name: "Seleção",
    group: "formularios",
    description:
      "Até 7 opções: seleção nativa. Mais de 7: lista com busca (painel inferior no celular, diálogo no desktop).",
    importPath: "@/components/forms/select-field",
    whenToUse: ["Categoria, conta, cartão e outras escolhas de uma lista."],
    whenNotToUse: ["Duas ou três opções sempre visíveis — use rádios."],
    a11y: ["Lista longa: campo de busca e rádios nativos, navegáveis por teclado."],
    states: ["até 7 opções", "mais de 7 opções"],
    examples: [
      {
        title: "até 7 opções",
        kind: "do",
        render: () => <FieldDemo field="select" options={accountOptions()} />,
      },
      {
        title: "mais de 7 opções",
        render: () => <FieldDemo field="select" options={manyOptions()} />,
      },
      {
        title: "Errado: lista enorme sem busca",
        kind: "dont",
        note: "Mais de 7 opções num select nativo obriga a rolar e adivinhar.",
        render: () => <span className="text-foreground-muted">(select com 30 itens)</span>,
      },
    ],
  },
  {
    slug: "switch-field",
    name: "Alternância",
    group: "formularios",
    description: "Liga/desliga com efeito imediato, rótulo clicável.",
    importPath: "@/components/forms/switch-field",
    whenToUse: ["Preferências de liga/desliga."],
    whenNotToUse: ["Escolha que só vale ao enviar um formulário longo — prefira caixa de seleção."],
    a11y: ["role=switch com estado anunciado; o rótulo também alterna."],
    states: ["desligado"],
    examples: [
      { title: "desligado", kind: "do", render: () => <FieldDemo field="switch" /> },
      {
        title: "Errado: alternância sem rótulo",
        kind: "dont",
        note: "Ninguém sabe o que ela liga.",
        render: () => <span className="text-foreground-muted">( ◯ )</span>,
      },
    ],
  },
  {
    slug: "textarea-field",
    name: "Área de texto",
    group: "formularios",
    description: "Texto longo com contador; avisa quantos caracteres restam perto do limite.",
    importPath: "@/components/forms/textarea-field",
    whenToUse: ["Observações, notas."],
    whenNotToUse: ["Uma linha curta — use o campo de texto."],
    a11y: ["Restante anunciado ao se aproximar do limite."],
    states: ["com limite"],
    examples: [
      { title: "com limite", kind: "do", render: () => <FieldDemo field="textarea" /> },
      {
        title: "Errado: cortar o texto sem avisar",
        kind: "dont",
        note: "Mostre o limite antes de atingi-lo.",
        render: () => <span className="text-foreground-muted">(texto cortado)</span>,
      },
    ],
  },
  {
    slug: "submit-button",
    name: "Botões",
    group: "formularios",
    description:
      "Hierarquia: principal (no máximo 1 por tela/diálogo), secundário, discreto e destrutivo. SubmitButton fica “enviando” e ignora toques repetidos.",
    importPath: "@/components/forms/submit-button",
    whenToUse: ["Toda ação; SubmitButton no envio de formulários."],
    whenNotToUse: ["Navegação para outra tela — use link."],
    a11y: ["Alvo de toque ≥ 44×44; botão só de ícone exige aria-label; enviando = aria-busy."],
    states: ["principal", "secundário", "discreto", "destrutivo", "enviando"],
    examples: [
      { title: "principal", kind: "do", render: () => <Button>Salvar</Button> },
      { title: "secundário", render: () => <Button variant="secondary">Cancelar</Button> },
      { title: "discreto", render: () => <Button variant="ghost">Ver detalhes</Button> },
      { title: "destrutivo", render: () => <Button variant="destructive">Excluir</Button> },
      { title: "enviando", render: () => <Button pending>Salvando</Button> },
      {
        title: "Errado: dois botões principais",
        kind: "dont",
        note: "Só uma ação principal por tela ou diálogo.",
        render: () => (
          <div className="flex gap-2">
            <Button>Salvar</Button>
            <Button>Exportar</Button>
          </div>
        ),
      },
    ],
  },
  {
    slug: "confirm-dialog",
    name: "Confirmação destrutiva",
    group: "formularios",
    description:
      "Pergunta nomeando ação e objeto; “Cancelar” recebe o foco; não fecha tocando fora.",
    importPath: "@/components/forms/confirm-dialog",
    whenToUse: ["Ações destrutivas e irreversíveis."],
    whenNotToUse: ["Ações reversíveis — prefira aviso com “Desfazer”."],
    a11y: ["alertdialog com foco preso; Esc e gesto de voltar fecham e devolvem o foco ao botão."],
    texts: {
      Título: "Excluir {objeto} '{nome}'?",
      Descrição: "Esta ação não pode ser desfeita.",
      Botões: "Excluir / Cancelar",
    },
    states: ["destrutivo"],
    examples: [
      {
        title: "destrutivo",
        kind: "do",
        render: () => <ConfirmDialogDemo objectName={pick((t) => t.amountCents < 0).description} />,
      },
      {
        title: "Errado: “Tem certeza?”",
        kind: "dont",
        note: "A pergunta precisa dizer o que será excluído.",
        render: () => <span>Tem certeza?</span>,
      },
    ],
  },
  {
    slug: "responsive-dialog",
    name: "Diálogo responsivo",
    group: "formularios",
    description: "Painel inferior no celular e diálogo central no desktop.",
    importPath: "@/components/forms/responsive-dialog",
    whenToUse: ["Filtros, formulários curtos, listas de escolha."],
    whenNotToUse: ["Confirmações destrutivas — use ConfirmDialog."],
    a11y: ["Título obrigatório; foco preso; Esc, toque fora e gesto de voltar fecham."],
    states: ["padrão"],
    examples: [
      { title: "padrão", kind: "do", render: () => <ResponsiveDialogDemo /> },
      {
        title: "Errado: diálogo sem título",
        kind: "dont",
        note: "O leitor de tela não sabe do que se trata.",
        render: () => <span className="text-foreground-muted">(diálogo sem título)</span>,
      },
    ],
  },
  {
    slug: "notify",
    name: "Aviso temporário",
    group: "formularios",
    description: "notify.success/error/info (≥ 5 s) e notify.undo (fica até ser dispensado).",
    importPath: "@/components/forms/notify",
    whenToUse: ["Confirmar uma ação concluída; oferecer “Desfazer” em ações reversíveis."],
    whenNotToUse: [
      "Erros de campo (ficam junto ao campo).",
      "Informação que precisa ficar na tela.",
    ],
    a11y: ["Anunciado ao leitor de tela; não cobre a navegação."],
    texts: { Desfazer: "{Objeto} excluído. · Desfazer" },
    states: ["tipos"],
    examples: [
      { title: "tipos", kind: "do", render: () => <NotifyDemo /> },
      {
        title: "Errado: aviso para erro de validação",
        kind: "dont",
        note: "O erro some e o usuário não sabe qual campo corrigir.",
        render: () => <span className="text-foreground-muted">“Campo inválido!”</span>,
      },
    ],
  },
];
