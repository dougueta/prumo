/** Páginas de fundamentos do catálogo (contracts/catalog.md §1). */
export const FOUNDATIONS = [
  { topic: "cores", name: "Cores", description: "Tokens de cor com nome, valor e contraste." },
  { topic: "tipografia", name: "Tipografia", description: "Inter, escala de 7 tamanhos e pesos." },
  {
    topic: "espacamento",
    name: "Espaçamento e raios",
    description: "Escala de espaços, raios e sombras.",
  },
  { topic: "icones", name: "Ícones", description: "Ícones de interface e o mapa de categorias." },
  {
    topic: "movimento",
    name: "Movimento e camadas",
    description: "Durações, curva e camadas (z).",
  },
] as const;

export type FoundationTopic = (typeof FOUNDATIONS)[number]["topic"];
