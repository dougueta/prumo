import {
  ArrowLeftRight,
  Baby,
  Briefcase,
  Car,
  ChartLine,
  CircleHelp,
  Coins,
  CreditCard,
  Ellipsis,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  TrendingUp,
  Undo2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_VISUALS, type CategoryColor, type CategoryVisualKey } from "./category-visuals";

const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Baby,
  Briefcase,
  Car,
  ChartLine,
  CircleHelp,
  Coins,
  CreditCard,
  Ellipsis,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  TrendingUp,
  Undo2,
  UtensilsCrossed,
};

// Classes completas: o Tailwind só gera classes escritas por extenso.
const COLORS: Record<CategoryColor, string> = {
  petroleo: "bg-cat-petroleo-subtle text-cat-petroleo",
  azul: "bg-cat-azul-subtle text-cat-azul",
  verde: "bg-cat-verde-subtle text-cat-verde",
  oliva: "bg-cat-oliva-subtle text-cat-oliva",
  ambar: "bg-cat-ambar-subtle text-cat-ambar",
  terracota: "bg-cat-terracota-subtle text-cat-terracota",
  rosa: "bg-cat-rosa-subtle text-cat-rosa",
  violeta: "bg-cat-violeta-subtle text-cat-violeta",
  cinza: "bg-cat-cinza-subtle text-cat-cinza",
};

/**
 * Ícone de categoria em círculo: cor e ícone só do mapa fixo (FR-036). Decorativo — o nome da
 * categoria aparece ao lado, então a informação nunca depende só da cor.
 */
export function CategoryIcon({
  visual,
  size = "md",
}: {
  visual: CategoryVisualKey;
  size?: "sm" | "md";
}) {
  const { icon, color } = CATEGORY_VISUALS[visual];
  const Icon = ICONS[icon] ?? Tag;
  return (
    <span
      data-slot="category-icon"
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-10" : "size-8",
        COLORS[color],
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}
