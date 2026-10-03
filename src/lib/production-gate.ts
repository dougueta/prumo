import type { AppEnv } from "@/lib/env";

/** Contrato: specs/001-setup-projeto/contracts/production-gate.md — removida pela feature 006. */

const EXEMPT_EXACT = new Set(["/api/health", "/manifest.webmanifest", "/sw.js", "/~offline"]);

export function isExemptPath(path: string): boolean {
  return EXEMPT_EXACT.has(path) || path.startsWith("/icons/");
}

/** Comparação em tempo constante (não vaza tamanho nem posição da diferença). */
export function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

type GateInput = {
  appEnv: AppEnv;
  path: string;
  authorization: string | null;
  credentials: { user: string; password: string };
};

export function evaluateGate({ appEnv, path, authorization, credentials }: GateInput) {
  if (appEnv !== "production" || isExemptPath(path)) return "allow" as const;
  if (!authorization?.startsWith("Basic ")) return "challenge" as const;

  let decoded: string;
  try {
    decoded = atob(authorization.slice("Basic ".length).trim());
  } catch {
    return "challenge" as const;
  }
  const separator = decoded.indexOf(":");
  const user = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";

  // Avalia as duas comparações sempre (sem curto-circuito).
  const userOk = safeEqual(user, credentials.user);
  const passwordOk = safeEqual(password, credentials.password);
  return userOk && passwordOk ? ("allow" as const) : ("challenge" as const);
}
