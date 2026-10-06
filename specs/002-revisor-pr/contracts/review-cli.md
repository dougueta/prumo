# Contrato — Comandos locais (FR-001, FR-003, FR-004, FR-005, FR-009, FR-017, FR-018, FR-022, FR-024)

Todos em `scripts/review/*.ts` (executados com `tsx`); autenticação GitHub pelo `gh` do Doug,
exceto a publicação do veredito (app `prumo-revisor`). Chamadas HTTP:
[`github-api.openapi.yaml`](github-api.openapi.yaml). Saída em português; códigos de saída
estáveis. IO injetável (`fetch`, `exec`, `stdin/stdout`, `isTty`, `now`) para teste sem rede.

## `npm run review:bundle -- <pr>`
Monta `.review/<pr>/` (data-model §3).

| Caso | Saída | Exit |
|---|---|---|
| PR aberto, `autor:gemini` | caminho do pacote + lista de arquivos | 0 |
| rótulo `autor:claude` | `revisor e autor são o mesmo agente` | 3 |
| rótulo `autor:doug` | `este PR é revisado pelo Gemini` | 3 |
| 0 ou >1 rótulos `autor:*` | `rótulo de autor ausente ou ambíguo` | 3 |
| autor externo ou fork | `PR de autor externo — não aceito` | 3 |
| PR inexistente/fechado | `PR #<n> não encontrado ou fechado` | 1 |
| PR em rascunho | `PR em rascunho — aguarde ficar pronto` | 1 |

Re-revisão: se existe veredito válido do `prumo-revisor[bot]` no PR, grava
`anteriores/veredito.md` e `anteriores/respostas.md` (só tabelas `prumo:respostas` posteriores
a ele, obtidas com `parseResponses`). Spec/plan/tasks/data-model/contracts vêm do **head** do
PR; constitution, ADRs e checklist vêm da **`main`**.

## `/revisar-pr <pr>` (skill do Claude Code, `.claude/skills/revisar-pr/SKILL.md`)
1. `review:bundle`; 2. despacha o subagente `revisor-limpo` (tools: Read, Glob, Grep) com o
**único** input "revise o pacote em `.review/<pr>/` seguindo `review-checklist.md` do pacote e
grave `veredito.md`"; 3. orienta o Doug a rodar `npm run review:publish -- <pr>` **no terminal
dele** (a publicação pede a senha da chave — FR-017). A sessão principal **não** lê o diff nem a
spec antes do veredito.

## `npm run review:publish -- <pr>` (só o Doug, terminal interativo)

| Caso | Saída | Exit |
|---|---|---|
| `veredito.md` válido, head do PR = `manifest.headSha`, senha correta | URL do comentário publicado por `prumo-revisor[bot]` | 0 |
| veredito fora do formato | lista de erros do parser | 2 |
| head mudou desde o pacote | `PR recebeu commits após o pacote — refaça /revisar-pr` | 4 |
| `.env.review.local`/chave ausente | `configure PRUMO_REVISOR_CLIENT_ID e PRUMO_REVISOR_KEY_PATH (ver quickstart)` | 5 |
| fora de terminal interativo (TTY) | `publicação exige o Doug no terminal` | 8 |
| senha da chave incorreta | `senha da chave incorreta` | 9 |

Fluxo de token: senha lida do TTY sem eco → `createPrivateKey({key, passphrase})` → JWT RS256
(`iss` = Client ID, `iat` = agora − 60 s, `exp` = agora + 9 min) →
`GET /repos/{repo}/installation` → `POST /app/installations/{id}/access_tokens`
`{repositories:["prumo"], permissions:{pull_requests:"write"}}` → `POST issues/<pr>/comments`.
Senha, chave e token nunca são impressos nem gravados.

## `npm run pr:merge -- <pr>` (só o Doug; negado aos agentes)

O ruleset já impede merge sem os checks verdes e com branch desatualizada. O `pr:merge`
acrescenta o que o servidor não verifica: **recalcula** `evaluateGate` sobre o snapshot (o
status publicado pode ter sido forjado), exige TTY e as confirmações do Doug, e dá mensagens
claras antes de tentar o merge.

| Caso | Exit |
|---|---|
| todos os checks = success, `evaluateGate` recalculado = success, `behind_by == 0`, TTY, confirmações dadas → `gh pr merge <pr> --squash --delete-branch` | 0 |
| algum check obrigatório ≠ success ou `evaluateGate` ≠ success → lista o que falta | 6 |
| `behind_by > 0` → `faça rebase na main e aguarde o CI` | 7 |
| fora de TTY → recusa (agentes) | 8 |
| `touchesGate` e o Doug não digita `revisei` → `revisão manual dos arquivos do portão não confirmada` | 9 |
| `emergency` e o Doug não digita `emergencia` (confirma que ele aplicou o rótulo e o motivo) | 9 |

## `npm run gh:labels` · `npm run gh:repo-settings` · `npm run gh:ruleset`
- `gh:labels`: aplica idempotentemente rótulos e marcos do data-model §5 (cria/atualiza, nunca
  apaga). `--dry-run` mostra o diff. Exit 0.
- `gh:repo-settings`: `PATCH /repos/{repo}` com `allow_squash_merge=true`,
  `allow_merge_commit=false`, `allow_rebase_merge=false`, `delete_branch_on_merge=true`,
  `allow_update_branch=true`. `--dry-run` não escreve. Exit 0.
- `gh:ruleset`: cria ou atualiza (idempotente, pelo nome) o ruleset "main protegida" do
  data-model §7, com os contextos derivados do `ci.yml` da `main` + "Revisão independente".
  `--dry-run` mostra o JSON. Exit 0; erro da API → exit 1 com a mensagem.

## Negação nos agentes (FR-004a, FR-005, FR-009, FR-024)
`.claude/settings.json` `permissions.deny` e `.gemini/settings.json` (`excludeTools` e, se a
versão do Gemini CLI oferecer, shell interativo/PTY desativado) cobrem no mínimo: `gh pr merge`,
`npm run pr:merge`, `npm run review:publish`, `npm run gh:ruleset`, `gh api` em `*/merge*`,
`*/statuses/*`, `*/labels*` e `*/rulesets*`, `gh pr edit` com `emergencia`, `gh repo edit`, e
leitura de `~/.prumo/**`. Push direto na `main` deixa de precisar de regra local: o servidor
recusa (ruleset); as regras de push são mantidas apenas como mensagem antecipada.

## Removido com D1 = A (2026-10-05)
Hook `.githooks/pre-push` e `prepare`/`scripts/setup-hooks.mjs`: o ruleset recusa push direto,
force-push e deleção da `main` para todos, inclusive o administrador; o hook só duplicava isso
localmente e trazia o risco de quebrar `npm install` no build da Vercel.
