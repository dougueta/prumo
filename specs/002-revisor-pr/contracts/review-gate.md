# Contrato — Verificação "Revisão independente" e `main-guard` (FR-001, FR-002, FR-004, FR-006 a FR-013, FR-024)

**Implementação**: `.github/workflows/review-gate.yml` → `scripts/review/gate.ts` →
`evaluateGate(snapshot): GateResult` (puro, `src/review/evaluate-gate.ts`). Chamadas HTTP:
[`github-api.openapi.yaml`](github-api.openapi.yaml).

## Gatilhos

| Evento | Tipos | Versão do código executada |
|---|---|---|
| `pull_request_target` | opened, reopened, synchronize, edited, labeled, unlabeled, ready_for_review, converted_to_draft | `main` |
| `issue_comment` (só em PR) | created, edited, deleted | `main` |
| `pull_request_review` | submitted, edited, dismissed | job mínimo `redispatch` que só chama `workflow_dispatch` na `main` |
| `workflow_dispatch` | input `pr` (número) | `main` |

- `permissions: {}` no nível do workflow; cada job declara as suas:
  - job `gate`: `contents: read, pull-requests: write, issues: write, statuses: write, checks: read`
    (`pull-requests`/`issues: write` só para o comentário de avisos);
  - job `redispatch` (`pull_request_review`): **somente** `actions: write`; nenhum checkout,
    só `gh workflow run review-gate.yml --ref main -f pr=<n>`.
- Job `gate` faz `actions/checkout` com `ref: main` (nunca o código do PR) e não executa nada do PR.
- `concurrency: review-gate-<pr>`, `cancel-in-progress: true`.
- Proibido: gatilho `pull_request` (executaria o código do PR).

Observação de segurança: o job `redispatch` roda a versão do workflow **do PR**, que pode pedir
outras permissões e até publicar um status forjado. Por isso o status é só informativo para
o Doug: `pr:merge` e `main-guard` **recalculam** `evaluateGate` (FR-006) e nunca confiam no
status publicado.

## Saídas

1. `POST /repos/{owner}/{repo}/statuses/{head_sha}` com
   `{ context: "Revisão independente", state, description: reason (≤ 140), target_url: <run url> }`.
2. **Comentário de avisos** (FR-010): um único comentário do `github-actions[bot]` iniciado por
   `<!-- prumo:avisos v1 -->` com a lista de avisos; criado/atualizado quando há avisos,
   apagado quando não há. Comentários do `GITHUB_TOKEN` não disparam `issue_comment` (sem
   laço); o portão também ignora o próprio marcador.
3. Os avisos também vão para o job summary.
4. **Erro de API** (401/403/404 inesperado/5xx/limite de taxa após 1 nova tentativa com espera do
   `retry-after`/`x-ratelimit-reset`, máx. 60 s): status `pending` com
   `não foi possível avaliar (erro da API do GitHub) — reexecute` e job falha (exit 1).

## Tabela de decisão (avaliada em ordem; a primeira regra que casar define o resultado)

| # | Condição | state | reason |
|---|---|---|---|
| 1 | PR em rascunho | pending | `PR em rascunho — revisão começa quando estiver pronto` |
| 2 | 0 ou >1 rótulos `autor:*` | failure | `rótulo de autor ausente ou ambíguo` |
| 3 | commits com >1 agente nos trailers | failure | `PR com mais de um agente autor` |
| 4 | agente dos trailers ≠ rótulo | failure | `rótulo de autor inconsistente com os commits` |
| 5 | kind=feature e sem `iniciativa:N` | failure | `rótulo de iniciativa ausente` |
| 6 | kind=feature e (branch fora de `^\d{3}-[a-z0-9-]+$` ou `specs/<branch>/spec.md` inexistente no head) | failure | `PR sem spec (Constitution I)` |
| 7 | kind=emenda e patch sem alterar `**Version**:` e `Version change:` | failure | `emenda sem versão/Sync Impact Report atualizados` |
| 8 | rótulo `emergencia` e corpo com `Motivo da emergência:` + ≥ 20 caracteres | success | `EMERGÊNCIA — revisão independente pós-merge em até 7 dias` |
| 9 | rótulo `emergencia` sem motivo | failure | `emergência sem motivo registrado no PR` |
| 10 | nenhum veredito válido do revisor designado | pending | `aguardando veredito de <Gemini \| Claude (prumo-revisor)>` |
| 11 | último veredito válido com `headSha ≠ head` **e** sem equivalência por impressão (data-model §2.1) | pending | `veredito desatualizado — novo commit após a revisão` |
| 12 | último veredito efetivo = MUDANÇAS NECESSÁRIAS | failure | `mudanças necessárias: N achado(s) (C CRÍTICO, A ALTO…)` |
| 13 | veredito MUDANÇAS anterior com # sem resposta | failure | `achados sem resposta: #2, #5` |
| 14 | caso contrário | success | `APROVADO por <Gemini \| Claude (prumo-revisor)> em <sha7>` (+ ` (rebase neutro)` se o veredito é de outro head) |

