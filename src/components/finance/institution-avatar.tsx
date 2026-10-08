import { cn } from "@/lib/utils";

const IGNORED = new Set(["banco", "de", "do", "da", "dos", "das", "e"]);

/** Iniciais de instituição sem ícone (data-model §5): "Banco do Horizonte Digital" → "HD". */
export function institutionInitials(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((word) => word && !IGNORED.has(word.toLowerCase()));
  if (words.length === 0) return "?";
  const initials =
    words.length >= 2
      ? `${[...words[0]][0]}${[...words[1]][0]}`
      : [...words[0]].slice(0, 2).join("");
  return initials.toLocaleUpperCase("pt-BR");
}

/** Avatar de instituição: ícone próprio quando houver; senão iniciais em círculo neutro (FR-036). */
export function InstitutionAvatar({
  name,
  icon,
  size = "md",
}: {
  name: string;
  /** Caminho de ícone servido pelo próprio app (nunca de terceiros). */
  icon?: string;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "size-10 text-sm" : "size-8 text-xs";
  if (icon) {
    // eslint-disable-next-line @next/next/no-img-element -- ícone local pequeno, sem otimização
    return <img src={icon} alt="" aria-hidden="true" className={cn("rounded-full", box)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-cat-cinza-subtle font-semibold text-cat-cinza",
        box,
      )}
    >
      {institutionInitials(name)}
    </span>
  );
}
