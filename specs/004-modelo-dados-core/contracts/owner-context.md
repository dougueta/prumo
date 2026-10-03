# Contrato — Contexto de dono (004 ↔ 006 e modo demonstração)

Define **como** se obtém um `CoreStore` escopado a um dono. A 004 é dona da interface; a
**006 (login)** implementa o provedor de sessão; a 001 fornece ambiente/env.

```ts
// src/data/core/context.ts
type OwnerContext =
  | { kind: "user"; ownerId: OwnerId; client: SupabaseClient }      // JWT do usuário → RLS ativo
  | { kind: "service"; ownerId: OwnerId; client: SupabaseClient }   // chave secreta → só servidor, jobs
  | { kind: "demo"; sessionId: string };                            // memória (preview)

interface OwnerContextProvider {
  /** Lança CoreError("owner_required") se não houver sessão válida. */
  current(): Promise<OwnerContext>;
}

function createCoreStore(ctx: OwnerContext): CoreStore;              // fábrica pura
async function getCoreStore(): Promise<CoreStore>;                   // usa o provedor registrado
function registerOwnerContextProvider(p: OwnerContextProvider): void; // chamado pela 006
```

## Regras por modo

| Modo | Quem usa | Dono | Garantia de isolamento |
|---|---|---|---|
| `user` | requisições autenticadas (páginas, Server Actions, route handlers) | `auth.uid()` do JWT | RLS + filtro do repositório |
| `service` | jobs de servidor (sync 008, import agendado 026), testes | `ownerId` explícito | filtro obrigatório do repositório + `core_resolve_owner` (RLS não se aplica) |
| `demo` | `APP_ENV=preview` | fixo `00000000-0000-4000-8000-00000000d3e0` | loja em memória por `prumo_demo_sid` |

## O que a 006 MUST cumprir

1. **Identidade**: o dono é `auth.users.id` do usuário da allowlist; o JWT emitido pelo Supabase
   Auth tem `sub = owner_id`. Nenhuma tabela própria de usuário substitui `auth.users`.
2. **Cliente com JWT**: para cada requisição autenticada, entregar um `SupabaseClient` de
   servidor criado com `SUPABASE_PUBLISHABLE_KEY` + sessão do cookie (`@supabase/ssr`), de modo
   que `auth.uid()` funcione nas policies. Esse cliente nunca vai ao navegador.
3. **Provedor**: implementar `OwnerContextProvider.current()` a partir do seu DAL
   (`requireSession`) e registrá-lo uma vez no boot do servidor via
   `registerOwnerContextProvider`. Sem sessão ⇒ `owner_required` (a 006 decide redirecionar).
4. **Bootstrap**: após o primeiro login bem-sucedido, chamar `store.bootstrap()` (idempotente;
   cria as categorias padrão). A 004 também chama de forma preguiçosa no primeiro
   `categories.tree()` vazio, então a ausência da chamada não quebra nada.
5. **Exclusão de usuário**: as tabelas core usam `ON DELETE RESTRICT` para `auth.users`; apagar
   o usuário exige exportar e remover dados por rotina própria futura (nunca cascata silenciosa —
   Constitution IV). A 006 MUST NOT apagar usuários em `auth.users`.
6. **Chave secreta**: `kind: "service"` só pode ser construído em código `server-only`; a 006
   não o usa para requisições de usuário.

## Antes da 006 existir

- `getCoreStore()` em `local`/`production` sem provedor registrado → `owner_required`.
  Nenhuma tela da 004 depende disso (a 004 não tem UI).
- Testes de integração constroem contextos `service` e `user` diretamente (usuários criados
  pela Admin API do Supabase local).
- Em `preview`, `getCoreStore()` usa `demo` sem depender da 006.

## Sessão de demonstração

- `src/proxy.ts` (001) passa a, **somente quando `APP_ENV=preview`**, emitir cookie
  `prumo_demo_sid` (UUID v4, `HttpOnly`, `Secure` fora de localhost, `SameSite=Lax`,
  `Path=/`, `Max-Age=7200`) se ausente.
- `DemoSessions`: até 50 lojas por instância (LRU), TTL 2 h desde o último uso; cada loja nasce
  de `fromSyntheticDataset(generateDataset({ seed: 42, months: 12, anchorDate }))`.
- Gravações valem só na sessão/instância; perda por reciclagem da instância é aceitável e
  documentada (selo "Demonstração — dados fictícios" já avisa).
