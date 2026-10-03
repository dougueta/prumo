# Contrato — Verificação "Revisão independente" (FR-006 a FR-013, FR-024)

**Implementação**: `.github/workflows/review-gate.yml` → `scripts/review/gate.ts` →
`evaluateGate(snapshot): GateResult` (puro, `src/review/evaluate-gate.ts`).

## Gatilhos

| Evento | Tipos | Versão do código executada |
|---|---|---|
| `pull_request_target` | opened, reopened, synchronize, edited, labeled, unlabeled, ready_for_review, converted_to_draft | `main` |
| `issue_comment` (só em PR) | created, edited, deleted | `main` |
| `pull_request_review` | submitted, edited, dismissed | job mínimo que só chama `workflow_dispatch` na `main` |
| `workflow_dispatch` | input `pr` (número) | `main` |

`concurrency: review-gate-<pr>`, `cancel-in-progress: true`. Permissões:
`contents: read, pull-requests: read, issues: read, statuses: write, actions: write` (só para o
dispatch). Nenhum checkout/execução do código do PR.

## Saída

`POST /repos/{owner}/{repo}/statuses/{head_sha}` com
`{ context: "Revisão independente", state, description: reason (≤ 140), target_url: <run url> }`
(`state` do GitHub: `success | pending | failure`). Avisos vão para o **job summary** do run.

## Tabela de decisão (avaliada em ordem; a primeira regra que casar define o resultado)

| # | Condição | state | reason |
|---|---|---|---|
| 1 | PR em rascunho | pending | `PR em rascunho — revisão começa quando estiver pronto` |
| 2 | 0 ou >1 rótulos `autor:*` | failure | `rótulo de autor ausente ou ambíguo` |
| 3 | commits com >1 agente nos trailers | failure | `PR com mais de um agente autor` |
| 4 | agente dos trailers ≠ rótulo | failure | `rótulo de autor inconsistente com os commits` |
| 5 | kind=feature e sem `iniciativa:N` | failure | `rótulo de iniciativa ausente` |
| 6 | kind=feature e (branch fora do padrão ou `specs/<branch>/spec.md` inexistente) | failure | `PR sem spec (Constitution I)` |
| 7 | kind=emenda e patch sem alterar `**Version**:` e `Version change:` | failure | `emenda sem versão/Sync Impact Report atualizados` |
| 8 | rótulo `emergencia` e corpo com `Motivo da emergência:` + ≥ 20 caracteres | success | `EMERGÊNCIA — revisão independente pós-merge em até 7 dias` |
| 9 | rótulo `emergencia` sem motivo | failure | `emergência sem motivo registrado no PR` |
| 10 | nenhum veredito válido do revisor designado | pending | `aguardando veredito de <Gemini\|Claude (prumo-revisor)>` |
| 11 | último veredito válido com `headSha ≠ head` | pending | `veredito desatualizado — novo commit após a revisão` |
| 12 | último veredito efetivo = MUDANÇAS NECESSÁRIAS | failure | `mudanças necessárias: N achado(s) (C CRÍTICO, A ALTO…)` |
| 13 | veredito MUDANÇAS anterior com # sem resposta | failure | `achados sem resposta: #2, #5` |
| 14 | caso contrário | success | `APROVADO por <revisor> em <sha7>` |

**Avisos** (não mudam o estado): `veredito de <agente> desconsiderado: não é o revisor
designado`; `veredito fora do formato (<detalhe>)`; `veredito incoerente: APROVADO com achado
CRÍTICO/ALTO`; `PR altera o próprio portão — revisão manual do Doug obrigatória` (arquivos em
`GATE_SELF_PATHS`).

**Kind**: emenda ⊃ processo ⊃ feature (ver research R-06). Processo e emenda não exigem spec nem
iniciativa, mas exigem rótulo de autor e veredito.

## `main-guard` (FR-001/FR-002 detectivo, FR-024)

`.github/workflows/main-guard.yml` → `scripts/review/main-guard.ts`:

| Gatilho | Verificação | Violação |
|---|---|---|
| `push` em `main` | commit tem 1 pai; `GET /commits/{sha}/pulls` retorna PR `merged` cujo `merge_commit_sha == sha`; no head do PR, os 4 checks de CI = success e o status "Revisão independente" = success | issue `violacao-main` (título `Violação da proteção da main: <sha7>`, corpo com motivo), atribuída a `dougueta`; job falha |
| `schedule` diário 11:00 UTC | PRs integrados com `emergencia`: há veredito válido do revisor designado publicado após o merge? | sem veredito: issue `emergencia` "Revisão pós-merge pendente: #N" (criada no merge); > 7 dias: título prefixado `VENCIDA —` e comentário mencionando `@dougueta` |

Idempotente: busca issue aberta com o mesmo título antes de criar.
