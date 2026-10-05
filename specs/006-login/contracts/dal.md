# Contrato — Data Access Layer de autenticação (para todas as features com dados)

Módulo `src/lib/auth/dal.ts` (`import "server-only"`). É **a** forma de autorizar acesso a dados
(FR-007). Toda página protegida (`page.tsx`), Server Action e Route Handler de qualquer feature
MUST chamar `requireSession()` antes de ler ou gravar dados — **nunca só no layout** (Next 16,
`authentication.md` §"Layouts and auth checks": layout não re-renderiza na navegação e não
impede que segmentos filhos rodem). Verificado por teste estático
(`tests/unit/auth/protected-surface.test.ts`, que cobre `page.tsx`, `route.ts` e `"use server"`).

```ts
type SessionContext = {
  userId: string;        // auth.users.id (== owner_id da 004); demo: DEMO_OWNER_ID (@/data/core)
  sessionId: string;     // app_sessions.id; demo: valor do cookie prumo_demo_sid (004)
  deviceId: string;      // cookie prumo_device; demo: "demo"
  email: string;         // normalizado
  isDemo: boolean;
};

/** Memoizada por requisição (React cache). */
requireSession(opts?: { allowLocked?: boolean }): Promise<SessionContext>;

/**
 * Chama requireSession() internamente (mesma memoização) e só então cria o cliente
 * Supabase com o JWT do usuário + chave publicável ⇒ RLS por auth.uid() se aplica.
 * Assim, mesmo uma página que esqueça a guarda não obtém dados de sessão encerrada.
 */
getDataClient(): Promise<SupabaseClient>;   // lança em preview (usar repositórios em memória)
```

| Situação | Página (Server Component) | Server Action | Route Handler |
|---|---|---|---|
| Sem sessão (sem cookie) | `redirect("/entrar?next=…")` | lança `AuthError("UNAUTHENTICATED")` ⇒ resposta `{ ok:false, error:"SESSION_EXPIRED" }` | `401 UNAUTHENTICATED` |
| JWT inválido, sessão encerrada ou expirada | `redirect("/auth/sair?next=…")` (limpa cookies — auth-flows §2.1) + evento `session_expired` (uma vez, quando aplicável) | `{ ok:false, error:"SESSION_EXPIRED" }` + limpa cookies | `401 SESSION_EXPIRED` + limpa cookies |
| `LOCKED` (sem `allowLocked`) | `redirect("/desbloquear?next=…")` | `{ ok:false, error:"LOCKED" }` | `423 LOCKED` |
| E-mail fora da allowlist (removido da config) | sessão encerrada `allowlist_removed` ⇒ como "encerrada" | idem | idem |
| Banco indisponível / tabela ausente | página de erro "Não foi possível verificar sua sessão" (nenhum dado) | `{ ok:false, error:"UNAVAILABLE" }` | `503 UNAVAILABLE` |
| `ACTIVE` | retorna contexto; atualiza `last_active_at` se > 60 s | idem | idem |

Falha fechada: qualquer exceção na verificação ⇒ nunca retorna contexto.

## Adaptador para a 004 (`src/lib/auth/owner-context.ts`)

Implementa `OwnerContextProvider` de `specs/004-modelo-dados-core/contracts/owner-context.md`:

```ts
const provider: OwnerContextProvider = {
  async current() {
    const s = await requireSession();               // redireciona/401 antes de owner_required
    return s.isDemo
      ? { kind: "demo", sessionId: s.sessionId }    // prumo_demo_sid
      : { kind: "user", ownerId: s.userId, client: await getDataClient() };
  },
};
registerOwnerContextProvider(provider);             // em src/instrumentation.ts (boot do servidor)
```

- `kind: "service"` nunca é construído pela 006.
- `establishSession()` chama `(await getCoreStore()).bootstrap()` (idempotente) após
  `login_succeeded`; falha do bootstrap é registrada em log redigido e **não** impede a entrada
  (a 004 também faz bootstrap preguiçoso).
- `owner_required` nunca chega à UI: o DAL decide antes (redirect/401).

Regras para consumidores (004, 007, 009, 012, 025…):
- Server Actions MUST tratar `SESSION_EXPIRED`/`LOCKED` **antes** de qualquer gravação: a ação
  não é executada (FR-013). O componente cliente `useAuthAwareAction` (006) mostra "Sua sessão
  expirou — entre novamente; a última ação não foi salva" e redireciona com `next` = tela atual.
- Repositórios Supabase MUST usar `getDataClient()`/`getCoreStore()` (nunca o cliente com chave
  secreta para dados do usuário). Repositórios em memória (demo) recebem `SessionContext.userId`
  do demo.
- Proibido ler cookies de auth diretamente fora de `src/lib/auth/`.
- O cliente com chave secreta tem **um só** ponto de criação: `src/lib/supabase/server.ts` (001),
  renomeado para `createServiceClient()` (evita colisão com `createServerClient` do
  `@supabase/ssr`); importável apenas em `src/lib/auth/**`, `src/app/api/health/route.ts` e
  `src/data/**` (modo `service` da 004) — teste estático.
