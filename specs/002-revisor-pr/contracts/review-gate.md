# Contrato — Verificação "Revisão independente" e `main-guard` (FR-001, FR-002, FR-004, FR-006 a FR-013, FR-024, FR-026)

**Implementação**: `.github/workflows/review-gate.yml` → `scripts/review/gate.ts` →
`evaluateGate(snapshot): GateResult` (puro, `src/review/evaluate-gate.ts`). Chamadas HTTP:
[`github-api.openapi.yaml`](github-api.openapi.yaml). A verificação é **obrigatória no
servidor** pelo ruleset "main protegida" (data-model §7), fixada ao app GitHub Actions.

## Gatilhos

| Evento | Tipos | Versão do código executada | Token |
|---|---|---|---|
| `pull_request_target` | opened, reopened, synchronize, edited, labeled, unlabeled, ready_for_review, converted_to_draft | `main` | `GITHUB_TOKEN` do job `gate` |
| `issue_comment` (só em PR) | created, edited, deleted | `main` | `GITHUB_TOKEN` do job `gate` |
| `pull_request_review` | submitted, edited, dismissed | job mínimo `redispatch` (sem checkout) que só chama `workflow_dispatch` na `main` | só `actions: write` (somente leitura em PR de fork) |
| `workflow_dispatch` | input `pr` (número) | `main` | `GITHUB_TOKEN` do job `gate` |

- `permissions: {}` no nível do workflow; cada job declara as suas:
  - job `gate`: `contents: read, pull-requests: write, issues: write, statuses: write, checks: read`
    (`pull-requests`/`issues: write` só para o comentário de avisos);
  - job `redispatch` (`pull_request_review`): **somente** `actions: write`; nenhum checkout,
    só `gh workflow run review-gate.yml --ref main -f pr=<número>`.
- Job `gate` faz `actions/checkout` com `ref: main` e `persist-credentials: false`; nunca faz
  checkout de `head.sha`/`head.ref`/`refs/pull/*` e não executa nada do PR.
- `concurrency: review-gate-<pr>`, `cancel-in-progress: true`.
- Proibido: gatilho `pull_request` (executaria o código do PR), qualquer `secrets.*` além de
  `GITHUB_TOKEN`, `environment:`, e interpolação de texto controlado pelo PR
  (`github.event.pull_request.title|body|head.ref|head.label`, `github.event.comment.body`,
  `github.event.review.body`) em `run:` — só o **número** do PR é passado, via `env`.

### Por que é seguro com o repositório público (FR-026)
`pull_request_target` e `issue_comment` disparados por fork rodam **o código da `main`** com um
`GITHUB_TOKEN` de escrita. O risco clássico é (1) checkout/execução do código do PR, (2) uso de
segredos e (3) injeção de texto do PR em `run:`. Nenhum dos três existe: checkout só da `main`,
nenhum segredo, apenas o número do PR entra no script, e o script lê tudo pela API como dado.
As saídas (status, comentário de avisos, job summary) usam **só textos do catálogo**, números e
shas — nunca texto vindo do PR. Para fork, `pull_request_review` roda o workflow da versão do
PR, mas com token somente leitura e sem segredos: o `redispatch` falha sem efeito (PR de fork
já é bloqueado pela regra 0 nos outros eventos). Os minutos de Actions em repositório público
são gratuitos; `concurrency` limita repetição. Tudo isso é verificado por T061.

## Saídas

1. `POST /repos/{owner}/{repo}/statuses/{head_sha}` com
   `{ context: "Revisão independente", state, description: reason (≤ 140), target_url: <run url> }`.
2. **Comentário de avisos** (FR-010): um único comentário do `github-actions[bot]` iniciado por
   `<!-- prumo:avisos v1 -->`; criado/atualizado quando há avisos, apagado quando não há.
   Comentários do `GITHUB_TOKEN` não disparam `issue_comment` (sem laço).
3. Os avisos também vão para o job summary.
4. **Erro de API** (política do OpenAPI): status `pending` com
   `não foi possível avaliar (erro da API do GitHub) — reexecute` e job falha (exit 1).

## Tabela de decisão (avaliada em ordem; a primeira regra que casar define o resultado)

