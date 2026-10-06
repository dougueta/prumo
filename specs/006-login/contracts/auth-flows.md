# Contrato — Rotas, proxy e Server Actions de autenticação

Substitui `specs/001-setup-projeto/contracts/production-gate.md` (FR-028). Vale para `local` e
`production`; em `preview` as mesmas rotas existem com `DemoAuthService` (§5).

## 1. Rotas públicas (sem sessão)

| Caminho | Tipo | Observação |
|---|---|---|
| `/entrar` | página (fora do shell) | botão "Entrar com Google" + formulário de e-mail; aceita `?next=` e `?erro=`; se a sessão estiver `ACTIVE` (checagem no servidor, não no proxy) ⇒ `redirect(safeNext(next))` |
| `/entrar/codigo` | página (fora do shell) | campo de 6 dígitos; e-mail guardado em cookie HttpOnly `prumo_otp_email` (10 min) |
| `/auth/callback` | Route Handler GET | ver `auth-api.openapi.yaml` |
| `/auth/sair` | Route Handler GET | limpeza de cookies de sessão **já** encerrada/expirada/inválida (§2.1) |
| `/~offline`, `/api/health`, `/manifest.webmanifest`, `/sw.js`, `/icons/*` | — | herdadas da 001 |

Rotas protegidas fora do shell: `/desbloquear` (`requireSession({ allowLocked: true })`).
Rotas protegidas dentro do shell `(app)` da 003: todas as demais, incluindo `/mais/seguranca`.
Qualquer caminho não listado como público é **protegido**.

## 2. `src/proxy.ts` (checagem otimista — R-10)

Decisão por função pura `decideProxy({ appEnv, path, hasAuthCookie })` (testada por tabela,
T060) + adaptador fino.

| Situação | Resposta |
|---|---|
| `preview` | não toca no Supabase; **preserva** o tratamento de `prumo_demo_sid` da 004 (emite se ausente); segue — DemoAuthService decide |
| Rota pública | segue (sem redirecionar `/entrar` → `/`: isso é decidido no servidor pela página, evitando laço com sessão encerrada cujo JWT ainda é válido) |
| Rota protegida de página sem cookie de sessão do Supabase | `302 /entrar?next=<caminho interno codificado>` |
| Rota protegida `/api/*` sem cookie | `401 {"error":"UNAUTHENTICATED"}` |
| Rota protegida com cookie | renova tokens (padrão `@supabase/ssr` com `getClaims()`; cookies gravados com `authCookieOptions()` — HttpOnly), adiciona `Cache-Control: private, no-store` e segue — autorização real no DAL |

Matcher: `/((?!_next/static|_next/image|favicon.ico).*)`. O proxy nunca consulta tabelas.

### 2.1 `/auth/sair` (sem laço de redirecionamento)
Server Components não podem gravar cookies (Next 16, `cookies.md`). Por isso o DAL, ao achar
`ENDED`/`EXPIRED`/JWT inválido numa **página**, redireciona para `/auth/sair?next=<interno>`.
O handler: avalia a sessão; se `ACTIVE` ou `LOCKED` ⇒ `302 safeNext(next)` sem efeito (não
serve para deslogar por CSRF); senão aplica os efeitos de encerramento pendentes (uma vez),
apaga cookies `sb-*`, `prumo_otp_email`, `prumo_next`, `prumo_enroll_until` e responde
`302 /entrar?next=…&erro=expirada`.

## 3. `next` (FR-006)

Aceito somente se: começa com `/`, não começa com `//` nem `/\`, não contém `://`, ≤ 512
caracteres e não é rota de auth (`/entrar*`, `/auth/*`, `/desbloquear`). Caso contrário ⇒ `/`.
Função pura `safeNext(raw)`.

## 4. Server Actions (`src/app/(public)/entrar/actions.ts`, `src/app/(app)/mais/seguranca/actions.ts`, `src/app/desbloquear/actions.ts`)

Todas: `"use server"`, validam entrada com zod, nunca retornam tokens nem detalhes do provedor.

### `requestCode(formData: { email })` → `{ ok: true }` (sempre) | `{ ok: false, error: "INVALID_EMAIL" | "TOO_MANY" }`
Tudo dentro de `withFloor(1500, …)` (inclusive `INVALID_EMAIL` e `TOO_MANY`):
1. E-mail com formato inválido ⇒ `INVALID_EMAIL` (não revela nada).
2. Rate limit (plan §Algoritmos) bloqueado ⇒ evento `login_blocked`; resposta `TOO_MANY` com
   texto "Muitas tentativas. Tente novamente mais tarde." (igual para qualquer e-mail).
3. E-mail ∈ allowlist ⇒ `signInWithOtp({ shouldCreateUser: false })`; erro do provedor ⇒ evento
   `provider_error` (resposta continua `ok`).
