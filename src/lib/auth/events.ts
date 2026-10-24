import "server-only";
import { z } from "zod";
import { normalizeEmail } from "./allowlist";
import { hmacHex, maskEmail } from "./crypto";
import { describeDevice, geoFromHeaders } from "./device";
import type { AuthStore, EventRow } from "./store";

/**
 * Eventos de acesso (FR-017–FR-019; data-model §4). Gravação só pelo servidor (cliente de
 * serviço). Nunca recebe código, token, senha nem e-mail completo de terceiros: o tipo de entrada
 * é fechado e qualquer campo a mais é recusado.
 */

export const EVENT_TYPES = [
  "otp_requested",
  "otp_failed",
  "email_refused",
  "login_succeeded",
  "login_blocked",
  "provider_error",
  "unlock_enrolled",
  "session_unlocked",
  "unlock_failed",
  "logout",
  "logout_all",
  "session_expired",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const EMAIL_REQUIRED: ReadonlySet<EventType> = new Set([
  "otp_requested",
  "otp_failed",
  "email_refused",
  "login_blocked",
  "login_succeeded",
]);

export type RequestInfo = {
  userAgent: string | null;
  /** Primeiro valor de x-forwarded-for (Vercel); nulo em local. */
  ip: string | null;
  headers: { get(name: string): string | null };
};

const eventInput = z
  .object({
    type: z.enum(EVENT_TYPES),
    reason: z.string().max(30).optional(),
    method: z.enum(["google", "email_otp", "webauthn", "none"]).optional(),
    ownerId: z.string().optional(),
    sessionId: z.string().optional(),
    email: z.string().optional(),
    /** O e-mail é do dono (autorizado)? Se não, guarda-se só a máscara. */
    emailIsOwner: z.boolean().optional(),
    request: z.custom<RequestInfo>((value) => typeof value === "object" && value !== null),
  })
  .strict();

export type EventInput = z.input<typeof eventInput>;

/**
 * Grava o evento. Devolve `false` se o banco recusar — sem repassar a mensagem do banco
 * (FR-019). Entrada inválida (campo proibido, e-mail ausente onde é obrigatório) lança: é erro
 * de programação, não de usuário.
 */
export async function recordEvent(
  input: EventInput,
  { store, hashSecret }: { store: Pick<AuthStore, "insertEvent">; hashSecret: string },
): Promise<boolean> {
  const event = eventInput.parse(input);
  if (EMAIL_REQUIRED.has(event.type) && !event.email) {
    throw new Error(`Evento ${event.type} exige email (email_hash obrigatório)`);
  }
  const email = event.email ? normalizeEmail(event.email) : null;
  const row: EventRow = {
    type: event.type,
    reason: event.reason ?? null,
    method: event.method ?? "none",
    owner_id: event.ownerId ?? null,
    session_id: event.sessionId ?? null,
    email_hash: email ? hmacHex(hashSecret, email) : null,
    email_masked: email && !event.emailIsOwner ? maskEmail(email) : null,
    ip_hash: hmacHex(hashSecret, event.request.ip ?? "local"),
    device_label: describeDevice(event.request.userAgent),
    geo: geoFromHeaders(event.request.headers),
  };
  return store.insertEvent(row);
}
