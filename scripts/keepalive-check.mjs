// Keepalive da produção (spec 001, FR-023). Chamado diariamente pelo workflow keepalive.yml.
// GET /api/health executa public.health_ping() no banco: isso gera atividade e evita a pausa
// do plano gratuito. Se algo estiver errado, sai com código 1 → o GitHub avisa o Doug por e-mail.

/** @returns {{ ok: boolean, reason: string }} */
export function evaluateKeepalive(httpStatus, body) {
  if (httpStatus === 503) {
    return {
      ok: false,
      reason: "Banco de produção inacessível (pode estar pausado por inatividade).",
    };
  }
  if (httpStatus !== 200 || !body || typeof body !== "object") {
    return { ok: false, reason: `Resposta inesperada do health (HTTP ${httpStatus}).` };
  }
  if (body.environment !== "production") {
    return { ok: false, reason: "O endereço verificado não é a produção." };
  }
  if (body.status !== "ok" || body.data?.status !== "ok") {
    return { ok: false, reason: "Produção degradada." };
  }
  return { ok: true, reason: "Produção saudável." };
}

async function main() {
  const base = process.env.PRODUCTION_URL;
  if (!base) {
    console.error("PRODUCTION_URL não definida (segredo do repositório).");
    process.exit(1);
  }
  let status = 0;
  let body = null;
  try {
    const response = await fetch(new URL("/api/health", base), { cache: "no-store" });
    status = response.status;
    body = await response.json().catch(() => null);
  } catch {
    status = 0;
  }
  const result = evaluateKeepalive(status, body);
  console.log(result.reason);
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1]?.endsWith("keepalive-check.mjs")) await main();
