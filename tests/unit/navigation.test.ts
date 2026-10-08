import { readFileSync } from "node:fs";
import path from "node:path";
import { CalendarRange, Ellipsis, House, ReceiptText, TrendingUp } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  DESTINATIONS,
  FEATURE_SLOTS,
  OUTSIDE_SHELL_ROUTES,
  activeDestination,
  isActive,
} from "@/lib/navigation";

/** contracts/navigation.md §1, §2, §2.1 — FR-007, FR-008. */
const roadmap = readFileSync(path.resolve(__dirname, "../../docs/roadmap.md"), "utf8");
const ROADMAP_FEATURES = [...roadmap.matchAll(/^\| (\d{3}) \| `/gm)].map((m) => m[1]);

describe("destinos principais (FR-007)", () => {
  it("exatamente 5 destinos, na ordem do contrato", () => {
    expect(DESTINATIONS.map((d) => [d.id, d.label, d.href])).toEqual([
      ["inicio", "Início", "/"],
      ["extrato", "Extrato", "/extrato"],
      ["planejamento", "Planejamento", "/planejamento"],
      ["investimentos", "Investimentos", "/investimentos"],
      ["mais", "Mais", "/mais"],
    ]);
  });

  it("cada destino tem ícone do contrato", () => {
    expect(DESTINATIONS.map((d) => d.icon)).toEqual([
      House,
      ReceiptText,
      CalendarRange,
      TrendingUp,
      Ellipsis,
    ]);
  });

  it.each([
    ["/", "/", true],
    ["/", "/extrato", false],
    ["/extrato", "/extrato", true],
    ["/extrato", "/extrato/123", true],
    ["/extrato", "/extratos", false],
    ["/mais", "/mais/ajustes", true],
    ["/planejamento", "/", false],
  ])("isActive(%s, %s) = %s", (href, pathname, expected) => {
    expect(isActive(href, pathname)).toBe(expected);
  });

  it("activeDestination resolve pelo prefixo; catálogo fica em Mais", () => {
    expect(activeDestination("/")?.id).toBe("inicio");
    expect(activeDestination("/extrato/abc")?.id).toBe("extrato");
    expect(activeDestination("/mais/ajustes")?.id).toBe("mais");
    expect(activeDestination("/catalogo/money")?.id).toBe("mais");
    expect(activeDestination("/rota-desconhecida")).toBeUndefined();
  });
});

describe("mapa das 32 features (FR-008)", () => {
  it("o roadmap tem as 32 features", () => {
    expect(ROADMAP_FEATURES).toHaveLength(32);
  });

  it("cada feature do roadmap aparece exatamente uma vez", () => {
    const slots = FEATURE_SLOTS.map((s) => s.feature);
    expect([...slots].sort()).toEqual([...ROADMAP_FEATURES].sort());
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("rotas previstas são únicas", () => {
    const paths = FEATURE_SLOTS.map((s) => s.path).filter((p): p is string => p !== null);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("a 006 fica em /mais/seguranca e a 003 em Ajustes", () => {
    expect(FEATURE_SLOTS.find((s) => s.feature === "006")?.path).toBe("/mais/seguranca");
    expect(FEATURE_SLOTS.find((s) => s.feature === "003")?.path).toBe("/mais/ajustes");
  });

  it("nenhuma feature cria um 6º destino", () => {
    const ids = new Set([...DESTINATIONS.map((d) => d.id), "plataforma"]);
    for (const slot of FEATURE_SLOTS) expect(ids.has(slot.destination), slot.feature).toBe(true);
  });
});

describe("rotas fora do shell (§2.1)", () => {
  it("lista do contrato com as donas", () => {
    expect(OUTSIDE_SHELL_ROUTES.map((r) => [r.path, r.owner])).toEqual([
      ["/entrar", "006"],
      ["/entrar/codigo", "006"],
      ["/desbloquear", "006"],
      ["/~offline", "001"],
      ["*", "003"],
    ]);
  });

  it("não coincidem com rotas de features dentro do shell", () => {
    const inside = new Set(FEATURE_SLOTS.map((s) => s.path));
    for (const route of OUTSIDE_SHELL_ROUTES)
      expect(inside.has(route.path), route.path).toBe(false);
  });
});
