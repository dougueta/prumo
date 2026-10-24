import type { NextRequest, NextResponse } from "next/server";
import type { AppEnv } from "@/lib/env";

/**
 * Feature 004 · contracts/owner-context.md — sessão do modo demonstração. Só em APP_ENV=preview,
 * emite `prumo_demo_sid` (UUID v4) se ausente. Independe da trava de produção da 001; a 006, ao
 * reescrever o proxy, preserva este tratamento.
 */
export const DEMO_SESSION_COOKIE = "prumo_demo_sid";
const TWO_HOURS_S = 2 * 60 * 60;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function applyDemoSessionCookie(
  request: NextRequest,
  response: NextResponse,
  appEnv: AppEnv,
): NextResponse {
  if (appEnv !== "preview" || request.cookies.has(DEMO_SESSION_COOKIE)) return response;
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: crypto.randomUUID(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TWO_HOURS_S,
    secure: !LOCAL_HOSTS.has(request.nextUrl.hostname),
  });
  return response;
}
