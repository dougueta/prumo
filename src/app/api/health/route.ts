import { appVersion, loadEnv } from "@/lib/env";
import { checkHealth, pingDatabase } from "@/lib/health";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { APP_ENV } = loadEnv();
  const { httpStatus, body } = await checkHealth({
    appEnv: APP_ENV,
    version: appVersion(),
    ping: APP_ENV === "preview" ? async () => {} : pingDatabase(createServerClient()),
  });
  return Response.json(body, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
