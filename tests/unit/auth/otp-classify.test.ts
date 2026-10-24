import { describe, expect, it, vi } from "vitest";
import { classifyOtpFailure, type OtpEvent } from "@/lib/auth/otp-classify";
import { withFloor } from "@/lib/auth/neutral-timing";

/** 006 · T008 (FR-004; research R-06) — o Supabase responde igual para errado e expirado. */
const MIN = 60_000;
const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("classifyOtpFailure", () => {
  it("sem pedido registrado ⇒ expired", () => {
    expect(classifyOtpFailure([], NOW)).toBe("expired");
  });

  it("último pedido há mais de 10 min ⇒ expired", () => {
    const events: OtpEvent[] = [{ type: "otp_requested", occurredAt: ago(10 * MIN + 1) }];
    expect(classifyOtpFailure(events, NOW)).toBe("expired");
  });

  it("10 min exatos ainda é wrong_code", () => {
    const events: OtpEvent[] = [{ type: "otp_requested", occurredAt: ago(10 * MIN) }];
    expect(classifyOtpFailure(events, NOW)).toBe("wrong_code");
  });

  it("login por código depois do último pedido ⇒ used", () => {
    const events: OtpEvent[] = [
      { type: "otp_requested", occurredAt: ago(5 * MIN) },
      { type: "login_succeeded", method: "email_otp", occurredAt: ago(4 * MIN) },
    ];
    expect(classifyOtpFailure(events, NOW)).toBe("used");
  });

  it("login pelo Google depois do pedido não torna o código 'usado'", () => {
    const events: OtpEvent[] = [
      { type: "otp_requested", occurredAt: ago(5 * MIN) },
      { type: "login_succeeded", method: "google", occurredAt: ago(4 * MIN) },
    ];
    expect(classifyOtpFailure(events, NOW)).toBe("wrong_code");
  });

  it("login anterior ao último pedido não conta (novo código pendente)", () => {
    const events: OtpEvent[] = [
      { type: "otp_requested", occurredAt: ago(9 * MIN) },
      { type: "login_succeeded", method: "email_otp", occurredAt: ago(8 * MIN) },
      { type: "otp_requested", occurredAt: ago(2 * MIN) },
    ];
    expect(classifyOtpFailure(events, NOW)).toBe("wrong_code");
  });
});

describe("withFloor (resposta neutra)", () => {
  it("espera até o piso quando a função termina antes", async () => {
    const sleep = vi.fn(async () => {});
    let t = 1000;
    const result = await withFloor(1500, async () => "ok", { now: () => t, sleep });
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(1500);
    t = 0;
  });

  it("não espera quando a função já passou do piso", async () => {
    const sleep = vi.fn(async () => {});
    const clock = [0, 2000];
    await withFloor(1500, async () => "ok", { now: () => clock.shift()!, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("aplica o piso também quando a função lança, e repassa o erro", async () => {
    const sleep = vi.fn(async () => {});
    const clock = [0, 100];
    await expect(
      withFloor(
        1000,
        async () => {
          throw new Error("x");
        },
        { now: () => clock.shift()!, sleep },
      ),
    ).rejects.toThrow("x");
    expect(sleep).toHaveBeenCalledWith(900);
  });
});
