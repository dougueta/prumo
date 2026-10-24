import { describe, expect, it } from "vitest";
import {
  evaluateSession,
  unlockFailureTransition,
  unlockTransition,
  type SessionRow,
} from "@/lib/auth/session-state";

/**
 * 006 · T007 (FR-010, FR-011, FR-012) — máquina de estados (plan §Máquina de estados).
 * Relógio sempre injetado: a validade é decidida pelo servidor (FR-011).
 */
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const T0 = new Date("2026-10-01T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    deviceId: "dev-a",
    createdAt: T0,
    absoluteExpiresAt: at(90 * DAY),
    lastActiveAt: T0,
    endedAt: null,
    endReason: null,
    unlockFailures: 0,
    ...overrides,
  };
}

const evaluate = (
  r: SessionRow | null,
  now: Date,
  extra: Partial<{ cred: boolean; ok: boolean }> = {},
) =>
  evaluateSession({
    row: r,
    now,
    hasDeviceCredential: extra.cred ?? true,
    emailAllowed: extra.ok ?? true,
  });

describe("evaluateSession — regras em ordem", () => {
  it("1. sem linha ⇒ ENDED", () => {
    expect(evaluate(null, T0)).toEqual({ state: "ENDED", reason: null });
  });

  it("1. encerrada ⇒ ENDED com o motivo gravado, mesmo dentro dos prazos", () => {
    const ended = row({ endedAt: at(MIN), endReason: "logout" });
    expect(evaluate(ended, at(2 * MIN))).toEqual({ state: "ENDED", reason: "logout" });
  });

  it("2. limite absoluto vence antes do ocioso", () => {
    const r = row({ lastActiveAt: at(10 * DAY) });
    expect(evaluate(r, at(90 * DAY))).toEqual({ state: "EXPIRED", reason: "absolute_90d" });
  });

  it("3. 30 dias sem uso ⇒ EXPIRED(idle_30d)", () => {
    expect(evaluate(row(), at(30 * DAY))).toEqual({ state: "EXPIRED", reason: "idle_30d" });
  });

  it("4. e-mail removido da allowlist ⇒ ENDED(allowlist_removed), antes do bloqueio", () => {
    expect(evaluate(row(), at(20 * MIN), { ok: false })).toEqual({
      state: "ENDED",
      reason: "allowlist_removed",
    });
  });

  it("5. mais de 15 min sem uso ⇒ LOCKED; canUnlock = credencial deste dispositivo", () => {
    expect(evaluate(row(), at(16 * MIN), { cred: true })).toEqual({
      state: "LOCKED",
      canUnlock: true,
    });
    expect(evaluate(row(), at(16 * MIN), { cred: false })).toEqual({
      state: "LOCKED",
      canUnlock: false,
    });
  });

  it("6. ativa; marca para tocar last_active_at só depois de 60 s (throttle)", () => {
    expect(evaluate(row(), at(30_000))).toEqual({ state: "ACTIVE", touch: false });
    expect(evaluate(row(), at(61_000))).toEqual({ state: "ACTIVE", touch: true });
  });
});

describe("evaluateSession — limites exatos", () => {
  it("15 min exatos ainda é ACTIVE; 15 min + 1 ms é LOCKED", () => {
    expect(evaluate(row(), at(15 * MIN)).state).toBe("ACTIVE");
    expect(evaluate(row(), at(15 * MIN + 1)).state).toBe("LOCKED");
  });

  it("30 d − 1 ms é LOCKED; 30 d exatos é EXPIRED", () => {
    expect(evaluate(row(), at(30 * DAY - 1)).state).toBe("LOCKED");
    expect(evaluate(row(), at(30 * DAY)).state).toBe("EXPIRED");
  });

  it("90 d − 1 ms ainda vale (uso recente); 90 d exatos é EXPIRED(absolute_90d)", () => {
    const r = row({ lastActiveAt: at(90 * DAY - 2 * MIN) });
    expect(evaluate(r, at(90 * DAY - 1)).state).toBe("ACTIVE");
    expect(evaluate(r, at(90 * DAY))).toEqual({ state: "EXPIRED", reason: "absolute_90d" });
  });
});

describe("transições proibidas e permitidas", () => {
  const locked = row({ lastActiveAt: T0 });
  const now = at(20 * MIN);

  it("LOCKED → ACTIVE com credencial deste dispositivo: renova o uso, zera falhas", () => {
    const result = unlockTransition({
      row: { ...locked, unlockFailures: 3 },
      now,
      state: evaluate(locked, now),
      credentialDeviceId: "dev-a",
    });
    expect(result).toEqual({ ok: true, patch: { lastActiveAt: now, unlockFailures: 0 } });
  });

  it("desbloqueio nunca altera absolute_expires_at", () => {
    const result = unlockTransition({
      row: locked,
      now,
      state: evaluate(locked, now),
      credentialDeviceId: "dev-a",
    });
    expect(result.ok && Object.keys(result.patch)).not.toContain("absoluteExpiresAt");
  });

  it("LOCKED → ACTIVE com credencial de OUTRO dispositivo é recusado", () => {
    expect(
      unlockTransition({
        row: locked,
        now,
        state: evaluate(locked, now),
        credentialDeviceId: "dev-b",
      }),
    ).toEqual({ ok: false, error: "OTHER_DEVICE" });
  });

  it("ENDED/EXPIRED nunca voltam a ACTIVE (sempre nova sessão)", () => {
    const ended = row({ endedAt: T0, endReason: "logout_all" });
    for (const [r, t] of [
      [ended, at(MIN)],
      [row(), at(31 * DAY)],
      [row(), at(91 * DAY)],
    ] as const) {
      expect(
        unlockTransition({ row: r, now: t, state: evaluate(r, t), credentialDeviceId: "dev-a" }),
      ).toEqual({ ok: false, error: "NOT_LOCKED" });
    }
  });

  it("sessão ACTIVE não é 'desbloqueada' (nada a fazer)", () => {
    const t = at(MIN);
    expect(
      unlockTransition({
        row: row(),
        now: t,
        state: evaluate(row(), t),
        credentialDeviceId: "dev-a",
      }),
    ).toEqual({ ok: false, error: "NOT_LOCKED" });
  });

  it("requisição LOCKED não toca last_active_at (estado não tem 'touch')", () => {
    expect(evaluate(locked, now)).not.toHaveProperty("touch");
  });

  it("falhas de desbloqueio somam até 5 e a 5ª encerra a sessão", () => {
    expect(unlockFailureTransition(row({ unlockFailures: 0 }))).toEqual({
      patch: { unlockFailures: 1 },
      end: null,
    });
    expect(unlockFailureTransition(row({ unlockFailures: 4 }))).toEqual({
      patch: { unlockFailures: 5 },
      end: "unlock_failures",
    });
  });
});
