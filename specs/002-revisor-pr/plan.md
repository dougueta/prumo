# Implementation Plan: Revisor de PR Independente

**Branch**: `002-revisor-pr` | **Date**: 2026-10-03 (remediação pós-analyze e Gate 2: 2026-10-05) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-revisor-pr/spec.md`

## Summary

Transformar a Constitution VIII em mecanismo verificável: (1) **Gemini Code Assist** (consumer,
gratuito) revisa PRs `autor:claude`/`autor:doug` guiado por `.gemini/config.yaml` +
`.gemini/styleguide.md`, terminando a review com um bloco de veredito padronizado; (2) uma
**skill do Claude Code** monta um pacote fechado e despacha um **subagente sem histórico**
(`revisor-limpo`) que revisa PRs `autor:gemini`; o Doug publica o veredito pelo **GitHub App
gratuito `prumo-revisor`** (chave cifrada com senha); (3) um workflow `review-gate` calcula o
status **"Revisão independente"** lendo vereditos, rótulos, trailers de autoria e arquivos do PR
(tabela de decisão pura e testada); (4) **proteção da `main` no servidor** — com o repositório
público (D1 = A, decidida) um ruleset sem bypass exige PR, os checks de CI e a "Revisão
independente" (fixados ao app GitHub Actions), branch atualizada, squash, e recusa push direto,
force-push e deleção; `pr:merge` e `main-guard` recalculam a decisão porque o ruleset só vê o
status; (5) template de PR, rótulos/marcos, fluxo de emergência (depende da emenda v1.2.0, com
trava), espelho revisável dos workflows e fim da exceção de bootstrap. Detalhes e fontes em
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdados da 001)
**Primary Dependencies**: nenhuma nova. `tsx` 4.23.15 e `yaml` 2.9.1 (já dev-deps da 001);
`node:crypto` (JWT RS256, chave PKCS#8 cifrada, sha256); `fetch` nativo; `gh` CLI do Doug para
leituras locais; YAML de workflow do GitHub Actions
**Storage**: N/A — estado vive no GitHub (rótulos, reviews, comentários, commit statuses, issues, ruleset)
**Testing**: Vitest 5 projeto `unit` (`tests/unit/**`; funções puras e scripts de IO com
`fetch`/`exec`/TTY falsos e fixtures sintéticas no formato da API; rede externa bloqueada por
`tests/setup.ts`) + testes de configuração (parse de YAML/JSON/Markdown versionados) + roteiro
de aceite manual em PRs de teste (quickstart §2)
**Target Platform**: GitHub (repo **público** `dougueta/prumo`, plano Free) · GitHub Actions
`ubuntu-latest` · Windows (Git Bash) para comandos locais
**Project Type**: tooling de repositório dentro do projeto Next.js único
**Performance Goals**: status recalculado ≤ 2 min após o evento; veredito Gemini ≤ 15 min
(SC-004); veredito Claude ≤ 30 min (SC-005); `main-guard` alerta ≤ 5 min
**Constraints**: R$ 0; nenhum segredo no repo; portão nunca executa código do PR nem usa
segredos; Gemini não revisa `.github/workflows/**` (coberto pelo espelho)
**Scale/Scope**: 1 aprovador, 2 agentes, ~15 PRs/mês

### Coerência com o que a 001 entregou (verificado em `001-setup-projeto`)
- `ci.yml` jobs: `Qualidade (lint, formato, tipos)`, `Testes unitários`, `Testes de integração
  (Supabase efêmero)`, `Testes ponta a ponta (Playwright)` + `deploy-db` (`if:` push na main,
  `environment: production`). A 002 **não fixa** esses nomes: `requiredChecksFromCi`
  (data-model §1.1) os deriva do `ci.yml` da `main` (jobs sem `if`), e o `gh:ruleset` usa a
  mesma lista.
- `package.json`: scripts `lint`, `format:check`, `typecheck`, `test:unit`, `check`,
  `synthetic` (via `tsx`) — os novos scripts seguem o mesmo padrão.
- `.gitignore` já ignora `.env.*` e `*.pem`: só `.review/` é novo.
- ESLint proíbe `process.env` em `src/**` (exceto `src/lib/env.ts`) — compatível com lógica
  pura em `src/review/` e IO em `scripts/review/`.
- `tests/setup.ts` bloqueia rede externa.

## Pré-requisitos (bloqueantes — task T055)

1. Emenda da constitution **v1.1.0** (teto de custo, modo demonstração) integrada na `main`.
2. Emenda da constitution **v1.2.0**, aprovada pelo Doug em 2026-10-05, integrada na `main`:
   Princípio VIII com (a) a exceção de emergência — merge sem veredito só com rótulo `emergencia`
   aplicado pelo Doug, revisão pós-merge obrigatória em até 7 dias, PR sem revisão após o prazo
   vira VENCIDA e é sinalizado — **com a trava** (não vale para PRs que alteram a constitution
   ou os mecanismos de revisão); (b) o **insumo real de cada revisor** (Gemini Code Assist: diff,
   repositório e corpo do PR; Claude limpo: só o pacote) — resolve C4.
3. 001 integrada; ordem de merge da onda 1 (decisão D-D): **004 → 003 → 006 → 002**. A 002 é o
   último PR sob a exceção de bootstrap; antes de abrir o PR, rebase na `main` com todas elas.

## Decisão D1 — DECIDIDA (Doug, 2026-10-05): **A · repositório público**

O repositório já foi tornado público. Rulesets/branch protection passam a existir no plano
gratuito; a proteção da `main` volta a ser **no servidor**, e a spec (FR-001, FR-002, FR-003,
FR-005, US1 1–5, SC-002, SC-003) vale como escrita — sem a redação "compensatória" da opção C.

**Mecanismo principal — ruleset "main protegida"** (data-model §7, `npm run gh:ruleset`): PR
obrigatório; `required_status_checks` estrito (branch atualizada) com os jobs de PR do `ci.yml`
+ "Revisão independente", **todos com `integration_id` do GitHub Actions** (status criado com o
token pessoal do Doug — que os agentes usam — não satisfaz a regra); só squash; histórico
linear; bloqueio de force-push e deleção; `bypass_actors: []` (nem admin).

**Camadas da opção C — o que fica e o que sai**

| Camada | Decisão | Justificativa |
|---|---|---|
| Deny rules dos agentes (`.claude/settings.json`, `.gemini/settings.json`) | **Mantida** | Os agentes usam a conta do Doug: para o servidor, um merge de agente é um merge do Doug. Só a negação local implementa FR-004(a) |
| `pr:merge` com TTY, recálculo do portão e confirmações | **Mantido** | O ruleset confere apenas que o status está verde; um workflow na versão do PR (PR da própria conta, evento `pull_request_review`) ainda pode publicar status via `GITHUB_TOKEN` com o mesmo `integration_id`. Recalcular `evaluateGate` fecha essa brecha; as confirmações `revisei`/`emergencia` registram o papel do Doug |
| `main-guard` no push (job do `ci.yml`, `deploy-db` depende dele) | **Mantido** | Detecta merge cujo portão não se confirma ao recalcular (ex.: merge pela interface com status forjado) e cria as issues de emergência; impede migração de produção nesses casos |
| `main-guard` agendado (emergências, VENCIDA) | **Mantido** | Exigido pelo FR-024 e pela v1.2.0 |
| Hook `pre-push` + `prepare`/`setup-hooks.mjs` | **Removido** | O servidor recusa push direto, force-push e deleção para todos; o hook só duplicava localmente e trazia o risco de quebrar `npm install` na Vercel. Tasks T020, T057, T058 removidas |
| `behind_by` no `pr:merge` | Mantido (mensagem antecipada) | O ruleset estrito já impede; o cálculo local só dá a mensagem clara (exit 7) |

### Análise de ameaça — repositório público (também no ADR 0007, task T024)

Já aplicado no GitHub pelo Doug em 2026-10-05: environment `production` restrito à branch
`main`; aprovação obrigatória de workflows para **todo** colaborador externo; secret scanning e
push protection ativos.

| Ameaça | Controle |
|---|---|
| PR de fork executando código com token de escrita ou segredos via `pull_request_target`/`issue_comment` | Workflows da 002 não fazem checkout do head nem de `refs/pull/*`, só da `main` (`persist-credentials: false`); nenhum `secrets.*` além de `GITHUB_TOKEN`; nenhum `environment`; permissões mínimas por job (contrato review-gate); verificado por T061 |
| Injeção de texto do PR (título, corpo, branch, comentário) em `run:` | Proibido interpolar `github.event.*` textual; só o número do PR entra via `env`; saídas usam apenas textos do catálogo (T061, T062) |
| `pull_request_review` de fork rodando workflow da versão do fork | Token somente leitura e sem segredos; o job `redispatch` só tem `actions: write` (negado a fork) e não faz checkout; aprovação de workflows externos ativa |
| PR de terceiro integrado | Regra 0 do portão (FR-026): autor ≠ `dougueta` ou fork ⇒ failure; ruleset exige o status verde |
| Veredito falso publicado por terceiro em comentário | Identidade só por `user.login` + `type: Bot` do catálogo; respostas só da conta `dougueta` |
| Segredos de produção expostos a PR | `deploy-db` só em push na `main`, `environment: production` restrito à `main`; CI de PR da 001 não usa segredos |
| Segredo ou dado real já no histórico | Secret scanning ativo (varre o histórico); auditoria T073 (alertas zerados, `.env.example` sem valores, fixtures sintéticas, roadmap sem dado financeiro real — Constitution II) |
| Preview da Vercel para PR de fork | T073 confirma a proteção de fork da Vercel ativa; preview roda em modo demonstração sem banco nem segredos (001) |
| Abuso de minutos/ruído (comentários em massa) | Minutos de Actions gratuitos em repo público; `concurrency` cancela runs redundantes |
| Exposição de informação de produto (roadmap cita os bancos do Doug) | Aceita pelo Doug ao escolher A; sem dados financeiros reais no repositório (Constitution II) |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 002 aprovada (Gate 1) + remediação e decisões do Gate 2 em Clarifications; portão bloqueia PR de feature sem spec (FR-012); hotfix de emergência usa a branch/spec da feature afetada | ✅ |
| II. Privacidade | Segredos de **ferramenta local** (chave do app) fora do repo, cifrados com senha que só o Doug digita, nunca em logs (interpretação registrada no ADR 0007); repo público: secret scanning + push protection, auditoria T073, workflows sem segredos; fixtures sintéticas | ✅ |
| III. Dinheiro exato | N/A — sem valores monetários | ✅ |
| IV. Rastreabilidade | Veredito ligado ao `head` sha (ou impressão de conteúdo); respostas por #; issues de violação/emergência auditáveis | ✅ |
| V. Test-first | Toda função pura de `src/review/`, todo script de IO de `scripts/review/`, todo workflow e toda configuração versionada têm teste vermelho antes (tasks.md); integração com o GitHub testada contra `contracts/github-api.openapi.yaml` com `fetch` falso | ✅ |
| VI. IA assistente | Revisores são IA, mas o Doug decide o merge; vereditos explicam cada achado | ✅ |
| VII. Donos de dados / demo | Sem tabelas; N/A para modo demonstração (nenhuma tela) | ✅ |
| VIII. Revisão independente | É o objeto da feature. Exceção de emergência (FR-024, com trava) e descrição do insumo real de cada revisor (C4) **passam a ser conformes com a emenda v1.2.0** (pré-requisito T055). Workflows revisados pelo Gemini via espelho (C5, T072) | ✅ (condicionado à v1.2.0 integrada) |
| IX. Qualidade dos artefatos | data-model tipado + máquina de estados; contratos OpenAPI (`github-api.openapi.yaml`) + tabelas de decisão/CLI; Gherkin abaixo; rastreabilidade FR→task→teste em 100% (tasks.md) | ✅ |
| X. Simplicidade | Zero dependências novas; status único; sem servidor/webhook; camadas da opção C reduzidas ao que agrega; complexidade justificada abaixo | ✅ |
| Custo R$ 0 | Repo público (Actions ilimitado em runners padrão), Gemini Code Assist consumer, GitHub App, Claude Code já assinado; `cost.test.ts` impede dependência/ação paga | ✅ |

**Re-check pós-design (2026-10-05, Gate 2)**: sem violações, condicionado à emenda v1.2.0
integrada na `main` antes da implementação.

## Governança (Princípio VIII) — decidido no Gate 2

- **C4 — insumos do revisor**: **resolvido pela emenda v1.2.0** (Princípio VIII descreve o insumo
  real: Gemini Code Assist lê diff, repositório e corpo do PR; Claude limpo recebe só o pacote).
  A 002 apenas aplica: styleguide do Gemini instruído a não usar justificativas do corpo do PR
  antes de formar o veredito (T028); pacote fechado do Claude (data-model §3).
- **C5 — `.github/workflows/**` sem revisor agente**: **espelho revisável, sem emenda**. O teste
  `tests/unit/review/workflows-mirror.test.ts` (T072) exige que
  `tests/unit/review/__snapshots__/workflows.md` contenha, em blocos nomeados, o conteúdo exato
  de cada `.github/workflows/*.yml`. Toda mudança de workflow obriga a atualizar o espelho, que o
  Gemini revisa (está fora de `.github/workflows/`). O espelho está em `GATE_SELF_PATHS`.

## Project Structure

### Documentation (this feature)

```text
specs/002-revisor-pr/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (veredito.md · review-gate.md · review-cli.md · github-api.openapi.yaml)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/review/                         # lógica pura (sem IO, sem process.env)
├── catalog.ts                      # constantes do data-model §1
├── types.ts                        # tipos do data-model §2
├── ci-checks.ts                    # requiredChecksFromCi (data-model §1.1)
├── fingerprint.ts                  # patchFingerprint — rebase neutro (data-model §2.1)
├── parse-verdict.ts                # contrato veredito §1
├── parse-responses.ts              # contrato veredito §2
├── authorship.ts                   # trailers → Agent; rótulos → Agent; autor externo/fork
├── classify-pr.ts                  # kind, spec esperada, touchesGate
├── evaluate-gate.ts                # tabela de decisão do contrato review-gate
├── main-guard.ts                   # regras do main-guard (puro, recalcula evaluateGate)
├── merge-readiness.ts              # decisão do pr:merge (recalcula, behind_by, TTY, confirmações)
├── ruleset.ts                      # monta o ruleset do data-model §7 a partir do ci.yml
├── bundle.ts                       # seleção de arquivos + manifest (puro)
├── publish-format.ts               # monta o comentário final (marcador head=, Insumos lidos)
├── warnings-comment.ts             # corpo do comentário prumo:avisos
├── labels.ts                       # diff rótulos/marcos existentes × desejados
└── app-jwt.ts                      # JWT RS256 com node:crypto (chave cifrada + senha)
scripts/review/                     # IO (GitHub API, fs, exec, TTY, process.env) — fora de src/
├── github.ts                       # cliente mínimo (fetch injetável) → PrSnapshot, check runs, compare
├── gate.ts                         # entrada do workflow review-gate
├── main-guard.ts                   # entrada do job main-guard (push) e do workflow agendado
├── bundle.ts · publish.ts · merge.ts
├── labels.ts · repo-settings.ts · ruleset.ts
.github/
├── pull_request_template.md
└── workflows/ review-gate.yml · main-guard.yml (só schedule) · ci.yml (+ job main-guard; deploy-db needs)
.gemini/ config.yaml (novo) · styleguide.md (atualizado) · settings.json (excludeTools)
.claude/
├── settings.json                   # permissions.deny (contracts/review-cli.md §Negação)
├── agents/revisor-limpo.md         # subagente: tools Read, Glob, Grep
└── skills/revisar-pr/SKILL.md      # /revisar-pr <n>
tests/unit/review/                  # um arquivo por módulo/script/config + fixtures/ + __snapshots__/workflows.md
docs/ workflow.md · review-checklist.md · gemini-handoff.md · adr/0007-protecao-main-repo-publico.md
AGENTS.md · GEMINI.md · CLAUDE.md   # fim do bootstrap, trailers, rótulos, espelho, fluxo de revisão
.gitignore                          # + .review/
package.json                        # scripts review:*, pr:merge, gh:*
```

**Structure Decision**: lógica pura em `src/review/` (padrão da 001 com `src/synthetic/`), IO
em `scripts/review/` (que podem ler `process.env`, como `scripts/synthetic.ts`). Sem pacote
separado (X).

## Design Detalhado

### Algoritmo — `evaluateGate(s: PrSnapshot): GateResult` (FR-006–FR-013, FR-024, FR-026)
0. `s.authorLogin ≠ OWNER_LOGIN` ou `s.headRepoFullName ≠ REPO_FULL_NAME` → failure (0)
   `PR de autor externo — não aceito`.
1. `kind = classifyPr(s.changedFiles)`: emenda se contém `CONSTITUTION_PATH`; processo se
   todos casam `PROCESS_PATHS`; senão feature. `touchesGate` = algum arquivo casa
   `GATE_SELF_PATHS` ⇒ aviso "PR altera o portão ou os revisores — revisão manual do Doug
   obrigatória".
2. Se `s.draft` → pending (regra 1).
3. `authorLabels = labels ∩ AUTHOR_LABELS`; ≠ 1 → failure (2). `labelAgent` = sufixo.
4. `trailerAgents = ⋃ agentsFromTrailers(commit.message)` (regex `^Co-Authored-By:.*\b(Claude|Gemini)\b`
   case-insensitive, por linha). `|trailerAgents| > 1` → failure (3).
   `commitAgent = único ou "doug"`; `≠ labelAgent` → failure (4).
5. kind=feature: sem `iniciativa:N` → failure (5); `!/^\d{3}-[a-z0-9-]+$/.test(headRef) ||
   !s.specExists` → failure (6). (Hotfix de emergência usa a branch `NNN-slug` da feature
   afetada — passa aqui sem regra especial.)
6. kind=emenda: `constitutionPatch` precisa ter linhas `+`/`-` com `**Version**:` e com
   `Version change:` → senão failure (7).
7. `emergencia ∈ labels`: se kind = emenda ou `touchesGate` → failure (9, trava); motivo =
   regex `/Motivo da emergência:\s*(.{20,})/` no body → success (8) com `emergency = true`, ou
   failure (9, sem motivo).
8. `designated = REVIEWER_BY_AUTHOR[labelAgent]`. Candidatos = reviews + issueComments (exceto
   `WARNINGS_MARKER`) ordenados por `publishedAt`. Para cada um: identidade → revisor (ou
   nenhum); se ≠ designated e contém marcador → aviso (desconsiderado); `parseVerdict` → se
   erro, aviso; para Gemini, `inlineSeverities` = selos dos `reviewComments` com
   `pull_request_review_id == review.id`.
9. **Contexto de re-revisão (FR-020)**: percorrendo os válidos em ordem, se o anterior válido é
   MUDANÇAS e `{n} ⊄ current.previous.n` → desconsidera `current` (aviso "fora do formato
   (Achados anteriores incompletos)").
10. `valid` vazio → pending (10).
11. `last = valid.at(-1)`; `last.headSha ≠ s.headSha` e não
    (`fp[last.headSha] ≠ null ∧ fp[last.headSha] = fp[s.headSha]`) → pending (11).
12. `effective = incoerente(last) ? MUDANÇAS : last.outcome`; MUDANÇAS → failure (12) com contagem.
13. `prev = último veredito válido MUDANÇAS anterior a last`; se existe:
    `respondidos = ⋃ parseResponses(c)` para comentários `RESPONSE_MARKER` da conta `dougueta`
    publicados entre prev e last, com `corrigido` cujo sha ∈ `s.commits`;
    `faltam = prev.findings.n − respondidos` (≠ ∅ → failure 13).
14. success (14): `APROVADO por <REVIEWER_DISPLAY> em <sha7>` (+ " (rebase neutro)").

Ordenação estável, nenhuma chamada de rede; `reason` truncado em 140 caracteres; avisos e
motivos só com textos do catálogo, números e shas.

### Algoritmo — `scripts/review/gate.ts`
1. Lê o número do PR de `env.PR_NUMBER` (inteiro validado). Monta `PrSnapshot` (`github.ts`):
   PR (inclui `user.login` e `head.repo.full_name`), commits, files, reviews, review comments,
   issue comments, `specExists` (contents 404/200 no head), `constitutionPatch`,
   `fingerprints` via compare `main...<sha>` para o head e cada `headSha` de veredito.
2. `evaluateGate` → `POST statuses` (contrato review-gate §Saídas) → upsert/delete do comentário
   `prumo:avisos` → job summary.
3. Erro de API (política do OpenAPI) → status pending "não foi possível avaliar…" e exit 1.

### Algoritmo — `main-guard` (push na main — job do `ci.yml`)
1. `parents.length ≠ 1` → violação "commit não é squash" (o ruleset já impede; defesa em profundidade).
2. `pulls = GET /commits/{sha}/pulls`; procurar `merged_at != null && merge_commit_sha == sha`;
   nenhum → violação "commit sem PR".
3. `required = requiredChecksFromCi(ci.yml do commit)`; no `head.sha` do PR, cada `required` com
   check run `conclusion = success` e `app.slug = github-actions`; senão violação.
4. **Recalcula** `evaluateGate(snapshot do PR)`; ≠ success → violação com o `reason`.
5. Se o PR tem `emergencia` (regra 8) → criar issue "Revisão pós-merge pendente: #N".
6. Violação → issue `violacao-main` (idempotente por título) atribuída a `dougueta` + `exit 1`;
   `deploy-db` (`needs: main-guard`) não aplica migrações.
7. Agendado (`main-guard.yml`): para issues abertas `emergencia`, procurar veredito válido do
   revisor designado publicado após `merged_at` no PR → fecha a issue com link; se
   `agora − merged_at > 7 d` → prefixa `VENCIDA —` e comenta mencionando `@dougueta`.

### Algoritmo — `pr:merge` (FR-002–FR-004)
1. Exige TTY (exit 8). 2. Snapshot local (`gh auth token`) + `evaluateGate` + check runs +
`compare main...head`. 3. `mergeReadiness` (data-model §2): checks (6), gate ≠ success (6),
`behind_by > 0` (7), `touchesGate` sem a confirmação `revisei` (9), `emergency` sem a
confirmação `emergencia` (9). 4. `gh pr merge <n> --squash --delete-branch` (o ruleset revalida
no servidor).

### Algoritmo — `gh:ruleset`
`buildRuleset(requiredChecksFromCi(ci.yml da main))` (puro, `src/review/ruleset.ts`) →
`GET /rulesets` → `PUT` se "main protegida" existe, senão `POST`. Reexecutar sempre que o
`ci.yml` ganhar/perder job de PR (item do checklist do autor e de `docs/workflow.md`).

### Algoritmo — revisão Claude em contexto limpo (FR-017, FR-018)
1. `review:bundle <n>`: `gh pr view --json` (rótulos, draft, head/base, autor) → valida
   `autor:gemini` e autor interno (exit 3 caso contrário); `git fetch origin pull/<n>/head`;
   `git diff base...head > diff.patch`; copia do **head** `specs/<branch>/{spec,plan,tasks,data-model}.md`
   + `contracts/**`; da **`main`** a constitution, `docs/adr/*.md` e `docs/review-checklist.md`;
   em re-revisão, `anteriores/veredito.md` e `anteriores/respostas.md`; escreve `manifest.json`.
   (O pacote é só lido pelo subagente — nenhum código do PR é executado.)
2. Skill despacha `revisor-limpo` (tools Read/Glob/Grep; prompt fixo, sem resumo do PR).
3. O Doug roda `review:publish <n>` no terminal: `parseVerdict(veredito.md)` → re-lê head do PR
   (= `manifest.headSha`?) → substitui/insere "Insumos lidos" a partir do manifest → prefixa
   marcador com `head=` → pede a senha (TTY, sem eco) → JWT → token do app → `POST issues/<n>/comments`.

### Máquina de estados
Ver [data-model.md §4](data-model.md). Transições proibidas: aprovado com veredito de outro head
sem equivalência; aprovado com veredito do autor; aprovado para PR externo/fork; merge aceito com
base só no status publicado; emergência sem motivo ou em PR de emenda/mecanismo de revisão;
integrado sem aprovado/emergência.

### Padrões e bibliotecas
- **Permitidas**: `node:crypto`, `node:fs`, `node:child_process` (só em `scripts/`), `fetch`,
  `tsx`, `yaml` (já dev-dep: parse de `ci.yml` em `scripts/` e validação de configs em teste).
- **Proibidas** (verificado por `cost.test.ts`/`workflows.test.ts`): `@octokit/*`, `jsonwebtoken`,
  `@anthropic-ai/*`, `actions/github-script` com lógica inline, `anthropics/claude-code-action`/API
  paga, gatilho `pull_request` no portão, checkout do head do PR, `secrets.*` (exceto
  `GITHUB_TOKEN`) e interpolação de texto do evento em `run:` nos workflows da 002.
- Funções puras + IO injetável (`fetch`, `exec`, `now`, `isTty`, `prompt`) — testáveis sem rede.

### Critérios de aceite (Gherkin, com verificação no GitHub)

```gherkin
Funcionalidade: Verificação "Revisão independente"
  Cenário: Aprovado pelo revisor designado no head atual
    Dado um PR "autor:claude" da conta "dougueta" com rótulo "iniciativa:0", spec existente e trailers "Claude"
    E uma review de "gemini-code-assist[bot]" com commit_id igual ao head e bloco "Veredito: APROVADO" sem achados ALTO/CRÍTICO
    Quando o review-gate avalia o PR
    Então o commit status "Revisão independente" do head é "success"
    E a descrição é "APROVADO por Gemini em <sha7>"

  Cenário: PR de autor externo
    Dado um PR aberto a partir de um fork pela conta "terceiro"
    Quando o review-gate avalia o PR, mesmo com rótulo "autor:claude" aplicado
    Então o status é "failure" com "PR de autor externo — não aceito"
    E o workflow não fez checkout do código do PR nem usou segredos

  Cenário: Veredito desatualizado
    Dado o PR aprovado acima
    Quando um novo commit que altera um arquivo do PR é enviado
    Então o status do novo head é "pending" com "veredito desatualizado — novo commit após a revisão"

  Cenário: Rebase neutro mantém o veredito
    Dado o PR aprovado acima
    Quando a branch é rebaseada na main sem conflito e sem alterar as mudanças do PR
    Então o status do novo head é "success" com "APROVADO por Gemini em <sha7> (rebase neutro)"

  Cenário: Doug cola um veredito
    Dado um comentário da conta "dougueta" contendo o bloco de veredito APROVADO
    Quando o review-gate avalia
    Então o status permanece "pending" com "aguardando veredito de Gemini"
    E o comentário "prumo:avisos" do PR contém "não é o revisor designado"

  Cenário: Veredito incoerente
    Dado uma review do Gemini com "Veredito: APROVADO" e um comentário de linha com selo "high-priority"
    Quando o review-gate avalia
    Então o status é "failure" com "mudanças necessárias"

  Cenário: Achado sem resposta
    Dado um veredito MUDANÇAS NECESSÁRIAS com achados #1, #2, #3
    E uma resposta "prumo:respostas" cobrindo #1 e #2
    E um novo veredito APROVADO no head atual com "Achados anteriores" #1, #2, #3
    Quando o review-gate avalia
    Então o status é "failure" com "achados sem resposta: #3"

  Cenário: Re-revisão sem "Achados anteriores"
    Dado um veredito MUDANÇAS NECESSÁRIAS com achados #1, #2
    E um novo veredito APROVADO sem a seção "Achados anteriores"
    Quando o review-gate avalia
    Então o status é "failure" com "mudanças necessárias: 2 achado(s)"
    E o comentário "prumo:avisos" contém "Achados anteriores incompletos"

  Cenário: Justificativa aceita
    Dado um veredito MUDANÇAS com o achado #1 e uma resposta "justificado" para #1
    E um novo veredito APROVADO com "Achados anteriores" "| 1 | justificativa aceita |"
    Quando o review-gate avalia
    Então o status é "success"

  Cenário: PR sem spec
    Dado um PR "autor:claude" da branch "999-teste" alterando "src/app/page.tsx" e sem "specs/999-teste/spec.md"
    Quando o review-gate avalia
    Então o status é "failure" com "PR sem spec (Constitution I)"

  Cenário: Iniciativa ausente
    Dado um PR de feature "autor:claude" sem rótulo "iniciativa:N"
    Quando o review-gate avalia
    Então o status é "failure" com "rótulo de iniciativa ausente"

  Cenário: Commits de dois agentes
    Dado um PR com um commit com trailer "Claude" e outro com trailer "Gemini"
    Quando o review-gate avalia
    Então o status é "failure" com "PR com mais de um agente autor"

  Cenário: Emenda sem versão
    Dado um PR que altera ".specify/memory/constitution.md" sem mudar "**Version**:"
    Quando o review-gate avalia
    Então o status é "failure" com "emenda sem versão/Sync Impact Report atualizados"

  Cenário: Emergência
    Dado um PR da branch "012-extrato-consolidado" com rótulo "emergencia" aplicado pelo Doug e corpo "Motivo da emergência: produção fora do ar ao abrir o extrato"
    Quando o review-gate avalia
    Então o status é "success" com "EMERGÊNCIA — revisão independente pós-merge em até 7 dias"
    E após o merge existe uma issue aberta "Revisão pós-merge pendente: #<n>"

  Cenário: Emergência em PR que altera o portão (trava)
    Dado um PR com rótulo "emergencia", motivo registrado e alteração em "src/review/evaluate-gate.ts"
    Quando o review-gate avalia
    Então o status é "failure" com "emergência não vale para PR que altera a constitution ou os mecanismos de revisão"

  Cenário: Emergência vencida
    Dado uma issue "Revisão pós-merge pendente: #<n>" de um PR integrado há 8 dias sem veredito pós-merge
    Quando o main-guard agendado roda
    Então o título da issue começa com "VENCIDA —" e há um comentário mencionando "@dougueta"

Funcionalidade: Revisor Claude em contexto limpo
  Cenário: Publicação pelo app
    Dado um PR "autor:gemini" aberto
    Quando o Doug executa "/revisar-pr <n>" e depois "npm run review:publish -- <n>" digitando a senha da chave
    Então existe um comentário de "prumo-revisor[bot]" com marcador "head=<head atual>" e seção "Insumos lidos"
    E todos os itens de "Insumos lidos" constam no manifest.json do pacote

  Cenário: Publicação sem o Doug
    Dado um pacote revisado
    Quando "npm run review:publish -- <n>" é executado fora de terminal interativo
    Então o processo termina com código 8 e nenhum comentário é publicado

  Cenário: Mesmo agente
    Dado um PR "autor:claude"
    Quando executo "npm run review:bundle -- <n>"
    Então o processo termina com código 3 e "revisor e autor são o mesmo agente"

Funcionalidade: Template de PR
  Cenário: PR novo usa o modelo
    Quando um PR é aberto no repositório
    Então o corpo contém as seções "Feature", "Artefatos", "Tipo", "Rótulos", "Checklist do autor" e "Respostas aos achados"

Funcionalidade: Proteção da main
  Cenário: Push direto
    Quando o Doug executa "git push origin HEAD:main"
    Então o servidor recusa o push (ruleset "main protegida")
  Cenário: Force-push e deleção
    Quando alguém tenta "git push --force origin main" ou apagar a branch main
    Então o servidor recusa
  Cenário: Merge sem verificação
    Dado um PR com "Revisão independente" pending
    Quando o Doug tenta o merge pela interface
    Então o botão de merge está indisponível
  Cenário: Status forjado
    Dado um PR sem veredito cujo status "Revisão independente" foi marcado "success" por um workflow na versão do PR
    Quando o Doug executa "npm run pr:merge -- <n>"
    Então o processo termina com código 6 e "aguardando veredito de Gemini"
  Cenário: Merge com status forjado pela interface
    Dado o PR acima integrado pela interface
    Quando o job main-guard do CI roda
    Então existe uma issue "violacao-main" atribuída a "dougueta", o job falha e "deploy-db" não roda
  Cenário: Branch desatualizada
    Dado um PR aprovado cuja branch está 1 commit atrás da main
    Quando o Doug executa "npm run pr:merge -- <n>"
    Então o processo termina com código 7
```

## Ações externas na implementação (⚠️ exigem confirmação do Doug no momento)
1. (Feito em 2026-10-05) repositório público; environment `production` restrito à `main`;
   aprovação de workflows externos; secret scanning + push protection.
2. Instalar Gemini Code Assist (consumer) só em `dougueta/prumo`.
3. Criar e instalar o GitHub App `prumo-revisor` (Pull requests: write), cifrar a chave com
   senha e guardar o `.pem` fora do repo.
4. Executar `npm run gh:labels`, `npm run gh:repo-settings` e `npm run gh:ruleset` (escrevem no
   GitHub; `--dry-run` antes).
5. Auditoria do repositório público (T073).
6. Abrir PRs de teste para o roteiro de aceite (quickstart §2) e apagá-los ao final.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Gemini não emite o bloco de veredito (ou "Achados anteriores") de forma confiável | média | Spike T010 logo no início; re-acionamento `/gemini review`; plano B (veredito derivado dos selos) exigiria emenda da spec |
| Gemini ignorar também o espelho dos workflows | baixa | Spike T010(f); se ignorar, levar ao Doug a alternativa de emenda (revisão manual registrada) |
| Status "Revisão independente" forjado por workflow na versão de um PR da própria conta | média | `pr:merge` recalcula; `main-guard` recalcula e alerta; `deploy-db` espera o `main-guard` |
| Workflow inseguro com repo público (`pull_request_target`/`issue_comment`) | média sem controle | Sem checkout do PR, sem segredos, sem interpolação; T061 trava isso |
| Ruleset desatualizado quando o `ci.yml` muda | média | `gh:ruleset` idempotente; item do checklist do autor; `pr:merge`/`main-guard` derivam a lista em tempo real |
| Agente autor lê a chave do `prumo-revisor` | média | Chave cifrada com senha digitada pelo Doug (TTY); deny de leitura de `~/.prumo/**` |
| Regras de deny dos agentes contornáveis (padrões de texto; PTY do Gemini CLI) | média | Servidor exige as condições do FR-002 de qualquer forma; risco residual "agente integra PR já aprovado" no ADR 0007 |
| Deploy de produção da Vercel não espera o `main-guard` | baixa | Ruleset impede o caminho comum; risco residual no ADR 0007 |
| Rebase obrigatório invalida veredito | alta sem mitigação | Rebase neutro por impressão de conteúdo |
| Cota do Gemini (33–100 PRs/dia) | baixa | Volume < 5/dia |

## Complexity Tracking

| Item | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Exceção de emergência (FR-024: regras 8–9 com trava, issue pós-merge, modo agendado, VENCIDA) | decisão D-A revisada do Doug; **depende da emenda v1.2.0** do Princípio VIII | sem exceção (rejeitada pelo Doug em 2026-10-05) |
| `workflow_dispatch` intermediário para `pull_request_review` | evita executar o portão na versão do PR | gatilho direto (inseguro) |
| Recalcular `evaluateGate` no `pr:merge` e no `main-guard` | o ruleset só vê o status, que um workflow na versão do PR pode publicar | confiar no status (inseguro) |
| Impressão de conteúdo para rebase neutro (compare + sha256) | constitution exige rebase antes do merge; sem isso cada rebase exige nova revisão | invalidar sempre (laço rebase→revisão com WIP 3) |
| Chave do app cifrada + senha no TTY | impede agente autor de publicar como revisor (FR-009) | chave em texto claro (forjável localmente) |
| Espelho dos workflows (C5) | Gemini não revisa `.github/workflows/**`; mantém VIII sem emenda | emenda com revisão manual do Doug |
