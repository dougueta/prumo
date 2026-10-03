import { describe, expect, it } from "vitest";
import { evaluateKeepalive } from "../../scripts/keepalive-check.mjs";

describe("keepalive (FR-023)", () => {
  it("passa com 200 e banco ok", () => {
    expect(
      evaluateKeepalive(200, { status: "ok", environment: "production", data: { status: "ok" } }),
    ).toEqual({ ok: true, reason: "Produção saudável." });
  });

  it("falha com 503 (banco inacessível ou pausado)", () => {
    const result = evaluateKeepalive(503, { status: "degraded", data: { status: "unreachable" } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/inacessível|pausad/);
  });

  it("falha se a resposta não vier da produção", () => {
    expect(
      evaluateKeepalive(200, { status: "ok", environment: "preview", data: { status: "demo" } }).ok,
    ).toBe(false);
  });

  it("falha com resposta inesperada (ex.: página de erro da hospedagem)", () => {
    expect(evaluateKeepalive(200, null).ok).toBe(false);
    expect(evaluateKeepalive(401, null).ok).toBe(false);
  });
});