| # | Condição | state | reason |
|---|---|---|---|
| 0 | autor do PR ≠ `dougueta` **ou** branch de outro repositório (fork) | failure | `PR de autor externo — não aceito` |
| 1 | PR em rascunho | pending | `PR em rascunho — revisão começa quando estiver pronto` |
| 2 | 0 ou >1 rótulos `autor:*` | failure | `rótulo de autor ausente ou ambíguo` |
| 3 | commits com >1 agente nos trailers | failure | `PR com mais de um agente autor` |
| 4 | agente dos trailers ≠ rótulo | failure | `rótulo de autor inconsistente com os commits` |
| 5 | kind=feature e sem `iniciativa:N` | failure | `rótulo de iniciativa ausente` |
| 6 | kind=feature e (branch fora de `^\d{3}-[a-z0-9-]+$` ou `specs/<branch>/spec.md` inexistente no head) | failure | `PR sem spec (Constitution I)` |
| 7 | kind=emenda e patch sem alterar `**Version**:` e `Version change:` | failure | `emenda sem versão/Sync Impact Report atualizados` |
| 8 | rótulo `emergencia`, corpo com `Motivo da emergência:` + ≥ 20 caracteres, kind ≠ emenda e `!touchesGate` | success | `EMERGÊNCIA — revisão independente pós-merge em até 7 dias` |
| 9 | rótulo `emergencia` nos demais casos | failure | kind=emenda ou `touchesGate`: `emergência não vale para PR que altera a constitution ou os mecanismos de revisão`; sem motivo: `emergência sem motivo registrado no PR` |
| 10 | nenhum veredito válido do revisor designado | pending | `aguardando veredito de <Gemini \| Claude (prumo-revisor)>` |
| 11 | último veredito válido com `headSha ≠ head` **e** sem equivalência por impressão (data-model §2.1) | pending | `veredito desatualizado — novo commit após a revisão` |
| 12 | último veredito efetivo = MUDANÇAS NECESSÁRIAS | failure | `mudanças necessárias: N achado(s) (C CRÍTICO, A ALTO…)` |
| 13 | veredito MUDANÇAS anterior com # sem resposta | failure | `achados sem resposta: #2, #5` |
| 14 | caso contrário | success | `APROVADO por <Gemini \| Claude (prumo-revisor)> em <sha7>` (+ ` (rebase neutro)` se o veredito é de outro head) |

**Emergência e spec (FR-024)**: as regras 0–7 valem também para emergências. Hotfix que altera
produto usa a branch `NNN-slug` da feature afetada (recriada a partir da `main`, onde
`specs/NNN-slug/spec.md` já existe); hotfix só de processo é kind=processo. Trava: nunca em PR
de emenda nem em PR que toca `GATE_SELF_PATHS`. O rótulo `emergencia` só é aplicado pelo Doug
(negado aos agentes — contrato review-cli) e o `pr:merge` exige a confirmação dele. Como a regra
8 produz `success`, a exceção passa pelo ruleset sem nenhum bypass (FR-005).

**Validade do veredito** (antes das regras 10–13): candidatos = reviews + comentários de issue
(exceto `prumo:avisos`), ordenados por `publishedAt`; identidade pelo catálogo; `parseVerdict`;
re-revisão que não cobre em "Achados anteriores" todos os # do veredito MUDANÇAS anterior é
desconsiderada (aviso).

**Avisos** (não mudam o estado): `veredito de <agente> desconsiderado: não é o revisor
designado`; `veredito fora do formato (<detalhe do catálogo>)`; `veredito incoerente: APROVADO
com achado CRÍTICO/ALTO`; `PR altera o portão ou os revisores — revisão manual do Doug
obrigatória` (arquivos em `GATE_SELF_PATHS`).

**Kind**: emenda ⊃ processo ⊃ feature (research R-06). Processo e emenda não exigem spec nem
iniciativa, mas exigem rótulo de autor e veredito.

## `main-guard` (FR-004c detectivo, FR-024)

Com o ruleset, push direto, merge sem os checks e merge fora de squash são **recusados pelo
servidor**. O `main-guard` continua porque o ruleset só confere que o status "Revisão
independente" está verde — não que o veredito é válido. Um status forjado por um workflow na
versão do PR (PR da própria conta) satisfaria o ruleset; o `main-guard` recalcula e alerta.

| Gatilho | Onde | Verificação | Violação |
|---|---|---|---|
| `push` em `main` | job `main-guard` ("Guarda da main") **dentro de `ci.yml`**, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, permissões `contents: read, pull-requests: read, issues: write, checks: read`; `deploy-db` tem `needs: [quality, unit, integration, e2e, main-guard]` | commit com 1 pai; `GET /commits/{sha}/pulls` retorna PR integrado com `merge_commit_sha == sha`; no head do PR, todos os `requiredChecksFromCi(ci.yml)` com check run `success` do app `github-actions`; **`evaluateGate` recalculado** = success | issue `violacao-main` (título `Violação da proteção da main: <sha7>`), atribuída a `dougueta`; job falha ⇒ `deploy-db` não roda |
| `push` em `main` com PR `emergencia` | mesmo job | como acima, com regra 8 | cria issue `emergencia` "Revisão pós-merge pendente: #N" (não é violação) |
| `schedule` diário 11:00 UTC | `.github/workflows/main-guard.yml` (só `schedule` + `workflow_dispatch`), `permissions: {issues: write, pull-requests: read}`, checkout da `main`, sem segredos | issues abertas `emergencia`: existe veredito válido do revisor designado publicado após `merged_at`? | sim: fecha a issue com link; > 7 dias sem: título prefixado `VENCIDA —` e comentário mencionando `@dougueta` |

Idempotente: busca issue aberta com o mesmo título antes de criar. Risco residual (ADR 0007): o
deploy de produção da Vercel a partir da `main` não espera o `main-guard`.
