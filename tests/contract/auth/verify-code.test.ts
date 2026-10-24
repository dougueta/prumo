import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/auth/crypto";
import type { MemoryAuthStore } from "@/lib/auth/memory-store";
import type { EventRow } from "@/lib/auth/store";
import { FakeCookieJar } from "./fakes";
import { DOUG, HASH_SECRET, harness } from "./harness";

/**
 * 006 · T019 (FR-002–FR-006) — contracts/auth-flows.md §4 `verifyCode`.
 */
const STRANGER = "estranho@exemplo.com";
const MIN = 60_000;

const allEvents = (store: MemoryAuthStore) => store.listEvents({ ownerId: "-", now: new Date() });

async function history(store: MemoryAuthStore, ownerId: string) {
  return store.listEvents({ ownerId, now: new Date() });
}

function seed(store: MemoryAuthStore, row: Partial<EventRow>) {
  return store.insertEvent({
    type: "otp_requested",
    reason: null,
    method: "none",
    owner_id: null,
    session_id: null,
    email_hash: hmacHex(HASH_SECRET, DOUG),
    email_masked: null,
    ip_hash: hmacHex(HASH_SECRET, "x"),
    device_label: "x",
    geo: null,
    ...row,
  });
}

/** Pede o código pelo próprio serviço (grava otp_requested e o cookie) e devolve o código emitido. */
async function requested(h: ReturnType<typeof harness>, email = DOUG) {
  await h.service.requestCode({ email, request: h.request });
  return h.fake.codes.get(email)?.code ?? "000000";
}

