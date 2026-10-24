import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Guia de escrita · Catálogo · Prumo" };

// contracts/components.md §7 — textos oficiais para reutilizar (FR-048).
const TEXTS: [situation: string, texts: string[]][] = [
  [
    "Erro genérico (bloco)",
    ["Não foi possível carregar.", "Verifique sua conexão e tente de novo."],
  ],
  ["Botão de nova tentativa", ["Tentar novamente"]],
  ["Lista vazia (genérico)", ["Nada por aqui ainda."]],
  ["Filtro sem resultado", ["Nenhum resultado para este filtro.", "Limpar filtros"]],
  ["Demora", ["Está demorando mais que o normal."]],
  ["Offline", ["Você está offline. Algumas ações não vão funcionar até a conexão voltar."]],
  ["Ação offline", ["Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar."]],
  [
    "Confirmação destrutiva",
    ["Excluir {objeto} '{nome}'?", "Esta ação não pode ser desfeita.", "Excluir", "Cancelar"],
  ],
  ["Desfazer", ["{Objeto} excluído.", "Desfazer"]],
  ["Em breve", ["Em breve", "Esta seção chega numa próxima versão do Prumo."]],
  [
    "Página inexistente",
    ["Página não encontrada", "O endereço pode ter mudado.", "Voltar ao início"],
  ],
  [
    "Erro inesperado (raiz)",
    ["Algo deu errado.", "Tente de novo em instantes.", "Tentar novamente"],
  ],
  ["Valor oculto (leitor de tela)", ["valor oculto"]],
  ["Valor ausente (leitor de tela)", ["valor indisponível"]],
];

const TERMS: [use: string, avoid: string][] = [
  ["entrada", "crédito (para movimentação)"],
  ["saída", "débito (para movimentação)"],
  ["transação", "lançamento, movimento"],
  ["conta", "carteira digital (quando for conta)"],
  ["cartão", "plástico"],
  ["fatura", "conta do cartão"],
  ["categoria", "tag, rótulo"],
  ["saldo", "balanço"],
];

/** /catalogo/escrita — tom de voz, termos e textos padrão (FR-048). */
export default function WritingGuidePage() {
  return (
    <>
      <PageHeader title="Guia de escrita" back="/catalogo" />
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Tom de voz</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Direto e calmo, em segunda pessoa (“você”).</li>
            <li>Sem exclamação, sem alarme, sem jargão técnico.</li>
            <li>Erro diz o que aconteceu e o que fazer — nunca códigos ou detalhes internos.</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Termos padronizados</h2>
          <div
            role="region"
            aria-label="Tabela de termos (rolável)"
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-border"
          >
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Use
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Evite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {TERMS.map(([use, avoid]) => (
                  <tr key={use}>
                    <td className="px-3 py-2 font-medium">{use}</td>
                    <td className="px-3 py-2 text-foreground-muted">{avoid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Textos padrão</h2>
          <dl className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {TEXTS.map(([situation, texts]) => (
              <div key={situation} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                <dt className="text-sm font-medium text-foreground-muted sm:w-56 sm:shrink-0">
                  {situation}
                </dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-1">
                  {texts.map((text) => (
                    <span key={text} className="rounded-sm bg-surface-muted px-1.5">
                      {text}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
