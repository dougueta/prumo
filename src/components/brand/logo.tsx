import { cn } from "@/lib/utils";
import { LOGO_VIEWBOX, plumbGeometry } from "./logo-geometry";

const geometry = plumbGeometry(LOGO_VIEWBOX, 0);

/**
 * Logotipo do Prumo (FR-006): símbolo do fio de prumo + nome. A cor vem do contexto
 * (`currentColor`), então segue o token aplicado por quem usa (ex.: `text-primary`).
 */
export function Logo({
  variant = "full",
  className,
}: {
  variant?: "full" | "symbol";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        role="img"
        aria-label="Prumo"
        viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
        className="size-6 shrink-0"
      >
        <line
          x1={geometry.line.x1}
          y1={geometry.line.y1}
          x2={geometry.line.x2}
          y2={geometry.line.y2}
          stroke="currentColor"
          strokeWidth={geometry.line.strokeWidth}
          strokeLinecap="round"
        />
        <path d={geometry.bob} fill="currentColor" />
      </svg>
      {variant === "full" && (
        <span aria-hidden="true" className="text-lg font-semibold tracking-tight">
          Prumo
        </span>
      )}
    </span>
  );
}
