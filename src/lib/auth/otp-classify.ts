/**
 * Por que a verificação do código falhou (research R-06). O Supabase responde igual para código
 * errado e expirado; o histórico do mesmo `email_hash` decide.
 */
export const OTP_TTL_MS = 10 * 60_000;

export type OtpEvent = {
  type: "otp_requested" | "login_succeeded" | (string & {});
  method?: string;
  occurredAt: Date;
};

export type OtpFailure = "expired" | "used" | "wrong_code";

export function classifyOtpFailure(events: readonly OtpEvent[], now: Date): OtpFailure {
  const lastRequest = events
    .filter((e) => e.type === "otp_requested")
    .reduce<Date | null>(
      (latest, e) => (!latest || e.occurredAt > latest ? e.occurredAt : latest),
      null,
    );
  if (!lastRequest || now.getTime() - lastRequest.getTime() > OTP_TTL_MS) return "expired";
  const usedAfter = events.some(
    (e) => e.type === "login_succeeded" && e.method === "email_otp" && e.occurredAt > lastRequest,
  );
  return usedAfter ? "used" : "wrong_code";
}
