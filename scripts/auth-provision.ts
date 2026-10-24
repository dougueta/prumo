// `npm run auth:provision` — cria no Supabase Auth os usuários de AUTH_ALLOWED_EMAILS (006 · T017).
// Local/CI: lê .env.local ou o ambiente. Produção: rodar com as variáveis de produção (T051).
import { provision, scriptEnv, serviceClient } from "./auth-tools";

const env = scriptEnv();
provision(env.AUTH_ALLOWED_EMAILS, serviceClient().auth.admin, (line) => console.log(line)).catch(
  (error: Error) => {
    console.error(error.message);
    process.exit(1);
  },
);
