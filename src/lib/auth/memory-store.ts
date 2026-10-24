import { countRateLimit } from "./rate-limit";
import { ABSOLUTE_MAX_MS } from "./session-state";
import type {
  AuthStore,
  EventRow,
  NewSession,
  OtpHistoryEvent,
  StoredEvent,
  StoredSession,
} from "./store";
import type { EndReason } from "./session-state";

const RETENTION_MS = 90 * 24 * 60 * 60_000;

/** AuthStore em memória: testes de contrato e modo demonstração (nada vai a banco — ADR 0006). */
export class MemoryAuthStore implements AuthStore {
  private events: StoredEvent[] = [];
  private sessions = new Map<string, StoredSession>();
  private credentials: Array<{ ownerId: string; deviceId: string }> = [];
  private nextId = 1;

  async insertEvent(row: EventRow): Promise<boolean> {
    const { occurred_at, ...rest } = row;
    this.events.push({ ...rest, id: this.nextId++, occurredAt: occurred_at ?? new Date() });
    return true;
  }

  async rateLimitCounts(keys: { emailHash: string; ipHash: string; now: Date }) {
    return countRateLimit(
      this.events.map((e) => ({
        type: e.type,
        emailHash: e.email_hash,
        ipHash: e.ip_hash,
        occurredAt: e.occurredAt,
      })),
      keys,
    );
  }

  async otpHistory(emailHash: string): Promise<OtpHistoryEvent[]> {
    return this.events
      .filter(
        (e): e is StoredEvent & { type: OtpHistoryEvent["type"] } =>
          e.email_hash === emailHash &&
          (e.type === "otp_requested" || e.type === "login_succeeded"),
      )
      .map((e) => ({ type: e.type, method: e.method, occurredAt: e.occurredAt }));
  }

  async listEvents({ ownerId, now }: { ownerId: string; now: Date }): Promise<StoredEvent[]> {
    return this.events
      .filter((e) => e.owner_id === ownerId || e.owner_id === null)
      .filter((e) => now.getTime() - e.occurredAt.getTime() <= RETENTION_MS)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id - a.id);
  }

  async insertSession(s: NewSession): Promise<void> {
    if (this.sessions.has(s.id)) return;
    this.sessions.set(s.id, {
      id: s.id,
      ownerId: s.ownerId,
      deviceId: s.deviceId,
      method: s.method,
      deviceLabel: s.deviceLabel,
      createdAt: s.now,
      absoluteExpiresAt: new Date(s.now.getTime() + ABSOLUTE_MAX_MS),
      lastActiveAt: s.now,
      endedAt: null,
      endReason: null,
      unlockFailures: 0,
      webauthnChallenge: null,
      webauthnChallengeExpiresAt: null,
    });
  }

  async getSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) return null;
    const hasDeviceCredential = this.credentials.some(
      (c) => c.ownerId === session.ownerId && c.deviceId === session.deviceId,
    );
    return { session: { ...session }, hasDeviceCredential };
  }

  async touchSession(id: string, now: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session && !session.endedAt) session.lastActiveAt = now;
  }

  async endSession(id: string, reason: EndReason, now: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || session.endedAt) return false;
    session.endedAt = now;
    session.endReason = reason;
    return true;
  }

  async endAllSessions(ownerId: string, reason: EndReason, now: Date): Promise<string[]> {
    const ended: string[] = [];
    for (const session of this.sessions.values()) {
      if (session.ownerId === ownerId && !session.endedAt) {
        session.endedAt = now;
        session.endReason = reason;
        ended.push(session.id);
      }
    }
    return ended;
  }

  async listSessions(ownerId: string): Promise<StoredSession[]> {
    return [...this.sessions.values()]
      .filter((s) => s.ownerId === ownerId && !s.endedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => ({ ...s }));
  }
}
