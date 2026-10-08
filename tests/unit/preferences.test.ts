import { describe, expect, it } from "vitest";
import {
  PRIVACY_COOKIE,
  THEME_COOKIE,
  parsePrivacy,
  parseTheme,
  serializePreferenceCookie,
} from "@/lib/preferences";

/** data-model §3 — FR-018, FR-031. Preferências só no aparelho (cookies), sem dado pessoal. */
describe("preferências de exibição", () => {
  it("nomes dos cookies", () => {
    expect(THEME_COOKIE).toBe("prumo_theme");
    expect(PRIVACY_COOKIE).toBe("prumo_privacy");
  });

  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["auto", "auto"],
    [undefined, "auto"],
    ["", "auto"],
    ["DARK", "auto"],
    ["roxo", "auto"],
  ])("parseTheme(%j) → %s", (value, expected) => {
    expect(parseTheme(value)).toBe(expected);
    expect(parseTheme(value === undefined ? undefined : { value })).toBe(expected);
  });

  it.each([
    ["on", "on"],
    ["off", "off"],
    [undefined, "off"],
    ["1", "off"],
    ["true", "off"],
  ])("parsePrivacy(%j) → %s", (value, expected) => {
    expect(parsePrivacy(value)).toBe(expected);
  });

  it("serializa com os atributos do contrato", () => {
    expect(serializePreferenceCookie(THEME_COOKIE, "dark", { secure: true })).toBe(
      "prumo_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(serializePreferenceCookie(PRIVACY_COOKIE, "on", { secure: false })).toBe(
      "prumo_privacy=on; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("nunca marca HttpOnly (o cliente grava a preferência)", () => {
    expect(serializePreferenceCookie(THEME_COOKIE, "light", { secure: true })).not.toMatch(
      /HttpOnly/i,
    );
  });
});
