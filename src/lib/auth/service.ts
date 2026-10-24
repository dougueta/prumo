import type { RequestInfo } from "./events";

/**
 * Contrato do serviço de autenticação (contracts/auth-flows.md §4–§5; Constitution VII): uma
 * implementação real (Supabase) e uma de demonstração (memória, só preview). Quem escolhe é
 * `getAuthService()`, exclusivamente por `loadEnv().APP_ENV` (FR-026).
 */

/** Contexto da sessão autorizada (contracts/dal.md). */
export type SessionContext = {
  userId: string;
  sessionId: string;
  deviceId: string;
  email: string;
  isDemo: boolean;
};

export type RequestCodeResult = { ok: true } | { ok: false; error: "INVALID_EMAIL" | "TOO_MANY" };

export type VerifyCodeError = "WRONG_CODE" | "EXPIRED_OR_USED" | "TOO_MANY" | "UNAVAILABLE";
export type VerifyCodeResult = { ok: true; next: string } | { ok: false; error: VerifyCodeError };

export type GoogleStartResult = { ok: true; url: string } | { ok: false; error: "UNAVAILABLE" };

export type GoogleCallbackResult =
  { ok: true; next: string } | { ok: false; error: "REFUSED" | "UNAVAILABLE" };

export interface AuthService {
  readonly kind: "supabase" | "demo";
  requestCode(input: { email: string; request: RequestInfo }): Promise<RequestCodeResult>;
  verifyCode(input: {
    code: string;
    next: string;
    request: RequestInfo;
  }): Promise<VerifyCodeResult>;
  startGoogle(input: { next: string; request: RequestInfo }): Promise<GoogleStartResult>;
  completeGoogle(input: {
    code: string | null;
    error: string | null;
    request: RequestInfo;
  }): Promise<GoogleCallbackResult>;
}
