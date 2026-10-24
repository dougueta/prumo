import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { recordEvent, type EventInput } from "@/lib/auth/events";
import type { EventRow } from "@/lib/auth/store";

/** 006 · T062 (FR-017, FR-018, FR-019) — data-model §4. */
const SECRET = "s".repeat(40);
const hmac = (v: string) => createHmac("sha256", SECRET).update(v).digest("hex");
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function sink(result = true) {
  const rows: EventRow[] = [];
  const insert = vi.fn(async (row: EventRow) => {
    rows.push(row);
    return result;
  });
  return { store: { insertEvent: insert }, rows, insert };
}

const request = {
  userAgent: IPHONE,
  ip: "203.0.113.7",
  headers: new Headers({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" }),
};

describe("recordEvent", () => {
  it("grava HMAC do e-mail normalizado e do IP, dispositivo e geo — nunca o IP em claro", async () => {
    const s = sink();
    await recordEvent(
      { type: "otp_requested", email: "  Doug@Example.test ", emailIsOwner: true, request },
      { store: s.store, hashSecret: SECRET },
    );
    expect(s.rows[0]).toEqual({
      type: "otp_requested",
      reason: null,
      method: "none",
      owner_id: null,
      session_id: null,
      email_hash: hmac("doug@example.test"),
      email_masked: null,
      ip_hash: hmac("203.0.113.7"),
      device_label: "iPhone · Safari",
      geo: "São Paulo, BR",
    });
    expect(JSON.stringify(s.rows[0])).not.toContain("203.0.113.7");
  });

  it("e-mail de terceiro só mascarado (e com hash, para o rate limit)", async () => {
    const s = sink();
    await recordEvent(
      { type: "email_refused", email: "estranho@exemplo.com", emailIsOwner: false, request },
      { store: s.store, hashSecret: SECRET },
    );
    expect(s.rows[0]).toMatchObject({
      email_masked: "es***@e***.com",
      email_hash: hmac("estranho@exemplo.com"),
      owner_id: null,
    });
    expect(JSON.stringify(s.rows[0])).not.toContain("estranho@exemplo.com");
  });

  it("e-mail do dono não é mascarado nem guardado (só o hash)", async () => {
    const s = sink();
    await recordEvent(
      {
        type: "login_succeeded",
        method: "email_otp",
        ownerId: "u1",
        sessionId: "s1",
        email: "doug@example.test",
        emailIsOwner: true,
        request,
      },
      { store: s.store, hashSecret: SECRET },
    );
    expect(s.rows[0]).toMatchObject({ owner_id: "u1", session_id: "s1", email_masked: null });
  });

  it("sem cabeçalhos de geo e sem IP (local) ⇒ geo nulo e IP 'local'", async () => {
    const s = sink();
    await recordEvent(
      {
        type: "logout",
        ownerId: "u1",
        request: { userAgent: null, ip: null, headers: new Headers() },
      },
      { store: s.store, hashSecret: SECRET },
    );
    expect(s.rows[0]).toMatchObject({
      geo: null,
      ip_hash: hmac("local"),
      device_label: "Dispositivo desconhecido",
    });
  });

  it.each([
    "otp_requested",
    "otp_failed",
    "email_refused",
    "login_blocked",
    "login_succeeded",
  ] as const)("%s sem e-mail é erro de programação (email_hash obrigatório)", async (type) => {
    const s = sink();
    await expect(
      recordEvent({ type, request }, { store: s.store, hashSecret: SECRET }),
    ).rejects.toThrow(/email/);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("a assinatura não aceita código, token nem senha (FR-019)", async () => {
    // Tipo: o campo não existe (falha de compilação se alguém o acrescentar ao tipo).
    // @ts-expect-error — `code` não existe em EventInput
    const typed: EventInput = { type: "logout", request, code: "123456" };
    expect(typed).toBeDefined();
    // Execução: qualquer campo a mais é recusado antes de tocar no banco.
    const s = sink();
    for (const forbidden of ["code", "token", "password", "otp", "accessToken"]) {
      const input = { type: "logout", request, [forbidden]: "123456" } as unknown as EventInput;
      await expect(recordEvent(input, { store: s.store, hashSecret: SECRET })).rejects.toThrow();
    }
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("erro do banco não propaga detalhes: devolve false", async () => {
    const s = sink(false);
    const result = await recordEvent(
      { type: "logout", ownerId: "u1", request },
      { store: s.store, hashSecret: SECRET },
    );
    expect(result).toBe(false);
  });

  it("sucesso devolve true", async () => {
    const s = sink();
    expect(
      await recordEvent({ type: "logout", request }, { store: s.store, hashSecret: SECRET }),
    ).toBe(true);
  });
});
