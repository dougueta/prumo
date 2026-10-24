import { describe, expect, it } from "vitest";
import { countRateLimit, evaluateRateLimit, type RateLimitEvent } from "@/lib/auth/rate-limit";

/** 006 · T008 (FR-002, FR-005, SC-007) — plan §Rate limit. */
const MIN = 60_000;
const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const IP = "ip-1";

const ev = (
  type: RateLimitEvent["type"],
  email: string,
  msAgo: number,
  ip = IP,
): RateLimitEvent => ({
  type,
  emailHash: email,
  ipHash: ip,
  occurredAt: ago(msAgo),
});

const decide = (kind: "request" | "verify", events: RateLimitEvent[], email: string, ip = IP) =>
  evaluateRateLimit(kind, countRateLimit(events, { emailHash: email, ipHash: ip, now: NOW }));

describe("evaluateRateLimit — limiares", () => {
  it("5 verificações falhas do e-mail em 15 min ⇒ BLOCKED(rate_email)", () => {
    const events = Array.from({ length: 5 }, (_, i) => ev("otp_failed", "e1", i * MIN, `ip-${i}`));
    expect(decide("verify", events, "e1", "ip-x")).toEqual({
      decision: "BLOCKED",
      reason: "rate_email",
    });
  });

  it("4 falhas ainda passam", () => {
    const events = Array.from({ length: 4 }, (_, i) => ev("otp_failed", "e1", i * MIN));
    expect(decide("verify", events, "e1").decision).toBe("ALLOWED");
  });

  it("5 falhas do mesmo IP com e-mails diferentes ⇒ BLOCKED(rate_ip)", () => {
    const events = Array.from({ length: 5 }, (_, i) => ev("otp_failed", `e${i}`, i * MIN));
    expect(decide("verify", events, "outro")).toEqual({ decision: "BLOCKED", reason: "rate_ip" });
  });

  it("janela deslizante: falha de 15 min + 1 ms atrás não conta", () => {
    const events = [
      ev("otp_failed", "e1", 15 * MIN + 1),
      ...Array.from({ length: 4 }, (_, i) => ev("otp_failed", "e1", i * MIN)),
    ];
    expect(decide("verify", events, "e1").decision).toBe("ALLOWED");
  });

  it("pedido: 1 a cada 60 s por e-mail", () => {
    expect(decide("request", [ev("otp_requested", "e1", 59_000)], "e1")).toEqual({
      decision: "BLOCKED",
      reason: "throttle_request",
    });
    expect(decide("request", [ev("otp_requested", "e1", 61_000)], "e1").decision).toBe("ALLOWED");
  });

  it("pedido: no máximo 5 por hora por e-mail", () => {
    const five = Array.from({ length: 5 }, (_, i) => ev("otp_requested", "e1", (i + 2) * 10 * MIN));
    expect(decide("request", five.slice(0, 4), "e1").decision).toBe("ALLOWED");
    expect(decide("request", five.slice(0, 5), "e1")).toEqual({
      decision: "BLOCKED",
      reason: "throttle_request",
    });
  });

  it("o limite de pedidos não se aplica à verificação", () => {
    expect(decide("verify", [ev("otp_requested", "e1", 1000)], "e1").decision).toBe("ALLOWED");
  });
});

describe("countRateLimit — só otp_failed conta como falha (remediação H1)", () => {
  it("email_refused e login_blocked não contam", () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => ev("email_refused", `x${i}`, i * MIN)),
      ...Array.from({ length: 6 }, (_, i) => ev("login_blocked", "e1", i * MIN)),
    ];
    const counts = countRateLimit(events, { emailHash: "e1", ipHash: IP, now: NOW });
    expect(counts.failedByEmail).toBe(0);
    expect(counts.failedByIp).toBe(0);
  });

  it("vetor de neutralidade: 4 recusados + autorizado ≡ 4 recusados + recusado", () => {
    // Pedidos para e-mails fora da lista gravam otp_requested + email_refused (mesmo IP).
    const refused = (i: number) => [
      ev("otp_requested", `fora${i}`, (10 - i) * MIN),
      ev("email_refused", `fora${i}`, (10 - i) * MIN),
    ];
    const history = [1, 2, 3, 4].flatMap(refused);
    const authorized = decide("request", history, "doug");
    const another = decide("request", history, "fora5");
    expect(authorized).toEqual(another);
    expect(authorized.decision).toBe("ALLOWED");
  });
});
