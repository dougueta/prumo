import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Botão do Prumo (spec 003, contracts/components.md §1). Gerado pelo shadcn e ajustado:
 * hierarquia principal/secundário/discreto/destrutivo (FR-041), alvo de toque ≥ 44px (FR-021)
 * e `pending` (FR-040). No máximo um `primary` por tela/diálogo.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-fast ease-standard outline-none select-none focus-visible:ring-3 focus-visible:ring-focus/40 disabled:pointer-events-none disabled:opacity-60 aria-busy:cursor-progress aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-border-strong bg-surface text-foreground hover:bg-surface-muted aria-expanded:bg-surface-muted",
        ghost: "text-foreground hover:bg-surface-muted aria-expanded:bg-surface-muted",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "min-h-11 px-3 text-sm",
        md: "min-h-11 px-4",
        icon: "min-h-11 min-w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonBaseProps = Omit<React.ComponentProps<"button">, "aria-label"> &
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    asChild?: boolean;
    /** Enviando: desabilita, mostra spinner e anuncia ocupado; ignora cliques repetidos. */
    pending?: boolean;
  };

type ButtonProps = ButtonBaseProps &
  (
    | { size?: "sm" | "md"; "aria-label"?: string }
    // Botão só com ícone exige nome acessível em português (FR-020).
    | { size: "icon"; "aria-label": string }
  );

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (size === "icon" && !props["aria-label"] && !props["aria-labelledby"]) {
    console.error('Button size="icon" precisa de aria-label (FR-020).');
  }
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {pending && <Loader2 data-slot="spinner" aria-hidden="true" className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
