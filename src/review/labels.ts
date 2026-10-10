// Feature 002 · data-model §5 — rótulos e marcos desejados (FR-022) e o diff com o existente.

export interface LabelSpec {
  name: string;
  color: string;
  description: string;
}

export const INITIATIVES = [
  "Plataforma",
  "Autenticação",
  "Contas e conexões",
  "Extrato",
  "Visão geral",
  "Cartões",
  "Orçamento",
  "Comportamento",
  "Investimentos",
  "Planejamento",
  "Inteligência",
] as const;

export const DESIRED_LABELS: LabelSpec[] = [
  {
    name: "autor:claude",
    color: "D97757",
    description: "PR escrito pelo Claude — revisor: Gemini",
  },
  {
    name: "autor:gemini",
    color: "4285F4",
    description: "PR escrito pelo Gemini — revisor: Claude",
  },
  { name: "autor:doug", color: "6E7781", description: "PR escrito pelo Doug — revisor: Gemini" },
  {
    name: "emergencia",
    color: "B60205",
    description:
      "Correção urgente de produção (só o Doug aplica) — revisão pós-merge em até 7 dias",
  },
  { name: "violacao-main", color: "000000", description: "Commit na main fora do fluxo protegido" },
  ...INITIATIVES.map((name, i) => ({
    name: `iniciativa:${i}`,
    color: "C5DEF5",
    description: `Iniciativa ${i} · ${name}`,
  })),
];

export const DESIRED_MILESTONES: string[] = INITIATIVES.map((name, i) => `${i} · ${name}`);

/** Cria os faltantes e atualiza cor/descrição divergentes; nunca apaga. */
export function planLabels(
  existing: LabelSpec[],
  desired: LabelSpec[],
): { create: LabelSpec[]; update: LabelSpec[] } {
  const byName = new Map(existing.map((l) => [l.name, l]));
  const create: LabelSpec[] = [];
  const update: LabelSpec[] = [];
  for (const d of desired) {
    const e = byName.get(d.name);
    if (!e) create.push(d);
    else if (
      e.color.toUpperCase() !== d.color.toUpperCase() ||
      (e.description ?? "") !== d.description
    ) {
      update.push(d);
    }
  }
  return { create, update };
}

/** Marcos faltantes (títulos); nunca apaga. */
export function planMilestones(existing: string[], desired: string[]): string[] {
  const have = new Set(existing);
  return desired.filter((t) => !have.has(t));
}
