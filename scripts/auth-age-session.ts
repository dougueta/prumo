// `npm run auth:age-session -- --minutes N | --days N` — SÓ LOCAL (006 · T017). Envelhece as
// sessões abertas do primeiro e-mail da allowlist para testar bloqueio (15 min), ocioso (30 d) e
// limite absoluto (90 d) sem esperar.
import { agePatch, assertLocal, parseAgeArgs, scriptEnv, serviceClient } from "./auth-tools";

async function main() {
  const env = scriptEnv();
  assertLocal(env.APP_ENV);
  const args = parseAgeArgs(process.argv.slice(2));
  const client = serviceClient();

  const { data: users, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error("Admin API falhou ao listar usuários.");
  const owner = users.users.find((u) => u.email?.toLowerCase() === env.AUTH_ALLOWED_EMAILS[0]);
  if (!owner)
    throw new Error("Usuário da allowlist não provisionado: rode npm run auth:provision.");

  const { data: sessions, error } = await client
    .from("app_sessions")
    .select("id, created_at, absolute_expires_at, last_active_at")
    .eq("owner_id", owner.id)
    .is("ended_at", null);
  if (error) throw new Error("Não foi possível ler app_sessions.");

  for (const session of sessions) {
    const { error: updateError } = await client
      .from("app_sessions")
      .update(agePatch(session, args))
      .eq("id", session.id);
    if (updateError) throw new Error("Não foi possível atualizar app_sessions.");
  }
  console.log(`${sessions.length} sessão(ões) envelhecida(s).`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
