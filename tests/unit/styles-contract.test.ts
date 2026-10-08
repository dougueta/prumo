import { describe, expect, it } from "vitest";
import { BRAND_COLOR, BRAND_INK, SPLASH_BACKGROUND, THEME_COLOR } from "@/styles/tokens";
import {
  DARK_MEDIA_SELECTOR,
  extractBlock,
  parseVars,
  readTokensCss,
  themeVars,
} from "./helpers/css-tokens";

/** Contrato de estilos (data-model §1.1a, §1.1b, §2) — FR-001, FR-015, FR-018, FR-022. */
const css = readTokensCss();
const { light, dark } = themeVars();
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

describe("espelho TS dos tokens (src/styles/tokens.ts)", () => {
  it("THEME_COLOR = --background de cada tema", () => {
    expect(THEME_COLOR.light.toUpperCase()).toBe(light["--background"].toUpperCase());
    expect(THEME_COLOR.dark.toUpperCase()).toBe(dark["--background"].toUpperCase());
  });

  it("BRAND_COLOR e SPLASH_BACKGROUND = --primary claro; BRAND_INK = --background claro", () => {
    expect(BRAND_COLOR.toUpperCase()).toBe(light["--primary"].toUpperCase());
    expect(SPLASH_BACKGROUND.toUpperCase()).toBe(light["--primary"].toUpperCase());
    expect(BRAND_INK.toUpperCase()).toBe(light["--background"].toUpperCase());
  });
});

describe("tokens.css", () => {
  it("redefine a variante dark: com o mesmo critério dos tokens (§1.1a)", () => {
    const variant = squash(extractBlock(css, "@custom-variant dark"));
    expect(variant).toContain('&:where([data-theme="dark"], [data-theme="dark"] *)');
    expect(variant).toContain("@media (prefers-color-scheme: dark)");
    expect(variant).toContain(
      '&:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *)',
    );
  });

  it("define --overlay nos dois temas (véu de diálogos)", () => {
    expect(light["--overlay"]).toMatch(/^#[0-9A-Fa-f]{8}$/);
    expect(dark["--overlay"]).toMatch(/^#[0-9A-Fa-f]{8}$/);
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(parseVars(extractBlock(media, DARK_MEDIA_SELECTOR))["--overlay"]).toBe(
      dark["--overlay"],
    );
  });

  it.each(["top", "bottom", "left", "right"])("utilitário de área segura %s", (side) => {
    const short = side[0];
    const body = squash(extractBlock(css, `@utility p${short}-safe`));
    expect(body).toBe(`padding-${side}: env(safe-area-inset-${side});`);
  });

  it("movimento reduzido zera as durações", () => {
    const media = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(media.length).toBeGreaterThan(0);
    const vars = parseVars(extractBlock(media, ":root"));
    const durations = Object.keys(light).filter((name) => name.startsWith("--duration-"));
    expect(durations.length).toBeGreaterThanOrEqual(2);
    for (const name of durations) expect(vars[name], name).toBe("0ms");
  });

  it("camadas: selo de demonstração acima de diálogos e avisos", () => {
    const z = (name: string) => Number(light[`--z-${name}`]);
    expect(z("demo")).toBeGreaterThan(z("toast"));
    expect(z("toast")).toBeGreaterThan(z("overlay"));
    expect(z("overlay")).toBeGreaterThan(z("nav"));
  });
});
