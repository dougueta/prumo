# Contrato — Contexto de dono (004 ↔ 006 e modo demonstração)

Define **como** se obtém um `CoreStore` escopado a um dono. A 004 é dona da interface, da
constante `DEMO_OWNER_ID` e do cookie `prumo_demo_sid`; a **006 (login)** implementa o provedor
de sessão (decisões transversais da onda 1, 2026-10-05); a 001 fornece ambiente/env.

```ts
// src/data/core/context.ts (exportado por @/data/core)
export const DEMO_OWNER_ID = "00000000-0000-4000-8000-00000000d3e0" as OwnerId; // único dono demo do app

type OwnerContext =
  | { kind: "user"; ownerId: OwnerId; client: SupabaseClient }      // JWT do usuário → RLS ativo
  | { kind: "service"; ownerId: OwnerId; client: SupabaseClient }   // chave secreta → só servidor, jobs
  | { kind: "demo"; sessionId: string };                            // memória (preview); dono = DEMO_OWNER_ID

interface OwnerContextProvider {
  /** Devolve `user` ou `demo`. Sem sessão válida, lança CoreError("owner_required"). */
  current(): Promise<OwnerContext>;
}

function createCoreStore(ctx: OwnerContext): CoreStore;              // fábrica pura
async function getCoreStore(): Promise<CoreStore>;                   // usa o provedor registrado
function registerOwnerContextProvider(p: OwnerContextProvider): void; // chamado pela 006 no boot
```

## Regras por modo

| Modo | Quem usa | Dono | Garantia de isolamento |
|---|---|---|---|
| `user` | requisições autenticadas (páginas, Server Actions, route handlers) | `auth.uid()` do JWT | RLS + filtro do repositório |
| `service` | jobs de servidor (sync 008, import agendado 026), testes | `ownerId` explícito | filtro obrigatório do repositório + `core_resolve_owner` (RLS não se aplica) |
| `demo` | `APP_ENV=preview` | `DEMO_OWNER_ID` | loja em memória por `prumo_demo_sid` |

## Resolução em `getCoreStore()`

1. Provedor registrado → `provider.current()` → `createCoreStore(ctx)` (`demo` usa
   `DemoSessions.get(ctx.sessionId)`).
2. Sem provedor e `APP_ENV=preview` → `demo` com `sessionId` = cookie `prumo_demo_sid`
   (lido por `cookies()` do Next; ausente ⇒ sessão efêmera nova, só para a requisição).
3. Sem provedor em `local`/`production` → `CoreError("owner_required")`.

## O que a 006 implementa (tasks e teste de contrato ficam na 006)

1. **Identidade**: o dono é `auth.users.id` do usuário da allowlist (allowlist é da 006:
   `AUTH_ALLOWED_EMAILS`, só no servidor); o JWT do Supabase Auth tem `sub = owner_id`.
   Nenhuma tabela própria de usuário substitui `auth.users`.
2. **Adaptador**: `OwnerContextProvider.current()` sobre `requireSession()` + `getDataClient()`
   (contrato `dal.md` da 006): sessão ativa ⇒ `{ kind: "user", ownerId: session.userId,
   client: await getDataClient() }`; `isDemo` ⇒ `{ kind: "demo", sessionId: session.sessionId }`,
   onde `session.sessionId` **é** o valor de `prumo_demo_sid` e `session.userId` é
   `DEMO_OWNER_ID` (importado de `@/data/core`, sem constante própria).
3. **Registro**: `registerOwnerContextProvider` uma vez no boot do servidor.
4. **Erros**: sem contexto, a 004 lança `owner_required`; a 006 **nunca** deixa isso chegar à
   UI — o DAL redireciona (páginas) ou responde 401/`SESSION_EXPIRED`/`LOCKED` antes de
   chamar `getCoreStore()`. Se mesmo assim ocorrer, o tratamento é o de `UNAUTHENTICATED`.
5. **Bootstrap**: após o primeiro login bem-sucedido, chamar `store.bootstrap()` (idempotente).
   A 004 também chama de forma preguiçosa no primeiro `categories.tree()` vazio, então a
   ausência da chamada não quebra nada.
6. **Cliente com JWT**: criado no servidor com `SUPABASE_PUBLISHABLE_KEY` + sessão do cookie
   (`@supabase/ssr`, dependência introduzida pela 006); nunca vai ao navegador.
7. **Exclusão de usuário**: tabelas core usam `ON DELETE RESTRICT` para `auth.users`; a 006
   MUST NOT apagar usuários em `auth.users` (nunca cascata silenciosa — Constitution IV).
8. **Chave secreta**: `kind: "service"` só em código `server-only`; nunca para requisições de usuário.

## Antes da 006 existir (a 004 faz merge primeiro — ordem 004 → 003 → 006 → 002)

- `getCoreStore()` em `local`/`production` → `owner_required` (a 004 não tem UI).
- Testes de integração constroem contextos `service` e `user` diretamente (usuários criados
  pela Admin API do Supabase local; JWT via `SUPABASE_PUBLISHABLE_KEY`, exportada por
  `scripts/ci-supabase-env.mjs` só para testes).
- Em `preview`, `getCoreStore()` usa `demo` sem depender da 006.

## Sessão de demonstração (dona: 004)

- `src/proxy.ts`: **somente quando `APP_ENV=preview`**, emite cookie `prumo_demo_sid` (UUID v4,
  `HttpOnly`, `Secure` fora de localhost, `SameSite=Lax`, `Path=/`, `Max-Age=7200`) se
  ausente. A 004 não referencia a trava de produção da 001; a 006, ao reescrever o proxy,
  preserva esse tratamento. A 006 pode ter cookie próprio só para "saiu da demo"
  (`prumo_demo_out`), sem criar outra sessão demo.
- `DemoSessions`: até 50 lojas por instância (LRU), TTL 2 h desde o último uso; cada loja nasce
  de `fromSyntheticDataset(generateDataset({ seed: 42, months: 12, anchorDate: hoje em
  America/Sao_Paulo }), DEMO_OWNER_ID)`.
- Gravações valem só na sessão/instância; perda por reciclagem da instância é aceitável e
  documentada (selo "Demonstração — dados fictícios" já avisa).
