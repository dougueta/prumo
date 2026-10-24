import { describe, expect, it } from "vitest";
import {
  AUTH_COOKIE_MAX_AGE_S,
  authCookieOptions,
  DEVICE_COOKIE_MAX_AGE_S,
  deviceCookieOptions,
} from "@/lib/auth/cookie-options";
import { authCookieMethods } from "@/lib/auth/supabase-clients";

/** 006 · T061 (FR-023) — data-model §10: uma única fonte de opções para todo cookie de auth. */
const DAY = 24 * 60 * 60;

describe("authCookieOptions", () => {
  for (const appEnv of ["local", "preview", "production"] as const) {
    it(`${appEnv}: HttpOnly, SameSite=Lax, Path=/`, () => {
      expect(authCookieOptions(appEnv)).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });
  }

  it("Secure fora de local", () => {
    expect(authCookieOptions("local").secure).toBe(false);
    expect(authCookieOptions("preview").secure).toBe(true);
    expect(authCookieOptions("production").secure).toBe(true);
  });

  it("validade padrão e máxima de 90 dias; pedidos maiores são cortados", () => {
    expect(AUTH_COOKIE_MAX_AGE_S).toBe(90 * DAY);
    expect(authCookieOptions("production").maxAge).toBe(90 * DAY);
    expect(authCookieOptions("production", { maxAge: 400 * DAY }).maxAge).toBe(90 * DAY);
    expect(authCookieOptions("production", { maxAge: 600 }).maxAge).toBe(600);
  });

  it("maxAge 0 (apagar cookie) é respeitado", () => {
    expect(authCookieOptions("production", { maxAge: 0 }).maxAge).toBe(0);
  });

  it("só prumo_device vive 400 dias, com as mesmas proteções", () => {
    expect(DEVICE_COOKIE_MAX_AGE_S).toBe(400 * DAY);
    expect(deviceCookieOptions("production")).toEqual({
      ...authCookieOptions("production"),
      maxAge: 400 * DAY,
    });
  });
});

describe("authCookieMethods — adaptador do @supabase/ssr", () => {
  function jar(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    const written: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const headers: Record<string, string> = {};
    return {
      store,
      written,
      headers,
      cookies: {
        getAll: () => [...store].map(([name, value]) => ({ name, value })),
        set: (name: string, value: string, options: Record<string, unknown>) => {
          store.set(name, value);
          written.push({ name, value, options });
        },
      },
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
    };
  }

  it("getAll repassa os cookies do pedido", async () => {
    const j = jar({ "sb-x-auth-token": "t", prumo_device: "d" });
    const methods = authCookieMethods("local", j.cookies, j.setHeader);
    expect(await methods.getAll()).toEqual([
      { name: "sb-x-auth-token", value: "t" },
      { name: "prumo_device", value: "d" },
    ]);
  });

  it("setAll sobrescreve opções fracas vindas da biblioteca (FR-023)", async () => {
    const j = jar();
    const methods = authCookieMethods("production", j.cookies, j.setHeader);
    await methods.setAll!(
      [
        {
          name: "sb-x-auth-token",
          value: "novo",
          options: {
            httpOnly: false,
            sameSite: "none",
            path: "/x",
            secure: false,
            maxAge: 400 * DAY,
            domain: "evil.example",
          },
        },
      ],
      { "Cache-Control": "private, no-store" },
    );
    expect(j.written).toEqual([
      {
        name: "sb-x-auth-token",
        value: "novo",
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 90 * DAY },
      },
    ]);
  });

  it("setAll repassa os cabeçalhos anti-cache da biblioteca", async () => {
    const j = jar();
    const methods = authCookieMethods("production", j.cookies, j.setHeader);
    await methods.setAll!([], { "Cache-Control": "private, no-store", Pragma: "no-cache" });
    expect(j.headers).toEqual({ "Cache-Control": "private, no-store", Pragma: "no-cache" });
  });

  it("apagar cookie (maxAge 0) continua apagando", async () => {
    const j = jar({ "sb-x-auth-token": "t" });
    const methods = authCookieMethods("local", j.cookies, j.setHeader);
    await methods.setAll!([{ name: "sb-x-auth-token", value: "", options: { maxAge: 0 } }], {});
    expect(j.written[0].options).toMatchObject({ maxAge: 0, httpOnly: true });
  });
});
