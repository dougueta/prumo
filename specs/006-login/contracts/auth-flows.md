# Contrato — Rotas, proxy e Server Actions de autenticação

Substitui `specs/001-setup-projeto/contracts/production-gate.md` (FR-028). Vale para `local` e
`production`; em `preview` as mesmas rotas existem com `DemoAuthService` (§5).

## 1. Rotas públicas (sem sessão)

| Caminho | Tipo | Observação |
|---|---|---|
| `/entrar` | página | botão "Entrar com Google" + formulário de e-mail; aceita `?next=` e `?erro=` |
| `/entrar/codigo` | página | campo de 6 dígitos; e-mail guardado em cookie HttpOnly `prumo_otp_email` (10 min) |
| `/auth/callback` | Route Handler GET | ver `auth-api.openapi.yaml` |
| `/~offline`, `/api/health`, `/manifest.webmanifest`, `/sw.js`, `/icons/*` | — | herdadas da 001 |

Qualquer outro caminho é **protegido**.

## 2. `src/proxy.ts` (checagem otimista — R-10)

| Situação | Resposta |
|---|---|
| Rota pública | segue; se houver cookie de sessão válido e a rota for `/entrar*` ⇒ `302 /` |
| Rota protegida de página sem cookie de sessão do Supabase | `302 /entrar?next=<caminho interno codificado>` |
| Rota protegida `/api/*` sem cookie | `401 {"error":"UNAUTHENTICATED"}` |
| Rota protegida com cookie | renova tokens (padrão `@supabase/ssr`), adiciona `Cache-Control: private, no-store` e segue — autorização real no DAL |
| `preview` | não toca no Supabase; segue (DemoAuthService decide) |

Matcher: `/((?!_next/static|_next/image|favicon.ico).*)`. O proxy nunca consulta tabelas.

## 3. `next` (FR-006)

Aceito somente se: começa com `/`, não começa com `//` nem `/\`, não contém `://`, ≤ 512
caracteres e não é rota de auth. Caso contrário ⇒ `/`. Função pura `safeNext(raw)`.

## 4. Server Actions (`src/app/(public)/entrar/actions.ts`, `src/app/(app)/seguranca/actions.ts`)

Todas: `"use server"`, validam entrada com zod, nunca retornam tokens nem detalhes do provedor.

### `requestCode(formData: { email })` → `{ ok: true }` (sempre) | `{ ok: false, error: "INVALID_EMAIL" | "TOO_MANY" }`
1. E-mail com formato inválido ⇒ `INVALID_EMAIL` (não revela nada).
2. Rate limit (plan §Algoritmos) bloqueado ⇒ evento `login_blocked`; resposta `TOO_MANY` com
   texto "Muitas tentativas. Tente novamente mais tarde." (igual para qualquer e-mail).
3. E-mail ∈ allowlist ⇒ `signInWithOtp({ shouldCreateUser: false })`; erro do provedor ⇒ evento
   `provider_error` (resposta continua `ok`).
4. E-mail ∉ allowlist ⇒ **não chama o provedor**; evento `email_refused` (mascarado).
5. Evento `otp_requested` (com `email_hash`) em ambos os casos; define cookie `prumo_otp_email`.
6. Piso de 1.500 ms desde o início; redireciona para `/entrar/codigo`.
Mensagem única: "Se este e-mail tiver acesso, você receberá um código de 6 dígitos."

### `verifyCode(formData: { code })` → redirect `next` | `{ ok: false, error: "WRONG_CODE" | "EXPIRED_OR_USED" | "TOO_MANY" | "UNAVAILABLE" }`
1. `code` ≠ `^\d{6}$` ⇒ `WRONG_CODE` (conta como falha).
2. Rate limit bloqueado ⇒ `TOO_MANY`.
3. E-mail ∉ allowlist ⇒ `WRONG_CODE` + evento `otp_failed` (nenhuma chamada ao provedor).
4. `verifyOtp({ email, token, type: "email" })`; erro ⇒ classificar (R-06) e registrar
   `otp_failed` com `reason`; `expired`/`used` ⇒ `EXPIRED_OR_USED` ("Este código expirou ou já foi
   usado — peça um novo"); `wrong_code` ⇒ `WRONG_CODE` ("Código incorreto").
5. Sucesso ⇒ `establishSession(method = "email_otp")` (plan §Algoritmos) ⇒ `redirect(safeNext)`.

### `signInWithGoogle(formData: { next? })` → redirect para o Google
Guarda `safeNext(next)` no cookie HttpOnly `prumo_next` (10 min) e redireciona para a URL do
provedor (PKCE). Provedor indisponível ⇒ `/entrar?erro=indisponivel` + `provider_error`.

### `signOut()` → redirect `/entrar`
`requireSession({ allowLocked: true })`; encerra `app_sessions` (`end_reason = 'logout'`),
`auth.signOut({ scope: "local" })`, apaga cookies, evento `logout`.

### `signOutEverywhere(formData: { confirm: "sim" })` → redirect `/entrar`
`requireSession()`; `UPDATE app_sessions SET ended_at = now(), end_reason = 'logout_all' WHERE
owner_id = $1 AND ended_at IS NULL`; `auth.admin.signOut(jwt, "global")`; evento `logout_all`.

## 5. Modo demonstração (`APP_ENV=preview`)

| Ação | Comportamento |
|---|---|
| Qualquer página protegida | sessão automática "Usuário Demonstração", salvo cookie `prumo_demo_out=1` |
| `signOut` | grava `prumo_demo_out=1` ⇒ `/entrar` (com selo) |
| `requestCode` | `demo@prumo.invalid` ⇒ tela de código mostrando "Código de demonstração: 246810"; outro e-mail ⇒ mesma mensagem neutra |
| `verifyCode` | `246810` ⇒ entra (apaga `prumo_demo_out`); `111111` ⇒ `EXPIRED_OR_USED`; outro ⇒ `WRONG_CODE`; 5 erros na página ⇒ `TOO_MANY` |
| Google | botão mostra "Indisponível na demonstração" |
| `/desbloquear` | botão simula sucesso sem WebAuthn |
| `signOutEverywhere` | volta para `/entrar`; nada persiste |

Em `production`/`local` **nenhum** desses caminhos existe: `getAuthService()` só retorna o demo
quando `loadEnv().APP_ENV === "preview"`.
