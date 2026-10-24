import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/auth/crypto";
import { MemoryAuthStore } from "@/lib/auth/memory-store";
import { DOUG, HASH_SECRET, harness } from "./harness";

/**
 * 006 · T018 (FR-002, FR-005, SC-002) — contracts/auth-flows.md §4 `requestCode`.
 * A resposta (resultado, cookies, tempo) não pode revelar se o e-mail tem acesso.
 */
const STRANGER = "estranho@exemplo.com";

async function events(store: MemoryAuthStore, ownerless = true) {
  return (await store.listEvents({ ownerId: "-", now: new Date() })).filter(
    (e) => !ownerless || e.owner_id === null,
  );
}

describe("requestCode", () => {
  it("formato inválido ⇒ INVALID_EMAIL, sem chamar o provedor nem gravar evento", async () => {
    const h = harness();
    expect(await h.service.requestCode({ email: "não-é-email", request: h.request })).toEqual({
      ok: false,
      error: "INVALID_EMAIL",
    });
    expect(h.fake.callsTo("/otp")).toHaveLength(0);
    expect(await events(h.store)).toEqual([]);
  });

  it("autorizado ⇒ pede o código sem criar usuário, grava otp_requested e o cookie do e-mail", async () => {
    const h = harness();
    expect(
      await h.service.requestCode({ email: "  Doug@Example.test ", request: h.request }),
    ).toEqual({
      ok: true,
    });
    const calls = h.fake.callsTo("/otp");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ email: DOUG, create_user: false });
    expect((await events(h.store)).map((e) => e.type)).toEqual(["otp_requested"]);
    expect((await events(h.store))[0].email_hash).toBe(hmacHex(HASH_SECRET, DOUG));
    expect(h.jar.get("prumo_otp_email")).toBe(DOUG);
    const write = h.jar.writes.find((w) => w.name === "prumo_otp_email")!;
    expect(write.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  });

  it("não autorizado ⇒ mesma resposta, NÃO chama o provedor, grava email_refused mascarado", async () => {
    const h = harness();
    expect(await h.service.requestCode({ email: STRANGER, request: h.request })).toEqual({
      ok: true,
    });
    expect(h.fake.callsTo("/otp")).toHaveLength(0);
    const types = (await events(h.store)).map((e) => e.type).sort();
    expect(types).toEqual(["email_refused", "otp_requested"]);
    const refused = (await events(h.store)).find((e) => e.type === "email_refused")!;
    expect(refused.email_masked).toBe("es***@e***.com");
    expect(JSON.stringify(await events(h.store))).not.toContain(STRANGER);
  });

  it("bloqueado (5 falhas do e-mail) ⇒ TOO_MANY + login_blocked, sem provedor", async () => {
    const h = harness();
    const emailHash = hmacHex(HASH_SECRET, DOUG);
    for (let i = 0; i < 5; i++) {
      await h.store.insertEvent({
        type: "otp_failed",
        reason: "wrong_code",
        method: "none",
        owner_id: null,
        session_id: null,
        email_hash: emailHash,
        email_masked: null,
        ip_hash: hmacHex(HASH_SECRET, `outro-${i}`),
        device_label: "x",
        geo: null,
      });
    }
    expect(await h.service.requestCode({ email: DOUG, request: h.request })).toEqual({
      ok: false,
      error: "TOO_MANY",
    });
    expect(h.fake.callsTo("/otp")).toHaveLength(0);
    expect((await events(h.store)).filter((e) => e.type === "login_blocked")).toMatchObject([
      { reason: "rate_email" },
    ]);
  });

  it("provedor com erro ⇒ resposta continua ok; evento provider_error", async () => {
    const h = harness();
    h.fake.failOtp = true;
    expect(await h.service.requestCode({ email: DOUG, request: h.request })).toEqual({ ok: true });
    expect((await events(h.store)).map((e) => [e.type, e.reason]).sort()).toEqual([
      ["otp_requested", null],
      ["provider_error", "email_send"],
    ]);
  });

  it("piso de 1.500 ms em todos os ramos", async () => {
    for (const [email, setup] of [
      ["não-é-email", () => {}],
      [DOUG, () => {}],
      [STRANGER, () => {}],
      [DOUG, (h: ReturnType<typeof harness>) => (h.fake.failOtp = true)],
    ] as const) {
      const h = harness();
      setup(h);
      const start = performance.now();
      await h.service.requestCode({ email, request: h.request });
      const elapsed = performance.now() - start;
      const slept = h.sleeps.reduce((a, b) => a + b, 0);
      expect(elapsed + slept, email).toBeGreaterThanOrEqual(1500 - 5);
    }
  });

  it("neutralidade: mesmos cookies (nomes e opções) e mesmos contadores do rate limit", async () => {
    const a = harness();
    const b = harness();
    await a.service.requestCode({ email: DOUG, request: a.request });
    await b.service.requestCode({ email: STRANGER, request: b.request });
    const shape = (h: typeof a) => h.jar.writes.map((w) => [w.name, w.options]);
    expect(shape(a)).toEqual(shape(b));

    const now = new Date();
    const ip = hmacHex(HASH_SECRET, "203.0.113.7");
    expect(
      await a.store.rateLimitCounts({ emailHash: hmacHex(HASH_SECRET, DOUG), ipHash: ip, now }),
    ).toEqual(
      await b.store.rateLimitCounts({ emailHash: hmacHex(HASH_SECRET, STRANGER), ipHash: ip, now }),
    );
  });

  it("segundo pedido em menos de 60 s ⇒ TOO_MANY para qualquer e-mail", async () => {
    for (const email of [DOUG, STRANGER]) {
      const h = harness();
      await h.service.requestCode({ email, request: h.request });
      expect(await h.service.requestCode({ email, request: h.request }), email).toEqual({
        ok: false,
        error: "TOO_MANY",
      });
    }
  });
});
