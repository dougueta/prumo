import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/auth/crypto";
import type { MemoryAuthStore } from "@/lib/auth/memory-store";
import { DOUG, HASH_SECRET, harness, makeEnv } from "./harness";
import { SUPABASE_URL } from "./fakes";

/**
 * 006 · T020 (FR-001, FR-002, FR-003, FR-006) — Google (PKCE): `startGoogle` e `/auth/callback`
 * (`completeGoogle`), auth-api.openapi.yaml.
 */
const allEvents = (store: MemoryAuthStore) => store.listEvents({ ownerId: "-", now: new Date() });

async function started(h: ReturnType<typeof harness>, next = "/extrato") {
  const result = await h.service.startGoogle({ next, request: h.request });
  if (!result.ok) throw new Error("startGoogle falhou");
  return new URL(result.url);
}

describe("startGoogle", () => {
  it("monta a ida ao Google com PKCE e volta para APP_ORIGIN/auth/callback", async () => {
    const h = harness();
    const url = await started(h);
    expect(url.origin + url.pathname).toBe(`${SUPABASE_URL}/auth/v1/authorize`);
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("redirect_to")).toBe("http://localhost:3100/auth/callback");
  });

  it("guarda o verifier do PKCE e o next em cookies HttpOnly", async () => {
    const h = harness();
    await started(h, "/mais/seguranca");
    expect(h.jar.get("prumo_next")).toBe("/mais/seguranca");
    const verifier = h.jar.writes.find((w) => w.name.endsWith("-code-verifier"));
    expect(verifier?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(h.jar.writes.find((w) => w.name === "prumo_next")!.options).toMatchObject({
      httpOnly: true,
      maxAge: 600,
    });
  });

  it("next inseguro vira /", async () => {
    const h = harness();
    await started(h, "https://evil.example");
    expect(h.jar.get("prumo_next")).toBe("/");
  });
});

describe("completeGoogle (/auth/callback)", () => {
  it("sucesso com e-mail autorizado ⇒ sessão, login_succeeded(google) e next do cookie", async () => {
    const h = harness();
    await started(h, "/mais/seguranca");
    h.fake.oauthCodes.set("code-ok", DOUG);
    expect(
      await h.service.completeGoogle({ code: "code-ok", error: null, request: h.request }),
    ).toEqual({
      ok: true,
      next: "/mais/seguranca",
    });
    const user = h.fake.users.get(DOUG)!;
    expect(await h.store.listSessions(user.id)).toMatchObject([{ method: "google" }]);
    expect((await allEvents(h.store)).find((e) => e.type === "login_succeeded")).toMatchObject({
      method: "google",
      owner_id: user.id,
      email_hash: hmacHex(HASH_SECRET, DOUG),
    });
    expect(h.jar.get("prumo_next")).toBeUndefined();
  });

  it("conta Google existente mas fora da allowlist ⇒ REFUSED, sessão revogada, sem cookie de sessão", async () => {
    const h = harness({ env: makeEnv({ AUTH_ALLOWED_EMAILS: ["outra@example.test"] }) });
    await started(h);
    h.fake.oauthCodes.set("code-x", DOUG);
    expect(
      await h.service.completeGoogle({ code: "code-x", error: null, request: h.request }),
    ).toEqual({
      ok: false,
      error: "REFUSED",
    });
    expect(h.fake.callsTo("/logout")).toHaveLength(1);
    expect(h.fake.revoked.size).toBe(1);
    expect(h.jar.names().some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n))).toBe(false);
    expect(await h.store.listSessions(h.fake.users.get(DOUG)!.id)).toEqual([]);
    expect((await allEvents(h.store)).find((e) => e.type === "email_refused")).toMatchObject({
      method: "google",
      email_masked: "do***@e***.test",
    });
  });

  it("conta Google desconhecida (cadastro desligado no Supabase) ⇒ REFUSED", async () => {
    const h = harness();
    await started(h);
    h.fake.oauthCodes.set("code-novo", "desconhecido@gmail.com");
    expect(
      await h.service.completeGoogle({ code: "code-novo", error: null, request: h.request }),
    ).toEqual({
      ok: false,
      error: "REFUSED",
    });
  });

  it("erro de cadastro desligado vindo no retorno ⇒ REFUSED", async () => {
    const h = harness();
    await started(h);
    expect(
      await h.service.completeGoogle({ code: null, error: "signup_disabled", request: h.request }),
    ).toEqual({ ok: false, error: "REFUSED" });
  });

  it("sem code ou com erro do provedor ⇒ UNAVAILABLE + provider_error(google_callback)", async () => {
    for (const input of [
      { code: null, error: null },
      { code: null, error: "access_denied" },
    ]) {
      const h = harness();
      await started(h);
      expect(await h.service.completeGoogle({ ...input, request: h.request })).toEqual({
        ok: false,
        error: "UNAVAILABLE",
      });
      expect((await allEvents(h.store)).find((e) => e.type === "provider_error")!.reason).toBe(
        "google_callback",
      );
    }
  });

  it("troca do code falha no Supabase ⇒ UNAVAILABLE", async () => {
    const h = harness();
    await started(h);
    h.fake.failToken = true;
    expect(
      await h.service.completeGoogle({ code: "qualquer", error: null, request: h.request }),
    ).toEqual({
      ok: false,
      error: "UNAVAILABLE",
    });
  });

  it("prumo_next adulterado é ignorado (next = /)", async () => {
    const h = harness();
    await started(h);
    h.jar.set("prumo_next", "//evil.example", { maxAge: 600 });
    h.fake.oauthCodes.set("code-ok", DOUG);
    expect(
      await h.service.completeGoogle({ code: "code-ok", error: null, request: h.request }),
    ).toEqual({
      ok: true,
      next: "/",
    });
  });
});
