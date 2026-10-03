import { NextResponse, type NextRequest } from "next/server";
import { loadEnv } from "@/lib/env";
import { evaluateGate } from "@/lib/production-gate";

/** Trava provisória de produção (FR-013). Substituída pela autenticação da feature 006. */
export function proxy(request: NextRequest) {
  const env = loadEnv();
  const decision = evaluateGate({
    appEnv: env.APP_ENV,
    path: request.nextUrl.pathname,
    authorization: request.headers.get("authorization"),
    credentials:
      env.APP_ENV === "production"
        ? { user: env.PRODUCTION_GATE_USER, password: env.PRODUCTION_GATE_PASSWORD }
        : { user: "", password: "" },
  });

  if (decision === "allow") return NextResponse.next();
  return new NextResponse("Acesso restrito.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Prumo", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
