# Contrato — Data Access Layer de autenticação (para todas as features com dados)

Módulo `src/lib/auth/dal.ts` (`import "server-only"`). É **a** forma de autorizar acesso a dados
(FR-007). Toda página protegida, Server Action e Route Handler de qualquer feature MUST chamar
`requireSession()` antes de ler ou gravar dados — verificado por teste estático
(`tests/unit/auth/protected-surface.test.ts`).

```ts
type SessionContext = {
  userId: string;        // auth.users.id (== owner_id da 004)
  sessionId: string;     // app_sessions.id
  email: string;         // normalizado
  isDemo: boolean;
};

/** Memoizada por requisição (React cache). */
requireSession(opts?: { allowLocked?: boolean }): Promise<SessionContext>;

/** Cliente Supabase com o JWT do usuário + chave publicável ⇒ RLS por auth.uid() se aplica. */
getDataClient(): Promise<SupabaseClient>;   // lança em preview (usar repositórios em memória)
```

| Situação | Página (Server Component) | Server Action | Route Handler |
|---|---|---|---|
| Sem sessão / JWT inválido | `redirect("/entrar?next=…")` | lança `AuthError("UNAUTHENTICATED")` ⇒ resposta `{ ok:false, error:"SESSION_EXPIRED" }` | `401 UNAUTHENTICATED` |
| Sessão encerrada/expirada | idem + evento `session_expired` (uma vez) | idem | `401 SESSION_EXPIRED` |
| `LOCKED` (sem `allowLocked`) | `redirect("/desbloquear?next=…")` | `{ ok:false, error:"LOCKED" }` | `423 LOCKED` |
| E-mail fora da allowlist (removido da config) | sessão encerrada `allowlist_removed` ⇒ como "encerrada" | idem | idem |
| `ACTIVE` | retorna contexto; atualiza `last_active_at` se > 60 s | idem | idem |

Regras para consumidores (004, 007, 009, 012, 025…):
- Server Actions MUST tratar `SESSION_EXPIRED`/`LOCKED` **antes** de qualquer gravação: a ação
  não é executada (FR-013). O componente cliente `useAuthAwareAction` (006) mostra "Sua sessão
  expirou — entre novamente; a última ação não foi salva" e redireciona com `next` = tela atual.
- Repositórios Supabase MUST usar `getDataClient()` (nunca o cliente com chave secreta para
  dados do usuário). Repositórios em memória (demo) recebem `SessionContext.userId` do demo.
- Proibido ler cookies de auth diretamente fora de `src/lib/auth/`.
