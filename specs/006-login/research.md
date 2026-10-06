# Research — 006 · Login

Fatos verificados em 2026-10-02 (docs do Next 16.3 instaladas em `node_modules/next/dist/docs/`,
docs do Supabase Auth, `npm view`). Base: implementação da 001 (branch `001-setup-projeto`).
Revisado em 2026-10-05 (remediação pós-analyze e decisões transversais da onda 1): R-02, R-05,
R-06, R-09, R-10, R-11, R-12, R-15 e novos R-16 a R-19.

## R-01 · Provedor de identidade
- **Decision**: **Supabase Auth** (já na stack, ADR 0002) para identidade — Google OAuth +
  OTP por e-mail — com **sessões controladas pelo app** por cima (R-04).
- **Rationale**: Google e OTP por e-mail são nativos e gratuitos (plano Free: 50k MAU). O Auth
  emite o JWT com `sub` = `auth.users.id`, que a 004 usa no RLS (`owner_id = auth.uid()`).
- **Alternatives**: Auth.js/Better Auth (identidade fora do Supabase → RLS com `auth.uid()`
  exigiria JWT próprio assinado; mais peças); Clerk (custo/limite e dados fora da stack).

## R-02 · Auth 100% no servidor (sem cliente Supabase no navegador)
- **Decision**: todo fluxo de auth roda no servidor (Server Actions + Route Handlers + `proxy.ts`)
  com `@supabase/ssr` 0.12 (`createServerClient` com `cookies` do Next). **Não existe cliente
  Supabase no navegador**; nenhuma variável `NEXT_PUBLIC_SUPABASE_*`.
- **Rationale**: resolve o desvio da 001 (variáveis `NEXT_PUBLIC_*` são embutidas no build e
  impediriam o mesmo build de servir `local` e `preview`). Permite cookies **HttpOnly**
  (FR-023): sobrescrevemos as opções em `setAll` (`httpOnly: true`, `secure` fora de `local`,
  `sameSite: "lax"`, `path: "/"`) com **uma única** função `authCookieOptions()`, usada tanto no
  adaptador de `cookies()` (Server Actions/Route Handlers) quanto no de
  `NextRequest/NextResponse` do proxy — o padrão do `@supabase/ssr` não usa HttpOnly (pensado
  para o cliente de navegador), então o refresh no proxy precisa da mesma sobrescrita. Nova chave `SUPABASE_PUBLISHABLE_KEY` é lida **só no servidor
  em runtime** (não é segredo, mas não precisa ir ao navegador).
- **Alternatives**: entregar a chave publicável ao navegador em runtime via endpoint (funciona,
  mas cookies deixariam de ser HttpOnly e o JS do client teria tokens — pior para FR-023).

