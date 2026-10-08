"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

// Ajuste da 003: sem next-themes (proibido no plan). As cores vêm dos tokens via variáveis CSS,
// que já mudam com data-theme/prefers-color-scheme.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border-strong)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
