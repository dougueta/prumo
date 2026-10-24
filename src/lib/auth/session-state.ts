/**
 * Máquina de estados da sessão (plan §Máquina de estados; FR-010, FR-011, FR-012). Pura: o
 * relógio e os fatos do banco são injetados; quem chama aplica os efeitos.
 */

export const LOCK_AFTER_MS = 15 * 60_000;
export const IDLE_MAX_MS = 30 * 24 * 60 * 60_000;
export const TOUCH_THROTTLE_MS = 60_000;
export const MAX_UNLOCK_FAILURES = 5;

export type EndReason =
  "logout" | "logout_all" | "idle_30d" | "absolute_90d" | "unlock_failures" | "allowlist_removed";

export type SessionRow = {
  deviceId: string;
  createdAt: Date;
  absoluteExpiresAt: Date;
  lastActiveAt: Date;
  endedAt: Date | null;
  endReason: EndReason | null;
  unlockFailures: number;
};

export type SessionState =
  | { state: "ACTIVE"; touch: boolean }
  | { state: "LOCKED"; canUnlock: boolean }
  | { state: "EXPIRED"; reason: "absolute_90d" | "idle_30d" }
  | { state: "ENDED"; reason: EndReason | null };

export function evaluateSession({
  row,
  now,
  hasDeviceCredential,
  emailAllowed,
}: {
  row: SessionRow | null;
  now: Date;
  /** Existe credencial WebAuthn com `device_id` = o desta sessão. */
  hasDeviceCredential: boolean;
  /** E-mail do JWT ainda está em AUTH_ALLOWED_EMAILS. */
  emailAllowed: boolean;
}): SessionState {
  if (!row || row.endedAt) return { state: "ENDED", reason: row?.endReason ?? null };
  if (now.getTime() >= row.absoluteExpiresAt.getTime()) {
    return { state: "EXPIRED", reason: "absolute_90d" };
  }
  const idle = now.getTime() - row.lastActiveAt.getTime();
  if (idle >= IDLE_MAX_MS) return { state: "EXPIRED", reason: "idle_30d" };
  if (!emailAllowed) return { state: "ENDED", reason: "allowlist_removed" };
  if (idle > LOCK_AFTER_MS) return { state: "LOCKED", canUnlock: hasDeviceCredential };
  return { state: "ACTIVE", touch: idle > TOUCH_THROTTLE_MS };
}

/**
 * Desbloqueio após asserção WebAuthn já verificada no servidor. Só de LOCKED e só com credencial
 * deste dispositivo; nunca mexe em `absoluteExpiresAt`.
 */
export function unlockTransition({
  row,
  now,
  state,
  credentialDeviceId,
}: {
  row: SessionRow;
  now: Date;
  state: SessionState;
  credentialDeviceId: string;
}):
  | { ok: true; patch: { lastActiveAt: Date; unlockFailures: 0 } }
  | { ok: false; error: "NOT_LOCKED" | "OTHER_DEVICE" } {
  if (state.state !== "LOCKED") return { ok: false, error: "NOT_LOCKED" };
  if (credentialDeviceId !== row.deviceId) return { ok: false, error: "OTHER_DEVICE" };
  return { ok: true, patch: { lastActiveAt: now, unlockFailures: 0 } };
}

/** Falha de desbloqueio: soma; a 5ª encerra a sessão (FR-012). */
export function unlockFailureTransition(row: SessionRow): {
  patch: { unlockFailures: number };
  end: "unlock_failures" | null;
} {
  const unlockFailures = Math.min(row.unlockFailures + 1, MAX_UNLOCK_FAILURES);
  return {
    patch: { unlockFailures },
    end: unlockFailures >= MAX_UNLOCK_FAILURES ? "unlock_failures" : null,
  };
}
