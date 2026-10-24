import { describe, expect, it } from "vitest";
import { decideProxy, hasSupabaseAuthCookie, isPublicPath } from "@/lib/auth/proxy-decision";

/** 006 · T060 (FR-007, FR-008, FR-009, FR-028) — contracts/auth-flows.md §1–§2. */

const PUBLIC = [
  "/entrar",
  "/entrar/codigo",
  "/auth/callback",
  "/auth/sair",
  "/~offline",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];
const PROTECTED_PAGES = [
  "/",
  "/extrato",
  "/mais/seguranca",
  "/desbloquear",
  "/catalogo",
  "/nao-existe",
];
const PROTECTED_API = ["/api/auth/status", "/api/auth/webauthn/unlock/options", "/api/qualquer"];

describe("isPublicPath", () => {
  it.each(PUBLIC)("%s é pública", (path) => expect(isPublicPath(path)).toBe(true));
  it.each([...PROTECTED_PAGES, ...PROTECTED_API])("%s é protegida", (path) =>
    expect(isPublicPath(path)).toBe(false),
  );

  it("não aceita variações que só começam parecido", () => {
    for (const path of [
      "/entrarx",
      "/authx/callback",
      "/api/healthz",
      "/icons",
      "/sw.js.map",
      "/~offlinex",
    ]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("decideProxy — local e production", () => {
  for (const appEnv of ["local", "production"] as const) {
    it.each(PUBLIC)(`${appEnv}: pública %s segue sem desafio (sem Basic Auth)`, (path) => {
      expect(decideProxy({ appEnv, path, search: "", hasAuthCookie: false })).toEqual({
        action: "next",
      });
    });

    it.each(PROTECTED_PAGES)(`${appEnv}: página %s sem cookie ⇒ /entrar?next=`, (path) => {
      expect(decideProxy({ appEnv, path, search: "", hasAuthCookie: false })).toEqual({
        action: "redirect",
        location: `/entrar?next=${encodeURIComponent(path)}`,
      });
    });

    it.each(PROTECTED_API)(`${appEnv}: API %s sem cookie ⇒ 401`, (path) => {
      expect(decideProxy({ appEnv, path, search: "", hasAuthCookie: false })).toEqual({
        action: "unauthorized",
      });
    });

    it(`${appEnv}: protegida com cookie ⇒ renova tokens e marca no-store`, () => {
      expect(decideProxy({ appEnv, path: "/extrato", search: "", hasAuthCookie: true })).toEqual({
        action: "refresh",
      });
    });

    it(`${appEnv}: /entrar com cookie NÃO redireciona para / (sem laço com sessão encerrada)`, () => {
      expect(decideProxy({ appEnv, path: "/entrar", search: "", hasAuthCookie: true })).toEqual({
        action: "next",
      });
    });
  }

  it("preserva a query no next", () => {
    expect(
      decideProxy({
        appEnv: "local",
        path: "/extrato",
        search: "?mes=2026-10",
        hasAuthCookie: false,
      }),
    ).toEqual({
      action: "redirect",
      location: `/entrar?next=${encodeURIComponent("/extrato?mes=2026-10")}`,
    });
  });
});

describe("decideProxy — preview", () => {
  it.each([...PUBLIC, ...PROTECTED_PAGES, ...PROTECTED_API])(
    "não toca no Supabase e só garante prumo_demo_sid: %s",
    (path) => {
      expect(decideProxy({ appEnv: "preview", path, search: "", hasAuthCookie: false })).toEqual({
        action: "demo",
      });
    },
  );
});

describe("hasSupabaseAuthCookie", () => {
  it("reconhece o cookie do Supabase, inteiro ou em pedaços", () => {
    expect(hasSupabaseAuthCookie(["sb-abc-auth-token"])).toBe(true);
    expect(hasSupabaseAuthCookie(["x", "sb-127-auth-token.0", "sb-127-auth-token.1"])).toBe(true);
  });

  it("ignora o verifier do PKCE e outros cookies", () => {
    expect(hasSupabaseAuthCookie(["sb-abc-auth-token-code-verifier", "prumo_device"])).toBe(false);
    expect(hasSupabaseAuthCookie([])).toBe(false);
  });
});
