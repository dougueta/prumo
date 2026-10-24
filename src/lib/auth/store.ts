import type { EventType } from "./events";
import type { RateLimitCounts } from "./rate-limit";
import type { EndReason, SessionRow } from "./session-state";

/**
 * Persistência da 006 (data-model §2–§4) atrás de uma interface: `SupabaseAuthStore` (cliente de
 * serviço, produção/local) e `MemoryAuthStore` (testes de contrato e modo demonstração). As duas
 * passam pela mesma suíte (tests/shared/auth-store-suite.ts).
 */

export type AuthMethod = "google" | "email_otp";

export type StoredSession = SessionRow & {
  id: string;
  ownerId: string;
  method: AuthMethod;
  deviceLabel: string;
  webauthnChallenge: string | null;
  webauthnChallengeExpiresAt: Date | null;
};

export type NewSession = {
  id: string;
  ownerId: string;
  deviceId: string;
  method: AuthMethod;
  deviceLabel: string;
  now: Date;
};

/** Linha pronta para `access_events` (já com hashes e máscara — ver events.ts). */
export type EventRow = {
  type: EventType;
  reason: string | null;
  method: "google" | "email_otp" | "webauthn" | "none";
  owner_id: string | null;
  session_id: string | null;
  email_hash: string | null;
  email_masked: string | null;
  ip_hash: string | null;
  device_label: string;
  geo: string | null;
  /** Só testes (janelas de tempo); o app nunca informa — vale o `now()` do banco. */
  occurred_at?: Date;
};

export type StoredEvent = Omit<EventRow, "occurred_at"> & { id: number; occurredAt: Date };

export type OtpHistoryEvent = {
  type: "otp_requested" | "login_succeeded";
  method: string;
  occurredAt: Date;
};

export interface AuthStore {
  /** Grava um evento; `false` se o banco recusar (sem detalhes). */
  insertEvent(row: EventRow): Promise<boolean>;
  /** Contagens do rate limit (plan §Rate limit) — mesma semântica de `countRateLimit`. */
  rateLimitCounts(keys: { emailHash: string; ipHash: string; now: Date }): Promise<RateLimitCounts>;
  /** `otp_requested` e `login_succeeded` do e-mail (base de `classifyOtpFailure`). */
  otpHistory(emailHash: string): Promise<OtpHistoryEvent[]>;
  /** Eventos do dono e anônimos dos últimos 90 dias, mais recentes primeiro (FR-020). */
  listEvents(keys: { ownerId: string; now: Date }): Promise<StoredEvent[]>;

  /** Cria a sessão (idempotente pelo id); validade absoluta = now + 90 d. */
  insertSession(session: NewSession): Promise<void>;
  /** Sessão + se existe credencial WebAuthn do dono neste `device_id`. */
  getSession(id: string): Promise<{ session: StoredSession; hasDeviceCredential: boolean } | null>;
  /** Atualiza `last_active_at` (só sessão aberta). */
  touchSession(id: string, now: Date): Promise<void>;
  /** Encerra se ainda aberta; `true` se esta chamada encerrou (evento uma vez só). */
  endSession(id: string, reason: EndReason, now: Date): Promise<boolean>;
  /** Encerra todas as sessões abertas do dono; devolve os ids encerrados. */
  endAllSessions(ownerId: string, reason: EndReason, now: Date): Promise<string[]>;
  /** Sessões abertas do dono, mais recentes primeiro (FR-016). */
  listSessions(ownerId: string): Promise<StoredSession[]>;
}
