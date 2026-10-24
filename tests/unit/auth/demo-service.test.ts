import { describe, expect, it } from "vitest";
import { DEMO_CODE, DEMO_EXPIRED_CODE, createDemoAuthService } from "@/lib/auth/demo-service";
import { FakeCookieJar } from "../../helpers/fake-cookie-jar";

/** 006 · T046 (FR-024, FR-025) — data-model §9: simulações sem provedor nem banco. */
const request = { userAgent: null, ip: null, headers: new Headers() };
const DEMO = "demo@prumo.invalid";

function service(sid = "sid-1", jar = new FakeCookieJar({ prumo_demo_sid: sid })) {
  return { jar, s: createDemoAuthService(jar) };
}

describe("DemoAuthService", () => {
  it("pedir código: formato inválido ⇒ INVALID_EMAIL; qualquer e-mail válido ⇒ ok neutro", async () => {
    const { s, jar } = service();
    expect(await s.requestCode({ email: "x", request })).toEqual({
      ok: false,
      error: "INVALID_EMAIL",
    });
    expect(await s.requestCode({ email: "outro@exemplo.com", request })).toEqual({ ok: true });
    expect(await s.requestCode({ email: DEMO, request })).toEqual({ ok: true });
    expect(jar.get("prumo_otp_email")).toBe(DEMO);
  });

  it(`${DEMO_CODE} entra e limpa a saída da demo`, async () => {
    const { s, jar } = service();
    jar.set("prumo_demo_out", "1", { maxAge: 7200 });
    await s.requestCode({ email: DEMO, request });
    expect(await s.verifyCode({ code: DEMO_CODE, next: "/extrato", request })).toEqual({
      ok: true,
      next: "/extrato",
    });
    expect(jar.get("prumo_demo_out")).toBeUndefined();
  });

  it(`${DEMO_EXPIRED_CODE} simula expirado; outro código é incorreto`, async () => {
    const { s } = service();
    await s.requestCode({ email: DEMO, request });
    expect(await s.verifyCode({ code: DEMO_EXPIRED_CODE, next: "/", request })).toEqual({
      ok: false,
      error: "EXPIRED_OR_USED",
    });
    expect(await s.verifyCode({ code: "123456", next: "/", request })).toEqual({
      ok: false,
      error: "WRONG_CODE",
    });
  });

  it("e-mail que não é o da demo nunca entra, mesmo com o código certo", async () => {
    const { s } = service();
    await s.requestCode({ email: "outro@exemplo.com", request });
    expect(await s.verifyCode({ code: DEMO_CODE, next: "/", request })).toEqual({
      ok: false,
      error: "WRONG_CODE",
    });
  });

  it("5 erros na sessão demo ⇒ TOO_MANY; outra sessão demo não é afetada", async () => {
    const { s } = service("sid-a");
    await s.requestCode({ email: DEMO, request });
    for (let i = 0; i < 5; i++) await s.verifyCode({ code: "000000", next: "/", request });
    expect(await s.verifyCode({ code: DEMO_CODE, next: "/", request })).toEqual({
      ok: false,
      error: "TOO_MANY",
    });
    const { s: other } = service("sid-b");
    await other.requestCode({ email: DEMO, request });
    expect((await other.verifyCode({ code: DEMO_CODE, next: "/", request })).ok).toBe(true);
  });

  it("Google indisponível na demonstração (nenhum provedor externo)", async () => {
    const { s } = service();
    expect(await s.startGoogle({ next: "/", request })).toEqual({
      ok: false,
      error: "UNAVAILABLE",
    });
    expect(await s.completeGoogle({ code: "x", error: null, request })).toEqual({
      ok: false,
      error: "UNAVAILABLE",
    });
  });
});
