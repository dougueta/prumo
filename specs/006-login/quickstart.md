# Quickstart — Login (após a implementação da 006)

Pré-requisitos da 001 (Node 24, Docker Desktop aberto, Supabase CLI). Windows: Git Bash.

```bash
npm ci
npm run dev:setup          # supabase start + migrações + .env.local (agora com
                           # SUPABASE_PUBLISHABLE_KEY, AUTH_HASH_SECRET aleatório, APP_ORIGIN)
# edite .env.local: AUTH_ALLOWED_EMAILS=<seu e-mail de teste>
npm run auth:provision     # cria o usuário permitido no Supabase local (cadastro é desligado)
npm run dev                # http://localhost:3000  (use localhost, nunca 127.0.0.1: WebAuthn
                           # não aceita IP como RP ID)
```

Entrar localmente (código por e-mail):
1. Abra `http://localhost:3000` ⇒ redireciona para `/entrar`.
2. Informe o e-mail permitido ⇒ abra o Mailpit em `http://localhost:57324` e copie o código.
3. Digite o código ⇒ tela inicial. Em **Mais → Segurança** (`/mais/seguranca`): sessões,
   histórico e "Ativar desbloqueio por biometria" neste dispositivo (no desktop: Windows Hello /
   Touch ID, se houver; até 10 min após entrar).

O Prumo é somente web: o Google funciona em qualquer navegador (desktop e celular). No PWA
instalado na tela inicial do iOS, se o Google não concluir, use o código por e-mail.

Google local (opcional): defina `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` e
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` no ambiente antes de `supabase start` e adicione
`http://127.0.0.1:57321/auth/v1/callback` como redirect no cliente OAuth de desenvolvimento.

Simular bloqueio por inatividade sem esperar 15 min:
```bash
npm run auth:age-session -- --minutes 16   # só APP_ENV=local; recua last_active_at da sessão mais recente
```

Testes:
```bash
npm run check                 # unit + contrato de auth (máquina de estados, rate limit, DAL…)
npm run test:contract         # só os testes de contrato (MSW, sem rede)
npm run test:integration      # RLS, gatilho somente-inserção, sessões/eventos no Supabase local
npm run test:e2e              # login OTP (Mailpit), recusa, bloqueio, WebAuthn virtual, demo
```

Modo demonstração:
```bash
npm run dev:demo              # entra direto como "Usuário Demonstração"; código de teste 246810
                              # (o script ignora SUPABASE_*, AUTH_* e APP_ORIGIN do .env.local)
```

Problemas comuns:
- `Configuração inválida: AUTH_ALLOWED_EMAILS` ⇒ preencha no `.env.local`.
- Código não chega ⇒ Mailpit em `:57324`; em produção, ver limite do SMTP (research R-07).
- "Desbloquear" não aparece ⇒ dispositivo sem autenticador de plataforma ou sem credencial
  cadastrada **neste** dispositivo ⇒ após 15 min o app pede entrada completa (FR-012).
- WebAuthn falha com "invalid domain" ⇒ você abriu por `127.0.0.1`; use `localhost`.
