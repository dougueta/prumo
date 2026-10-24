import "server-only";
import type { RequestInfo } from "./events";

/** Cabeçalho interno com o caminho pedido, posto pelo proxy (Server Components não o conhecem). */
export const PATH_HEADER = "x-prumo-path";

type HeaderReader = { get(name: string): string | null };

/** Dispositivo, IP (primeiro do x-forwarded-for, da Vercel) e cabeçalhos de geo. */
export function requestInfoFrom(headers: HeaderReader): RequestInfo {
  const forwarded = headers.get("x-forwarded-for");
  return {
    userAgent: headers.get("user-agent"),
    ip: forwarded ? forwarded.split(",")[0].trim() || null : null,
    headers,
  };
}

export async function currentRequestInfo(): Promise<RequestInfo> {
  const { headers } = await import("next/headers");
  return requestInfoFrom(await headers());
}