describe("verifyCode — falhas", () => {
  it("sem o cookie do e-mail (expirou) ⇒ EXPIRED_OR_USED", async () => {
    const h = harness();
    expect(await h.service.verifyCode({ code: "123456", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "EXPIRED_OR_USED",
    });
  });

  it("formato inválido ⇒ WRONG_CODE + otp_failed(wrong_code)", async () => {
    const h = harness();
    await requested(h);
    expect(await h.service.verifyCode({ code: "12ab56", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "WRONG_CODE",
    });
    expect(h.fake.callsTo("/verify")).toHaveLength(0);
    expect((await allEvents(h.store)).find((e) => e.type === "otp_failed")).toMatchObject({
      reason: "wrong_code",
      email_hash: hmacHex(HASH_SECRET, DOUG),
    });
  });

  it("código errado ⇒ WRONG_CODE (autorizado e não autorizado com o mesmo evento)", async () => {
    const shapes = [];
    for (const email of [DOUG, STRANGER]) {
      const h = harness();
      const code = await requested(h, email);
      const wrong = code === "111111" ? "222222" : "111111";
      expect(
        await h.service.verifyCode({ code: wrong, next: "/", request: h.request }),
        email,
      ).toEqual({
        ok: false,
        error: "WRONG_CODE",
      });
      const failed = (await allEvents(h.store)).filter((e) => e.type === "otp_failed");
      shapes.push(failed.map((e) => [e.type, e.reason, e.method, e.owner_id]));
      if (email === STRANGER) expect(h.fake.callsTo("/verify")).toHaveLength(0);
    }
    expect(shapes[0]).toEqual(shapes[1]);
  });

  it("piso de 1.000 ms nas falhas (autorizado e não autorizado)", async () => {
    for (const email of [DOUG, STRANGER]) {
      const h = harness();
      await requested(h, email);
      h.sleeps.length = 0;
      const start = performance.now();
      await h.service.verifyCode({ code: "000001", next: "/", request: h.request });
      const total = performance.now() - start + h.sleeps.reduce((a, b) => a + b, 0);
      expect(total, email).toBeGreaterThanOrEqual(1000 - 5);
    }
  });

  it("código de pedido com mais de 10 min ⇒ EXPIRED_OR_USED + otp_failed(expired)", async () => {
    const jar = new FakeCookieJar({ prumo_otp_email: DOUG });
    const h = harness({ jar });
    await seed(h.store, { occurred_at: new Date(Date.now() - 11 * MIN) });
    expect(await h.service.verifyCode({ code: "123456", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "EXPIRED_OR_USED",
    });
    expect((await allEvents(h.store)).find((e) => e.type === "otp_failed")!.reason).toBe("expired");
  });

  it("código já usado (login por código depois do pedido) ⇒ EXPIRED_OR_USED + otp_failed(used)", async () => {
    const jar = new FakeCookieJar({ prumo_otp_email: DOUG });
    const h = harness({ jar });
    await seed(h.store, { occurred_at: new Date(Date.now() - 3 * MIN) });
    await seed(h.store, {
      type: "login_succeeded",
      method: "email_otp",
      occurred_at: new Date(Date.now() - 2 * MIN),
    });
    expect(await h.service.verifyCode({ code: "123456", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "EXPIRED_OR_USED",
    });
    expect((await allEvents(h.store)).find((e) => e.type === "otp_failed")!.reason).toBe("used");
  });

  it("5 falhas ⇒ TOO_MANY (bloqueio por e-mail), sem chamar o provedor", async () => {
    const h = harness();
    await requested(h);
    for (let i = 0; i < 5; i++)
      await h.service.verifyCode({ code: "000001", next: "/", request: h.request });
    const before = h.fake.callsTo("/verify").length;
    expect(await h.service.verifyCode({ code: "000002", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "TOO_MANY",
    });
    expect(h.fake.callsTo("/verify")).toHaveLength(before);
    expect(
      (await allEvents(h.store)).some(
        (e) => e.type === "login_blocked" && e.reason === "rate_email",
      ),
    ).toBe(true);
  });

  it("provedor fora ⇒ UNAVAILABLE + provider_error(auth_unavailable)", async () => {
    const h = harness();
    await requested(h);
    h.fake.failVerify = true;
    expect(await h.service.verifyCode({ code: "123456", next: "/", request: h.request })).toEqual({
      ok: false,
      error: "UNAVAILABLE",
    });
    expect((await allEvents(h.store)).find((e) => e.type === "provider_error")!.reason).toBe(
      "auth_unavailable",
    );
  });
});

describe("verifyCode — sucesso ⇒ establishSession", () => {
  it("cria a sessão no dispositivo, grava login_succeeded e devolve o next seguro", async () => {
    const h = harness();
    const code = await requested(h);
    const result = await h.service.verifyCode({
      code,
      next: "/mais/seguranca",
      request: h.request,
    });
    expect(result).toEqual({ ok: true, next: "/mais/seguranca" });

    const user = h.fake.users.get(DOUG)!;
    const [session] = await h.store.listSessions(user.id);
    expect(session).toMatchObject({
      ownerId: user.id,
      method: "email_otp",
      deviceLabel: "iPhone · Safari",
    });
    expect(session.deviceId).toBe(h.jar.get("prumo_device"));
    expect(session.absoluteExpiresAt.getTime() - session.createdAt.getTime()).toBe(
      90 * 24 * 60 * MIN,
    );

    const login = (await history(h.store, user.id)).find((e) => e.type === "login_succeeded")!;
    expect(login).toMatchObject({
      method: "email_otp",
      owner_id: user.id,
      session_id: session.id,
      email_hash: hmacHex(HASH_SECRET, DOUG),
      email_masked: null,
    });
    expect(h.bootstrap).toHaveBeenCalledTimes(1);
  });

  it("cookies: sessão sb-*, prumo_device (400 d), janela de biometria (10 min); e-mail digitado apagado", async () => {
    const h = harness();
    const code = await requested(h);
    await h.service.verifyCode({ code, next: "/", request: h.request });
    expect(h.jar.names().some((n) => /^sb-.+-auth-token/.test(n))).toBe(true);
    expect(h.jar.get("prumo_otp_email")).toBeUndefined();
    const device = h.jar.writes.find((w) => w.name === "prumo_device")!;
    expect(device.options).toMatchObject({ httpOnly: true, maxAge: 400 * 24 * 60 * 60 });
    const enroll = h.jar.writes.find((w) => w.name === "prumo_enroll_until")!;
    expect(enroll.options).toMatchObject({ httpOnly: true, maxAge: 600 });
  });

  it("mantém o prumo_device existente", async () => {
    const jar = new FakeCookieJar({ prumo_device: "11111111-1111-4111-8111-111111111111" });
    const h = harness({ jar });
    const code = await requested(h);
    await h.service.verifyCode({ code, next: "/", request: h.request });
    const [session] = await h.store.listSessions(h.fake.users.get(DOUG)!.id);
    expect(session.deviceId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("next inseguro ⇒ /", async () => {
    const h = harness();
    const code = await requested(h);
    expect(
      await h.service.verifyCode({ code, next: "//evil.example", request: h.request }),
    ).toEqual({
      ok: true,
      next: "/",
    });
  });

  it("falha do bootstrap da 004 não impede a entrada", async () => {
    const h = harness();
    h.bootstrap.mockRejectedValueOnce(new Error("banco"));
    const code = await requested(h);
    expect((await h.service.verifyCode({ code, next: "/", request: h.request })).ok).toBe(true);
  });

  it("o código é de uso único", async () => {
    const h = harness();
    const code = await requested(h);
    await h.service.verifyCode({ code, next: "/", request: h.request });
    h.jar.set("prumo_otp_email", DOUG, { maxAge: 600 });
    expect(await h.service.verifyCode({ code, next: "/", request: h.request })).toEqual({
      ok: false,
      error: "EXPIRED_OR_USED",
    });
  });
});