4. E-mail ∉ allowlist ⇒ **não chama o provedor**; evento `email_refused` (mascarado). **Não**
   conta como falha no rate limit (remediação H1).
5. Evento `otp_requested` (com `email_hash`) em ambos os casos; define cookie `prumo_otp_email`.
6. Redireciona para `/entrar/codigo`.
Mensagem única: "Se este e-mail tiver acesso, você receberá um código de 6 dígitos."

### `verifyCode(formData: { code })` → redirect `next` | `{ ok: false, error: "WRONG_CODE" | "EXPIRED_OR_USED" | "TOO_MANY" | "UNAVAILABLE" }`
Respostas de falha com piso de 1.000 ms (`withFloor`), para que e-mail fora da lista (sem
chamada ao provedor) e e-mail autorizado tenham o mesmo tempo.
1. `code` ≠ `^\d{6}$` ⇒ `WRONG_CODE` + `otp_failed(wrong_code)` (conta como falha).
2. Rate limit bloqueado ⇒ `TOO_MANY`.
3. E-mail ∉ allowlist ⇒ `WRONG_CODE` + evento `otp_failed(wrong_code)` (nenhuma chamada ao
   provedor; conta como falha igual ao autorizado).
4. `verifyOtp({ email, token, type: "email" })`; erro ⇒ classificar (R-06) e registrar
   `otp_failed` com `reason`; `expired`/`used` ⇒ `EXPIRED_OR_USED` ("Este código expirou ou já foi
   usado — peça um novo"); `wrong_code` ⇒ `WRONG_CODE` ("Código incorreto"); provedor fora ⇒
   `UNAVAILABLE` + `provider_error`.
5. Sucesso ⇒ `establishSession(method = "email_otp")` (plan §Algoritmos) ⇒ `redirect(safeNext)`.

### `signInWithGoogle(formData: { next? })` → redirect para o Google
Guarda `safeNext(next)` no cookie HttpOnly `prumo_next` (10 min) e redireciona para a URL do
provedor (PKCE). Provedor indisponível ⇒ `/entrar?erro=indisponivel` + `provider_error`.
A tela `/entrar?erro=indisponivel` sempre oferece "Entrar com código por e-mail" — o caminho
garantido no modo PWA instalado do iOS (FR-003; Gate 2: somente web, sem app nativo).

### `signOut()` → redirect `/entrar`
`requireSession({ allowLocked: true })`; encerra `app_sessions` (`end_reason = 'logout'`),
`auth.signOut({ scope: "local" })`, apaga cookies, evento `logout`. É também a ação do botão
"Entrar novamente" de `/desbloquear` (LOCKED sem credencial neste dispositivo, ou por escolha)
⇒ `/entrar?next=<tela bloqueada>`.

### `signOutEverywhere(formData: { confirm: "sim" })` → redirect `/entrar`
`requireSession()`; `UPDATE app_sessions SET ended_at = now(), end_reason = 'logout_all' WHERE
owner_id = $1 AND ended_at IS NULL`; `auth.admin.signOut(jwt, "global")`; evento `logout_all`.

### `restartForEnrollment()` → redirect `/entrar?next=/mais/seguranca`
Usado em `/mais/seguranca` quando a janela de cadastro (10 min após entrada completa) já
fechou: equivale a `signOut()` seguido de nova entrada completa (remediação L6).

## 5. Modo demonstração (`APP_ENV=preview`)

| Ação | Comportamento |
|---|---|
| Qualquer página protegida | sessão automática "Usuário Demonstração" (`DEMO_OWNER_ID` da 004; `sessionId` = `prumo_demo_sid`), salvo cookie `prumo_demo_out=1` |
| Selo | "Demonstração — dados fictícios" no layout raiz: todas as telas, inclusive `/entrar` |
| `signOut` | grava `prumo_demo_out=1` ⇒ `/entrar` (com selo) |
| `requestCode` | `demo@prumo.invalid` ⇒ tela de código mostrando "Código de demonstração: 246810"; outro e-mail ⇒ mesma mensagem neutra |
| `verifyCode` | `246810` ⇒ entra (apaga `prumo_demo_out`); `111111` ⇒ `EXPIRED_OR_USED`; outro ⇒ `WRONG_CODE`; 5 erros na sessão demo ⇒ `TOO_MANY` |
| Google | botão mostra "Indisponível na demonstração" |
| `/desbloquear` | botão simula sucesso sem WebAuthn |
| `signOutEverywhere` | volta para `/entrar`; nada persiste em banco |

Em `production`/`local` **nenhum** desses caminhos existe: `getAuthService()` só retorna o demo
quando `loadEnv().APP_ENV === "preview"`.
