/**
 * Rate limit (plan §Rate limit; FR-005, R-09). As contagens vêm de uma consulta agregada sobre
 * `access_events`; `countRateLimit` define, em código puro, exatamente o que essa consulta conta.
 * Só `otp_failed` é falha: contar `email_refused` faria o contador por IP crescer apenas para
 * e-mails fora da lista — um oráculo de enumeração (remediação H1).
 */

export const FAILURE_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES = 5;
export const REQUEST_GAP_MS = 60_000;
export const REQUEST_WINDOW_MS = 60 * 60_000;
export const MAX_REQUESTS_PER_WINDOW = 5;

export type RateLimitEvent = {
  type: string;
  emailHash: string | null;
  ipHash: string | null;
  occurredAt: Date;
};

export type RateLimitCounts = {
  /** `otp_failed` do e-mail nos últimos 15 min. */
  failedByEmail: number;
  /** `otp_failed` do IP nos últimos 15 min. */
  failedByIp: number;
  /** `otp_requested` do e-mail nos últimos 60 s. */
  requestsLastMinute: number;
  /** `otp_requested` do e-mail na última hora. */
  requestsLastHour: number;
};

export type RateLimitReason = "rate_email" | "rate_ip" | "throttle_request";
export type RateLimitDecision =
  { decision: "ALLOWED" } | { decision: "BLOCKED"; reason: RateLimitReason };

export function countRateLimit(
  events: readonly RateLimitEvent[],
  { emailHash, ipHash, now }: { emailHash: string; ipHash: string; now: Date },
): RateLimitCounts {
  const since = (ms: number) => (e: RateLimitEvent) => now.getTime() - e.occurredAt.getTime() <= ms;
  const failed = events.filter((e) => e.type === "otp_failed").filter(since(FAILURE_WINDOW_MS));
  const requested = events.filter((e) => e.type === "otp_requested" && e.emailHash === emailHash);
  return {
    failedByEmail: failed.filter((e) => e.emailHash === emailHash).length,
    failedByIp: failed.filter((e) => e.ipHash === ipHash).length,
    requestsLastMinute: requested.filter(since(REQUEST_GAP_MS - 1)).length,
    requestsLastHour: requested.filter(since(REQUEST_WINDOW_MS)).length,
  };
}

export function evaluateRateLimit(
  kind: "request" | "verify",
  counts: RateLimitCounts,
): RateLimitDecision {
  if (counts.failedByEmail >= MAX_FAILURES) return { decision: "BLOCKED", reason: "rate_email" };
  if (counts.failedByIp >= MAX_FAILURES) return { decision: "BLOCKED", reason: "rate_ip" };
  if (
    kind === "request" &&
    (counts.requestsLastMinute >= 1 || counts.requestsLastHour >= MAX_REQUESTS_PER_WINDOW)
  ) {
    return { decision: "BLOCKED", reason: "throttle_request" };
  }
  return { decision: "ALLOWED" };
}
