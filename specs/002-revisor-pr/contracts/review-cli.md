# Contrato — Comandos locais (FR-004, FR-017, FR-018, FR-022)

Todos em `scripts/review/*.ts` (executados com `tsx`), autenticação GitHub pelo `gh` do Doug,
exceto a publicação do veredito (app `prumo-revisor`). Saída em português; códigos de saída
estáveis.

## `npm run review:bundle -- <pr>`
Monta `.review/<pr>/` (data-model §3).

| Caso | Saída | Exit |
|---|---|---|
| PR aberto, `autor:gemini` | caminho do pacote + lista de arquivos | 0 |
| rótulo ≠ `autor:gemini` | `revisor e autor são o mesmo agente` (se `autor:claude`) / `este PR é revisado pelo Gemini` (se `autor:doug`) | 3 |
| PR inexistente/fechado | `PR #<n> não encontrado ou fechado` | 1 |
| PR em rascunho | `PR em rascunho — aguarde ficar pronto` | 1 |

## `/revisar-pr <pr>` (skill do Claude Code, `.claude/skills/revisar-pr/SKILL.md`)
1. `review:bundle`; 2. despacha subagente `revisor-limpo` (tools: Read, Glob, Grep) com o
**único** input "revise o pacote em `.review/<pr>/` seguindo `review-checklist.md` do pacote e
grave `veredito.md`"; 3. `review:publish`. A sessão principal **não** lê o diff nem a spec
antes do veredito (evita contaminar a revisão com o contexto do autor).

## `npm run review:publish -- <pr>`

| Caso | Saída | Exit |
|---|---|---|
| `veredito.md` válido e head do PR = `manifest.headSha` | URL do comentário publicado por `prumo-revisor[bot]` | 0 |
| veredito fora do formato | lista de erros do parser | 2 |
| head mudou desde o pacote | `PR recebeu commits após o pacote — refaça /revisar-pr` | 4 |
| `.env.review.local`/chave ausente | `configure PRUMO_REVISOR_CLIENT_ID e PRUMO_REVISOR_KEY_PATH (ver quickstart)` | 5 |

Fluxo de token: JWT RS256 (`iss` = Client ID, `iat` = agora − 60 s, `exp` = agora + 9 min) →
`GET /repos/{repo}/installation` → `POST /app/installations/{id}/access_tokens`
`{repositories:["prumo"], permissions:{pull_requests:"write"}}` → comentário. Token nunca é
impresso nem gravado.

## `npm run pr:merge -- <pr>` (só o Doug; negado aos agentes)

| Caso | Exit |
|---|---|
| 4 checks de CI = success, status "Revisão independente" = success, branch atualizada (`mergeable_state` = `clean`) → `gh pr merge <pr> --squash --delete-branch` | 0 |
| qualquer check ≠ success → lista o que falta | 6 |
| branch desatualizada → `faça rebase na main e aguarde o CI` | 7 |
| executado fora de terminal interativo (TTY) → recusa (agentes) | 8 |

## `npm run gh:labels`
Aplica idempotentemente rótulos e marcos do data-model §5 (cria/atualiza, nunca apaga).
`--dry-run` mostra o diff. Exit 0.

## Hook `pre-push` (`.githooks/pre-push`)
Recusa (exit 1) qualquer push cujo ref remoto seja `refs/heads/main`, com mensagem
`push direto na main é proibido — abra um PR (Constitution VIII)`. Ativado por
`"prepare": "git config core.hooksPath .githooks"`.
