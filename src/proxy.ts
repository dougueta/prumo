import { NextResponse, type NextRequest } from "next/server";
import { applyDemoSessionCookie } from "@/lib/demo-session-cookie";
import { loadEnv } from "@/lib/env";
import { isExemptPath } from "@/lib/production-gate";

/**
 * 006 · provisório (T010 → T028): a trava Basic da 001 saiu da configuração (FR-028) e o login
 * ainda não está ligado ao proxy. Até a T028, produção falha FECHADA em tudo que não é público.
 * Esta versão nunca é implantada: a branch só vai à main com a T028.
 */
export function proxy(request: NextRequest) {
  const env = loadEnv();
  if (env.APP_ENV === "production" && !isExemptPath(request.nextUrl.pathname)) {
    return new NextResponse("Acesso restrito.", { status: 401 });
  }
  // 004: sessão do modo demonstração (só em preview)
  return applyDemoSessionCookie(request, NextResponse.next(), env.APP_ENV);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
