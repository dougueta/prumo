# Contrato — Catálogo do Design System

## 1. Rotas e disponibilidade (FR-045, FR-046)

| Rota | Conteúdo |
|---|---|
| `/catalogo` | índice: busca por nome + grupos (Fundamentos, Finanças, Estados, Formulários e ações, Shell, Guia de escrita) |
| `/catalogo/fundamentos/{cores,tipografia,espacamento,icones,movimento}` | tokens renderizados com nome e valor nos dois temas |
| `/catalogo/{slug}` | página de um componente |
| `/catalogo/escrita` | guia de escrita (contracts/components.md §7) |

- Vive em `src/app/(app)/catalogo/` (usa o shell → tema e privacidade alternáveis pelo próprio
  cabeçalho e por controles na página).
- `isCatalogEnabled(appEnv) = appEnv !== "production"`; o `layout.tsx` do catálogo chama
  `notFound()` quando falso; `Mais` só lista o atalho quando habilitado.

## 2. Registro (`src/catalog/registry.ts`)

```ts
type CatalogEntry = {
  slug: string;                 // "money", "transaction-item"…
  name: string;                 // "Valor monetário"
  group: "fundamentos" | "financas" | "estados" | "formularios" | "shell";
  description: string;
  importPath: string;           // "@/components/finance/money"
  whenToUse: string[];
  whenNotToUse: string[];
  a11y: string[];               // comportamento de teclado/leitor de tela
  texts?: Record<string, string>; // textos padrão do componente
  examples: { title: string; render: () => ReactNode; kind?: "do" | "dont" }[];
  states: string[];             // nomes das variantes/estados exibidos (checados no teste)
};
```

Invariantes (teste `tests/unit/catalog-registry.test.ts`):
- todo arquivo exportado em `src/components/{finance,states,forms,shell}/` tem entrada no
  registro (exceto hooks/providers listados em `CATALOG_EXEMPT`);
- toda entrada tem ≥ 1 `whenToUse`, ≥ 1 `whenNotToUse`, ≥ 1 `a11y`, ≥ 1 exemplo `do` e
  ≥ 1 `dont`;
- `slug` único.

## 3. Página de componente

Cabeçalho (nome, descrição, `importPath` copiável) → controles "Tema" e "Ocultar valores"
(os mesmos do shell) → exemplos por variante/estado → "Quando usar" / "Quando não usar" →
"Acessibilidade" → "Textos padrão" → "Certo × errado".

## 4. Dados dos exemplos (Constitution II)

`src/catalog/examples.ts` monta os exemplos a partir de
`generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" })` (gerador da 001),
memoizado no módulo. Proibido escrever valores/descrições de transação à mão no catálogo
(exceção: casos-limite de formatação — `0`, `1`, `-1`, `null`, `100000000000` — que não são
dados de pessoa).