## R-03 · Lista de autorizados (allowlist) e bloqueio de cadastro
- **Decision**: (1) cadastro desligado no Supabase (`enable_signup = false` local; "Allow new
  users to sign up" desligado no painel de produção); (2) o usuário do Doug é criado uma única
  vez por script `npm run auth:provision` (admin API, `email_confirm: true`) a partir de
  `AUTH_ALLOWED_EMAILS`; (3) o app checa a allowlist **antes** de pedir OTP e **depois** de
  qualquer entrada (defesa em profundidade) — e-mail do JWT ∉ allowlist ⇒ sessão revogada.
- **Rationale**: com cadastro desligado, uma conta Google desconhecida nunca vira usuário. A
  allowlist fica só no servidor (FR-022) e o e-mail real não entra no repositório (Constitution
  II) — por isso **não** usamos hook "before user created" com tabela de e-mails versionada.
- **Linking**: o Supabase vincula automaticamente a identidade Google a um usuário existente com
  o mesmo e-mail verificado — o Doug entra pelo Google sem cadastro prévio do provedor.

## R-04 · Sessão: 30 dias renovável, máx. 90, revogação ≤ 1 min
- **Fato**: no Supabase, *time-box*, *inactivity timeout* e *single session* são **só do plano
  Pro**; refresh tokens não expiram; o access token (JWT, 1 h) carrega o claim `session_id` e
  continua válido até expirar mesmo após logout.
- **Decision**: tabela própria `app_sessions` (dona: 006), chave = `session_id` do JWT. A cada
  requisição protegida, o DAL (`requireSession`) valida o JWT (`getClaims`) **e** a linha em
  `app_sessions` (não revogada, `now < absolute_expires_at`, `now − last_active_at < 30 d`).
  Revogar = marcar a linha (efeito imediato, atende FR-015 ≤ 1 min) + revogar no Supabase
  (`auth.admin.signOut(jwt, scope)`) para matar o refresh token.
- **Rationale**: cumpre FR-010/011/015 no plano Free, com o relógio do servidor (FR-011).
  Padrão "Database Sessions" + DAL do guia `authentication.md` do Next 16.
- **Alternatives**: Supabase Pro (US$ 25/mês, fora do teto); JWT curto de 1 min (mais refresh,
  não resolve 30/90 dias).

## R-05 · Desbloqueio por biometria/PIN (WebAuthn local)
- **Decision**: WebAuthn próprio com **`@simplewebauthn/server` 14 + `@simplewebauthn/browser`
  14**: credencial de plataforma (`authenticatorAttachment: "platform"`,
  `userVerification: "required"`) cadastrada por dispositivo após a entrada completa; no
  desbloqueio, o servidor verifica a asserção e só então volta a servir dados. O bloqueio é
  **imposto no servidor** (estado `LOCKED` derivado de `last_active_at`), não só uma tela.
  **Vínculo ao dispositivo** (remediação M3): cookie HttpOnly `prumo_device` (UUID, 400 d) gravado
  na entrada completa; `app_sessions.device_id` e `webauthn_credentials.device_id`;
  `allowCredentials` só com as credenciais daquele dispositivo. Sem isso, um computador sem
  credencial ofereceria "Desbloquear" com a credencial do celular (fluxo híbrido via QR).
- **Rationale**: o Supabase lançou passkeys em **beta** (maio/2026), voltadas a login de
  primeiro fator e com helpers de navegador — exigiria cliente Supabase no browser (R-02) e
  dependência beta para um dado financeiro. SimpleWebAuthn é maduro, MIT, sem custo.
- **Suporte real**: WebAuthn com Face ID/Touch ID funciona no Safari e no PWA de tela inicial
  do iOS 16+ e no Chrome Android (Android 9+ com bloqueio de tela). **Riscos**: chamada precisa partir de
  gesto do usuário (botão "Desbloquear", nunca automático no load); iOS sincroniza a credencial
  via iCloud Keychain (aceito: qualquer credencial do Doug desbloqueia). Sem suporte ou sem
  credencial ⇒ FR-012 exige entrada completa. Verificação manual em aparelho real é task.

## R-06 · OTP de 6 dígitos (sem link mágico)
- **Decision**: `signInWithOtp({ email, options: { shouldCreateUser: false } })` + template de
  e-mail com `{{ .Token }}` (sem `{{ .ConfirmationURL }}`); `verifyOtp({ email, token,
  type: "email" })`. Config: `otp_length = 6`, `otp_expiry = 600` (FR-004), `max_frequency =
  "60s"`. Novo pedido substitui o token anterior (uso único nativo).
- **Classificação do erro**: o Supabase responde igual para código errado e expirado; o app
  classifica pelo histórico (`access_events`): último `otp_requested` > 10 min ⇒ `expired`;
  `login_succeeded` (com o mesmo `email_hash`, gravado obrigatoriamente) posterior ao pedido
  ⇒ `used`; senão `wrong_code`.
- **Rationale**: o código é digitado dentro da própria página/PWA — link mágico abriria no
  Safari fora do PWA instalado no iOS (FR-003).

## R-07 · Envio de e-mail e custo (⚠️ decisão do Doug na implementação)
- **Fato**: o SMTP padrão do Supabase hospedado envia **2 e-mails/hora** e só para membros da
  organização, sem SLA. Com SMTP próprio, o limite inicial é 30/h (ajustável).
- **Decision (recomendada)**: SMTP do **Resend** no plano gratuito (3.000/mês, 100/dia; no
  plano free só entrega para o e-mail da conta Resend — que será o e-mail autorizado do Doug,
  então atende 1 usuário). Remetente `onboarding@resend.dev` (sem domínio próprio).
  **Custo R$ 0.** Configuração no painel do Supabase (segredo fica lá, não na Vercel).
- **Fallback aceitável**: manter o SMTP padrão (2/h) — o código é só a reserva do Google; o
  limite de FR-005 (5/h) fica efetivamente 2/h em produção. Registrar no README.
- **Alternatives**: Gmail SMTP com senha de app (dá poder de envio total da conta Gmail a um
  segredo — rejeitado); Brevo (remetente gmail via terceiro tende a falhar DMARC).

## R-08 · Google OAuth (⚠️ ação externa)
- **Decision**: cliente OAuth "Web" no Google Cloud (gratuito), escopos básicos
  (`openid email profile` — não sensíveis, sem verificação do Google), tela de consentimento
  publicada ("In production") para não depender de lista de testadores. Redirect URI =
  callback do Supabase (`https://<ref>.supabase.co/auth/v1/callback`). Client ID/secret ficam
  no painel do Supabase (produção) e em `.env.local` via `env(...)` no `config.toml` (local,
  opcional).
- **Fluxo**: PKCE server-side — Server Action chama `signInWithOAuth({ provider: "google",
  options: { redirectTo: APP_ORIGIN + "/auth/callback" } })` e redireciona; o Route Handler
  `/auth/callback` faz `exchangeCodeForSession(code)` (verifier no cookie HttpOnly).
- **Escopo (Gate 2, 2026-10-05)**: o Prumo é somente web — sem app nativo. Google é MUST em
  qualquer navegador (desktop e mobile, inclusive Safari no iPhone): fluxo PKCE comum de
  navegador, coberto por E2E em Chromium e WebKit, desktop e emulação mobile (T078), mais
  contrato do callback (T020).
- **Risco aceito — só no modo PWA instalado do iOS**: a navegação para `accounts.google.com` sai
  do escopo do PWA (abre numa folha do navegador) e o PWA de tela inicial tem cookies separados
  do Safari, então o retorno pode não encontrar o verifier PKCE. Ali o Google é SHOULD e o
  código por e-mail é o caminho garantido (funciona 100% dentro do PWA); a tela oferece o código
  quando o Google falha. Observação em iPhone real no pós-merge (T036), sem efeito de aceite.
- **CI/local**: sem credenciais Google; o E2E T078 verifica no navegador o início do fluxo
  (redirect PKCE para `<SUPABASE_URL>/auth/v1/authorize?provider=google`, `redirect_to` =
  `APP_ORIGIN/auth/callback`, verifier em cookie HttpOnly) e o retorno ao `/auth/callback`
  (erro ⇒ oferta do código), interceptando a ida ao provedor; a lógica do callback é testada com cliente Supabase
  simulado (unit/contrato). E2E usa o fluxo OTP com o **Mailpit** do Supabase CLI (porta
  57324) para ler o código.

## R-09 · Rate limit e resposta neutra
- **Decision**: contagem em janelas deslizantes sobre `access_events` (sem tabela extra),
  chaves `email_hash`/`ip_hash` = HMAC-SHA256(`AUTH_HASH_SECRET`, valor normalizado). Limites:
  FR-005 (5 verificações falhas/15 min por e-mail e por IP; 1 pedido/60 s e 5/h por e-mail).
  **Só `otp_failed` conta como falha** (remediação H1): contar `email_refused` fazia o contador
  por IP crescer apenas para e-mails não autorizados — oráculo de enumeração. O limite extra de
  10 pedidos/h por IP foi retirado (não está na spec; X). Resposta de `requestCode` com **piso
  de 1.500 ms** e de falhas de `verifyCode` com piso de 1.000 ms, mesmo texto para qualquer
  caso (FR-002, SC-002).
- **Conflito resolvido**: se o provedor de e-mail falhar, a resposta continua neutra (FR-002
  prevalece sobre a mensagem de indisponibilidade da spec); o evento `provider_error` aparece
  no histórico. Falhas do Google (callback) mostram a mensagem de indisponibilidade — não
  revelam nada sobre e-mails.
- **Alternatives**: Upstash/Redis (serviço extra); limites nativos do Supabase sozinhos (por IP,
  não por e-mail, e não registram eventos).

## R-10 · Proxy (Next 16) e DAL
- **Fatos (docs instaladas)**: `middleware` virou `proxy.ts`, roda em **Node.js** por padrão;
  o guia recomenda proxy só para checagem otimista (cookie) e **DAL** com `cache()` +
  `server-only` perto dos dados, revalidando em toda Server Action e Route Handler.
- **Decision**: `src/proxy.ts` (substitui a trava Basic Auth da 001): renova tokens do Supabase
  (padrão `@supabase/ssr`), redireciona para `/entrar?next=` quem não tem cookie de sessão em
  rota não pública e aplica `Cache-Control: private, no-store` em páginas protegidas. A
  autorização real é do DAL (`requireSession`) chamado em **cada `page.tsx`**, em cada Server
  Action, em cada Route Handler protegido e dentro de `getDataClient()`. **Não** no layout: o
  guia (`authentication.md`, "Layouts and auth checks") avisa que layouts não re-renderizam na
  navegação e não impedem que segmentos filhos rodem/apareçam no RSC payload. Teste estático
  garante que toda página/handler/ação protegida chama o DAL.
- **Cookies em Server Components**: não podem ser gravados (`cookies.md`). Logo, o DAL numa
  página com sessão encerrada redireciona para o Route Handler `/auth/sair`, que limpa cookies.
  O proxy **não** redireciona `/entrar` → `/` por presença de cookie (com JWT ainda válido de uma
  sessão encerrada isso gerava laço); a página `/entrar` decide no servidor.

## R-11 · Cache e "voltar" após logout (FR-009)
- **Decision**: páginas protegidas com `Cache-Control: private, no-store`; o service worker da
  001 já não guarda navegações; componente cliente `SessionGuard` escuta `pageshow`
  (`event.persisted` ⇒ revalida) e `visibilitychange` (ao voltar após ≥ 15 min oculto, esconde o
  conteúdo e consulta `/api/auth/status`); logout faz `location.replace("/entrar")`.

## R-12 · Modo demonstração (ADR 0006)
- **Decision**: interface `AuthService` com duas implementações: `supabase` e `demo`
  (selecionada por `isDemo()`, que vem de `loadEnv()` validado com a proteção cruzada
  `VERCEL_ENV`). Demo: usuário fixo "Usuário Demonstração" (`demo@prumo.invalid`) com
  `DEMO_OWNER_ID` importado da 004, entra automaticamente; sessão demo = `prumo_demo_sid` da 004
  (decisão transversal: um único mecanismo); "Sair" grava cookie `prumo_demo_out=1`; a tela de
  entrada simula fluxos com e-mails fictícios e mostra o código na tela ("Código de
  demonstração: 246810"); histórico = lista sintética determinística + eventos simulados,
  guardados em memória do servidor por `prumo_demo_sid` (TTL 2 h). `scripts/start-demo.mjs`
  passa a zerar `SUPABASE_*`, `AUTH_*` e `APP_ORIGIN` (senão o `.env.local` quebraria o boot).
- **Produção**: o módulo demo não é alcançável quando `APP_ENV ≠ preview`; teste unitário prova
  que nenhum cookie/header/parâmetro ativa a demo em `production` (FR-026). Previews continuam
  atrás da Vercel Authentication (FR-027).

## R-13 · Geolocalização aproximada e dispositivo
- **Decision**: cabeçalhos gratuitos da Vercel `x-vercel-ip-city`/`x-vercel-ip-country`
  (ausentes em local ⇒ "desconhecida"); descrição do dispositivo por parser próprio mínimo do
  User-Agent ("iPhone · Safari", "Android · Chrome", "Windows · Edge"…) — sem dependência.
  IP nunca é armazenado em claro (só `ip_hash`).

## R-14 · Retenção
- **Decision**: `pg_cron` (disponível no Free) diário 03:00 BRT apaga `access_events` > 90 dias
  e `app_sessions` encerradas há > 90 dias (FR-020).

## R-15 · Dependências novas
| Pacote | Versão | Motivo |
|---|---|---|
| `@supabase/ssr` | 0.12.7 | sessão Supabase em cookies no servidor (Next) |
| `@simplewebauthn/server` | 14.0.3 | verificação WebAuthn (desbloqueio) |
| `@simplewebauthn/browser` | 14.0.0 | cerimônia WebAuthn no navegador |
| `msw` (dev) | 3.0.2 | simular Supabase Auth/Google em testes de contrato |

`@axe-core/playwright` (a11y, T048) é introduzido e justificado pela **003**, integrada antes;
a 006 não o reintroduz.

## R-16 · Origem local: `localhost`, nunca IP
- **Fato**: WebAuthn exige que o RP ID seja um domínio válido; endereços IP (`127.0.0.1`) são
  recusados pelo navegador. `localhost` é aceito e é contexto seguro.
- **Decision**: `APP_ORIGIN=http://localhost:<porta>` em dev (3000) e E2E (3100, por webServer do
  Playwright); `site_url`/redirects do Supabase local alinhados.

## R-17 · FR-027 verificado automaticamente
- **Decision**: workflow `preview-protection.yml` no evento `deployment_status` (Preview com
  sucesso) faz uma requisição sem bypass e exige 401/redirecionamento para o login da Vercel
  (`checkPreviewProtection`, com teste unitário). Gratuito (GitHub Actions); não precisa de token
  da Vercel.

## R-18 · CI
- **Fato**: o CI da 001 exclui `mailpit` do `supabase start` e só roda `test:unit`; nenhum job
  conhece as variáveis novas.
- **Decision**: ligar mailpit; job novo "Testes de contrato" (`test:contract`) sem renomear os
  jobs da 001; `scripts/ci-supabase-env.mjs` exporta `SUPABASE_PUBLISHABLE_KEY` (nome único com a
  004) e `AUTH_*` sintéticos; `npm run auth:provision` antes de integração/E2E.

## R-19 · `getClaims()` e chaves JWT
- **Fato**: `getClaims()` verifica o JWT localmente (JWKS) quando o projeto usa chaves
  assimétricas; com chave simétrica (padrão do Supabase CLI local sem `signing_keys_path`) cai
  para uma chamada ao Auth. Projetos novos do Supabase hospedado usam chaves assimétricas.
- **Decision**: manter `getClaims()` (nunca `getSession()` para autorizar); meta "≤ 1 consulta"
  medida em produção; em local o custo extra é aceito (plan §Riscos aceitos).
