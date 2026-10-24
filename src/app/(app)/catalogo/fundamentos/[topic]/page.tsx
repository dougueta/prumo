import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/finance/category-icon";
import { CATEGORY_VISUALS, type CategoryVisualKey } from "@/components/finance/category-visuals";
import { FOUNDATIONS } from "@/catalog/foundations";
import { PageHeader } from "@/components/shell/page-header";
import { COLOR_TOKENS } from "@/styles/tokens";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): string {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2).replace(".", ",");
}

function Cores() {
  const [bgLight, bgDark] = COLOR_TOKENS.background;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-foreground-muted">
        Contraste calculado contra o fundo da página (--background) de cada tema. Texto precisa de
        4,5:1; foco e bordas de controles, 3:1. Cores fora desta lista não passam no lint.
      </p>
      <div
        role="region"
        aria-label="Tabela de tokens de cor (rolável)"
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Tokens de cor</caption>
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="px-3 py-2">
                Token
              </th>
              <th scope="col" className="px-3 py-2">
                Amostra
              </th>
              <th scope="col" className="px-3 py-2">
                Claro
              </th>
              <th scope="col" className="px-3 py-2">
                Escuro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {Object.entries(COLOR_TOKENS).map(([name, [light, dark]]) => (
              <tr key={name}>
                <th scope="row" className="px-3 py-2 font-mono font-normal">
                  --{name}
                </th>
                <td className="px-3 py-2">
                  <span
                    aria-hidden="true"
                    className="block size-8 rounded-md border border-border-strong"
                    style={{ background: `var(--${name})` }}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {light} · {contrast(light, bgLight)}:1
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {dark} · {contrast(dark, bgDark)}:1
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SIZES = [
  ["text-xs", "12/16 px", "text-xs"],
  ["text-sm", "14/20 px", "text-sm"],
  ["text-base", "16/24 px", "text-base"],
  ["text-lg", "18/28 px", "text-lg"],
  ["text-xl", "20/28 px", "text-xl"],
  ["text-2xl", "24/32 px", "text-2xl"],
  ["text-3xl", "30/36 px", "text-3xl"],
] as const;

function Tipografia() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-foreground-muted">
        Inter (auto-hospedada). Pesos 400, 500 e 600 — sem negrito pesado. Valores sempre com
        algarismos tabulares.
      </p>
      {SIZES.map(([name, size, cls]) => (
        <div key={name} className="flex flex-wrap items-baseline gap-x-4">
          <span className="w-28 font-mono text-sm text-foreground-muted">{name}</span>
          <span className="w-20 text-sm text-foreground-muted">{size}</span>
          <span className={cls}>Suas finanças no prumo</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <span className="font-normal">Normal 400</span>
        <span className="font-medium">Médio 500</span>
        <span className="font-semibold">Seminegrito 600</span>
        <span className="tabular-nums">1.111,11 · 8.888,88</span>
      </div>
    </div>
  );
}

const SPACES = [
  ["1", "4 px", "w-1"],
  ["2", "8 px", "w-2"],
  ["3", "12 px", "w-3"],
  ["4", "16 px", "w-4"],
  ["6", "24 px", "w-6"],
  ["8", "32 px", "w-8"],
  ["12", "48 px", "w-12"],
] as const;

const RADII = [
  ["rounded-sm", "6 px"],
  ["rounded-md", "10 px (botões, campos)"],
  ["rounded-lg", "14 px (cards)"],
  ["rounded-xl", "20 px"],
  ["rounded-full", "círculo"],
] as const;

function Espacamento() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Espaços recomendados</h2>
        {SPACES.map(([name, px, cls]) => (
          <div key={name} className="flex items-center gap-4">
            <span className="w-24 font-mono text-sm">gap-{name}</span>
            <span className="w-16 text-sm text-foreground-muted">{px}</span>
            <span aria-hidden="true" className={`${cls} h-4 rounded-sm bg-primary`} />
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Raios</h2>
        <div className="flex flex-wrap gap-4">
          {RADII.map(([cls, label]) => (
            <div key={cls} className="flex flex-col items-center gap-1 text-sm">
              <span
                aria-hidden="true"
                className={`${cls} size-14 border border-border-strong bg-surface-muted`}
              />
              <span className="font-mono">{cls}</span>
              <span className="text-foreground-muted">{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sombras</h2>
        <p className="text-foreground-muted">
          Só em elementos sobrepostos (menus, diálogos, barra inferior).
        </p>
        <div className="flex gap-4">
          <span className="rounded-lg bg-surface p-4 shadow-sm">shadow-sm</span>
          <span className="rounded-lg bg-surface p-4 shadow-md">shadow-md</span>
        </div>
      </section>
    </div>
  );
}

const UI_ICONS = [
  ["Voltar", ArrowLeft],
  ["Avançar", ChevronRight],
  ["Adicionar", Plus],
  ["Excluir", Trash2],
  ["Fechar", X],
  ["Buscar", Search],
  ["Confirmar", Check],
  ["Erro", CircleAlert],
  ["Ocultar valores", Eye],
  ["Mostrar valores", EyeOff],
] as const;

function Icones() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-foreground-muted">
        lucide-react, servido pelo próprio app. Ícone de interface sempre com rótulo em texto ou
        aria-label.
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Interface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {UI_ICONS.map(([label, Icon]) => (
            <span key={label} className="flex items-center gap-2 text-sm">
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </span>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mapa de categorias (categoryVisual)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CATEGORY_VISUALS) as CategoryVisualKey[]).map((key) => (
            <span key={key} className="flex items-center gap-3 text-sm">
              <CategoryIcon visual={key} size="sm" />
              <span className="flex flex-col">
                <span className="font-medium">{key}</span>
                <span className="text-foreground-muted">
                  {CATEGORY_VISUALS[key].icon} · {CATEGORY_VISUALS[key].color}
                </span>
              </span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Movimento() {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
        <dt className="font-mono text-sm">--duration-fast</dt>
        <dd className="sm:col-span-2">120 ms — realces, hover</dd>
        <dt className="font-mono text-sm">--duration-base</dt>
        <dd className="sm:col-span-2">200 ms — abrir/fechar painéis</dd>
        <dt className="font-mono text-sm">--ease-standard</dt>
        <dd className="sm:col-span-2">cubic-bezier(.2, 0, 0, 1)</dd>
      </dl>
      <p className="text-foreground-muted">
        Com “reduzir movimento” ativo no sistema, durações e animações vão a zero.
      </p>
      <h2 className="text-lg font-semibold">Camadas</h2>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
        <dt className="font-mono text-sm">z-nav (30)</dt>
        <dd className="sm:col-span-2">barra inferior e menu lateral</dd>
        <dt className="font-mono text-sm">z-overlay (40)</dt>
        <dd className="sm:col-span-2">diálogos, painéis, menus</dd>
        <dt className="font-mono text-sm">z-toast (50)</dt>
        <dd className="sm:col-span-2">avisos temporários</dd>
        <dt className="font-mono text-sm">z-demo (60)</dt>
        <dd className="sm:col-span-2">selo de demonstração — acima de tudo</dd>
      </dl>
    </div>
  );
}

const PAGES = {
  cores: Cores,
  tipografia: Tipografia,
  espacamento: Espacamento,
  icones: Icones,
  movimento: Movimento,
} as const;

export async function generateMetadata({ params }: PageProps<"/catalogo/fundamentos/[topic]">) {
  const { topic } = await params;
  const info = FOUNDATIONS.find((f) => f.topic === topic);
  return { title: `${info?.name ?? "Fundamentos"} · Catálogo · Prumo` };
}

/** Fundamentos do design system (contracts/catalog.md §1). */
export default async function FoundationPage({
  params,
}: PageProps<"/catalogo/fundamentos/[topic]">) {
  const { topic } = await params;
  const info = FOUNDATIONS.find((f) => f.topic === topic);
  if (!info) notFound();
  const Content = PAGES[info.topic];
  return (
    <>
      <PageHeader title={info.name} back="/catalogo" />
      <Content />
    </>
  );
}
