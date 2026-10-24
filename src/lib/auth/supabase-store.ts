import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FAILURE_WINDOW_MS,
  REQUEST_GAP_MS,
  REQUEST_WINDOW_MS,
  type RateLimitCounts,
} from "./rate-limit";
import { ABSOLUTE_MAX_MS, type EndReason } from "./session-state";
import type {
  AuthStore,
  EventRow,
  NewSession,
  OtpHistoryEvent,
  StoredEvent,
  StoredSession,
} from "./store";

/**
 * AuthStore sobre as tabelas da 006 com o cliente de serviço (único que grava — data-model §5).
 * Janelas do rate limit idênticas a `countRateLimit` (suíte compartilhada).
 */

const RETENTION_MS = 90 * 24 * 60 * 60_000;
const SESSION_COLUMNS =
  "id, owner_id, device_id, method, device_label, created_at, absolute_expires_at, last_active_at, unlock_failures, webauthn_challenge, webauthn_challenge_expires_at, ended_at, end_reason";

type SessionDbRow = {
  id: string;
  owner_id: string;
  device_id: string;
  method: StoredSession["method"];
  device_label: string;
  created_at: string;
  absolute_expires_at: string;
  last_active_at: string;
  unlock_failures: number;
  webauthn_challenge: string | null;
  webauthn_challenge_expires_at: string | null;
  ended_at: string | null;
  end_reason: EndReason | null;
};

const date = (value: string | null) => (value ? new Date(value) : null);

function toSession(row: SessionDbRow): StoredSession {
  return {
    id: row.id,
    ownerId: row.owner_id,
    deviceId: row.device_id,
    method: row.method,
    deviceLabel: row.device_label,
    createdAt: new Date(row.created_at),
    absoluteExpiresAt: new Date(row.absolute_expires_at),
    lastActiveAt: new Date(row.last_active_at),
    unlockFailures: row.unlock_failures,
    webauthnChallenge: row.webauthn_challenge,
    webauthnChallengeExpiresAt: date(row.webauthn_challenge_expires_at),
    endedAt: date(row.ended_at),
    endReason: row.end_reason,
  };
}

function check<T>(result: { data: T; error: unknown }, what: string): T {
  if (result.error) throw new Error(`AuthStore: falha ao ${what}`);
  return result.data;
}

export class SupabaseAuthStore implements AuthStore {
  constructor(private readonly db: SupabaseClient) {}

  async insertEvent(row: EventRow): Promise<boolean> {
    const { occurred_at, ...rest } = row;
    const record: Record<string, unknown> = occurred_at
      ? { ...rest, occurred_at: occurred_at.toISOString() }
      : rest;
    const { error } = await this.db.from("access_events").insert(record);
    return !error;
  }

  async rateLimitCounts({
    emailHash,
    ipHash,
    now,
  }: {
    emailHash: string;
    ipHash: string;
    now: Date;
  }): Promise<RateLimitCounts> {
    const since = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const count = async (type: string, column: string, value: string, ms: number) => {
      const { count, error } = await this.db
        .from("access_events")
        .select("id", { count: "exact", head: true })
        .eq("type", type)
        .eq(column, value)
        .gte("occurred_at", since(ms))
        .lte("occurred_at", now.toISOString());
      if (error) throw new Error("AuthStore: falha ao contar tentativas");
      return count ?? 0;
    };
    const [failedByEmail, failedByIp, requestsLastMinute, requestsLastHour] = await Promise.all([
      count("otp_failed", "email_hash", emailHash, FAILURE_WINDOW_MS),
      count("otp_failed", "ip_hash", ipHash, FAILURE_WINDOW_MS),
      count("otp_requested", "email_hash", emailHash, REQUEST_GAP_MS - 1),
      count("otp_requested", "email_hash", emailHash, REQUEST_WINDOW_MS),
    ]);
    return { failedByEmail, failedByIp, requestsLastMinute, requestsLastHour };
  }

  async otpHistory(emailHash: string): Promise<OtpHistoryEvent[]> {
    const rows = check(
      await this.db
        .from("access_events")
        .select("type, method, occurred_at")
        .eq("email_hash", emailHash)
        .in("type", ["otp_requested", "login_succeeded"])
        .order("occurred_at", { ascending: false })
        .limit(50),
      "ler histórico de código",
    );
    return (rows ?? []).map((r) => ({
      type: r.type as OtpHistoryEvent["type"],
      method: r.method as string,
      occurredAt: new Date(r.occurred_at as string),
    }));
  }

  async listEvents({ ownerId, now }: { ownerId: string; now: Date }): Promise<StoredEvent[]> {
    const rows = check(
      await this.db
        .from("access_events")
        .select("*")
        .or(`owner_id.eq.${ownerId},owner_id.is.null`)
        .gte("occurred_at", new Date(now.getTime() - RETENTION_MS).toISOString())
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(500),
      "listar eventos",
    );
    return (rows ?? []).map(({ occurred_at, ...rest }) => ({
      ...(rest as Omit<StoredEvent, "occurredAt">),
      occurredAt: new Date(occurred_at as string),
    }));
  }

  async insertSession(s: NewSession): Promise<void> {
    check(
      await this.db.from("app_sessions").upsert(
        {
          id: s.id,
          owner_id: s.ownerId,
          device_id: s.deviceId,
          method: s.method,
          device_label: s.deviceLabel,
          created_at: s.now.toISOString(),
          last_active_at: s.now.toISOString(),
          absolute_expires_at: new Date(s.now.getTime() + ABSOLUTE_MAX_MS).toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
      "criar sessão",
    );
  }

  async getSession(id: string) {
    const row = check(
      await this.db.from("app_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle(),
      "ler sessão",
    ) as SessionDbRow | null;
    if (!row) return null;
    const { count, error } = await this.db
      .from("webauthn_credentials")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", row.owner_id)
      .eq("device_id", row.device_id);
    if (error) throw new Error("AuthStore: falha ao ler credenciais");
    return { session: toSession(row), hasDeviceCredential: (count ?? 0) > 0 };
  }

  async touchSession(id: string, now: Date): Promise<void> {
    check(
      await this.db
        .from("app_sessions")
        .update({ last_active_at: now.toISOString() })
        .eq("id", id)
        .is("ended_at", null),
      "atualizar sessão",
    );
  }

  async endSession(id: string, reason: EndReason, now: Date): Promise<boolean> {
    const rows = check(
      await this.db
        .from("app_sessions")
        .update({ ended_at: now.toISOString(), end_reason: reason })
        .eq("id", id)
        .is("ended_at", null)
        .select("id"),
      "encerrar sessão",
    );
    return (rows ?? []).length > 0;
  }

  async endAllSessions(ownerId: string, reason: EndReason, now: Date): Promise<string[]> {
    const rows = check(
      await this.db
        .from("app_sessions")
        .update({ ended_at: now.toISOString(), end_reason: reason })
        .eq("owner_id", ownerId)
        .is("ended_at", null)
        .select("id"),
      "encerrar sessões",
    );
    return (rows ?? []).map((r) => r.id as string);
  }

  async listSessions(ownerId: string): Promise<StoredSession[]> {
    const rows = check(
      await this.db
        .from("app_sessions")
        .select(SESSION_COLUMNS)
        .eq("owner_id", ownerId)
        .is("ended_at", null)
        .order("created_at", { ascending: false }),
      "listar sessões",
    ) as SessionDbRow[];
    return rows.map(toSession);
  }
}