**Emergência e spec (FR-024)**: as regras 2–7 valem também para emergências. Um hotfix que
altera produto usa a branch `NNN-slug` da feature afetada (recriada a partir da `main`, onde
`specs/NNN-slug/spec.md` já existe) e passa na regra 6 sem mecanismo especial; hotfix só de
processo é kind=processo. O rótulo `emergencia` só pode ser aplicado pelo Doug: os agentes têm
`gh pr edit*--add-label*emergencia*` e `gh api*labels*` negados (contrato review-cli) e o
`pr:merge` exige confirmação explícita dele.

**Validade do veredito** (antes das regras 10–13): candidatos = reviews + comentários de issue,
ordenados por `publishedAt`; identidade pelo catálogo; `parseVerdict`; re-revisão que não cobre
em "Achados anteriores" todos os # do veredito MUDANÇAS anterior é desconsiderada (aviso).

**Avisos** (não mudam o estado): `veredito de <agente> desconsiderado: não é o revisor
designado`; `veredito fora do formato (<detalhe>)`; `veredito incoerente: APROVADO com achado
CRÍTICO/ALTO`; `PR altera o portão ou os revisores — revisão manual do Doug obrigatória`
(arquivos em `GATE_SELF_PATHS`).

**Kind**: emenda ⊃ processo ⊃ feature (research R-06). Processo e emenda não exigem spec nem
iniciativa, mas exigem rótulo de autor e veredito.

## `main-guard` (FR-001/FR-002/FR-004c detectivo, FR-024)

| Gatilho | Onde | Verificação | Violação |
|---|---|---|---|
| `push` em `main` | job `main-guard` ("Guarda da main") **dentro de `ci.yml`**, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, permissões `contents: read, pull-requests: read, issues: write, checks: read`; `deploy-db` passa a ter `needs: [quality, unit, integration, e2e, main-guard]` | commit com 1 pai; `GET /commits/{sha}/pulls` retorna PR integrado com `merge_commit_sha == sha`; no head do PR, todos os `requiredChecksFromCi(ci.yml)` com check run `conclusion = success` do app `github-actions`; **`evaluateGate` recalculado** sobre o snapshot do PR = success (o status publicado é ignorado) | issue `violacao-main` (título `Violação da proteção da main: <sha7>`, corpo com motivos), atribuída a `dougueta`; job falha ⇒ `deploy-db` não roda |
| `push` em `main` com PR `emergencia` | mesmo job | como acima, com regra 8 | cria issue `emergencia` "Revisão pós-merge pendente: #N" (não é violação) |
| `schedule` diário 11:00 UTC | `.github/workflows/main-guard.yml` (só agendado), permissões `issues: write, pull-requests: read` | issues abertas `emergencia`: existe veredito válido do revisor designado publicado após `merged_at`? | sim: fecha a issue com link; > 7 dias sem: título prefixado `VENCIDA —` e comentário mencionando `@dougueta` |

Idempotente: busca issue aberta com o mesmo título antes de criar. Risco residual registrado no
ADR 0007: o deploy de produção da Vercel a partir da `main` não espera o `main-guard`.
