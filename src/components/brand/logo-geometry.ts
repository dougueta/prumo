/**
 * Geometria do símbolo do Prumo — o fio de prumo: fio vertical + peso em gota (FR-006).
 * Compartilhada pelo componente <Logo> e pelo gerador de ícones da PWA
 * (scripts/generate-icons.mjs). Só sintaxe TS apagável: o Node 24 importa este arquivo direto.
 */
export const LOGO_VIEWBOX = 24;

export type PlumbGeometry = {
  line: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number };
  /** Caminho SVG do peso (gota). */
  bob: string;
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** `size` = lado do quadrado; `padding` = margem relativa (0–0.5), maior em ícones maskable. */
export function plumbGeometry(size: number, padding: number): PlumbGeometry {
  const s = size * (1 - padding * 2);
  const o = size * padding;
  const cx = size / 2;
  const r = s * 0.17;
  return {
    line: {
      x1: round(cx),
      y1: round(o + s * 0.14),
      x2: round(cx),
      y2: round(o + s * 0.52),
      strokeWidth: round(s * 0.05),
    },
    bob: [
      `M ${round(cx)} ${round(o + s * 0.5)}`,
      `L ${round(cx + r)} ${round(o + s * 0.7)}`,
      `A ${round(r)} ${round(r)} 0 1 1 ${round(cx - r)} ${round(o + s * 0.7)}`,
      "Z",
    ].join(" "),
  };
}
