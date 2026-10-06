# Implementation Plan: Revisor de PR Independente

**Branch**: `002-revisor-pr` | **Date**: 2026-10-03 (remediação pós-analyze 2026-10-05) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-revisor-pr/spec.md`

## Summary

Transformar a Constitution VIII em mecanismo verificável: (1) **Gemini Code Assist** (consumer,
gratuito) revisa PRs `autor:claude`/`autor:doug` guiado por `.gemini/config.yaml` +
`.gemini/styleguide.md`, terminando a review com um bloco de veredito padronizado; (2) uma
**skill do Claude Code** monta um pacote fechado e despacha um **subagente sem histórico**
(`revisor-limpo`) que revisa PRs `autor:gemini`; o Doug publica o veredito pelo **GitHub App
gratuito `prumo-revisor`** (chave cifrada com senha); (3) um workflow `review-gate` calcula o
status **"Revisão independente"** lendo vereditos, rótulos, trailers de autoria e arquivos do PR
(tabela de decisão pura e testada) — status **informativo**: `pr:merge` e `main-guard`
recalculam a decisão e nunca confiam nele; (4) proteção da `main` — **o plano Free não oferece
branch protection nem rulesets em repositório privado** (HTTP 403 verificado), então o plano
propõe defesa em camadas R$ 0 (Decisão D1, ⚠️ Doug); (5) template de PR, rótulos/marcos, fluxo
de emergência (depende da emenda v1.2.0) e fim da exceção de bootstrap. Detalhes e fontes em
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdados da 001)
**Primary Dependencies**: nenhuma nova. `tsx` 4.23.15 e `yaml` 2.9.1 (já dev-deps da 001);
`node:crypto` (JWT RS256, chave PKCS#8 cifrada, sha256); `fetch` nativo; `gh` CLI do Doug para
leituras locais; YAML de workflow do GitHub Actions
**Storage**: N/A — estado vive no GitHub (rótulos, reviews, comentários, commit statuses, issues)
**Testing**: Vitest 5 projeto `unit` (`tests/unit/**`; funções puras e scripts de IO com
`fetch`/`exec`/TTY falsos e fixtures sintéticas no formato da API; rede externa bloqueada por
`tests/setup.ts`) + testes de configuração (parse de YAML/JSON/Markdown versionados) + roteiro
de aceite manual em PRs de teste (quickstart §2)
**Target Platform**: GitHub (repo privado `dougueta/prumo`, plano Free) · GitHub Actions
`ubuntu-latest` · Windows (Git Bash) para comandos locais
**Project Type**: tooling de repositório dentro do projeto Next.js único
**Performance Goals**: status recalculado ≤ 2 min após o evento; veredito Gemini ≤ 15 min
(SC-004); veredito Claude ≤ 30 min (SC-005); `main-guard` alerta ≤ 5 min
**Constraints**: R$ 0; nenhum segredo no repo; portão nunca executa código do PR; Gemini não
revisa `.github/workflows/**`; `npm install` nunca pode falhar por causa dos hooks (build da
Vercel)
**Scale/Scope**: 1 aprovador, 2 agentes, ~15 PRs/mês

### Coerência com o que a 001 entregou (verificado em `001-setup-projeto`)
- `ci.yml` jobs: `Qualidade (lint, formato, tipos)`, `Testes unitários`, `Testes de integração
  (Supabase efêmero)`, `Testes ponta a ponta (Playwright)` + `deploy-db` (`if:` push na main).
  A 002 **não fixa** esses nomes: `requiredChecksFromCi` (data-model §1.1) os deriva do `ci.yml`
  da `main` (jobs sem `if`), acomodando jobs novos de 003/004/006.
- `package.json`: scripts `lint`, `format:check`, `typecheck`, `test:unit`, `check`,
  `synthetic` (via `tsx`) — os novos scripts seguem o mesmo padrão.
- `.gitignore` já ignora `.env.*` e `*.pem`: só `.review/` é novo.
- ESLint proíbe `process.env` em `src/**` (exceto `src/lib/env.ts`) — compatível com lógica
  pura em `src/review/` e IO em `scripts/review/`.
- `tests/setup.ts` bloqueia rede externa; `.gitattributes` `eol=lf` (hook POSIX ok).

## Pré-requisitos (bloqueantes — task T055)

1. Emenda da constitution **v1.1.0** (teto de custo, modo demonstração) integrada na `main`
   (hoje só na branch `constitution-v1.1.0`, base desta worktree).
2. Emenda da constitution **v1.2.0** (Princípio VIII: exceção de emergência — merge sem veredito
   só com rótulo `emergencia` aplicado pelo Doug, revisão pós-merge obrigatória em até 7 dias,
   PR sem revisão após o prazo vira VENCIDA e é sinalizado) integrada na `main`. Sem ela o
   FR-024 viola o Princípio VIII.
3. 001 integrada; ordem de merge da onda 1 (decisão D-D): **004 → 003 → 006 → 002**. A 002 é o
   último PR sob a exceção de bootstrap; antes de abrir o PR, rebase na `main` com todas elas.

## Decisão D1 ⚠️ (confirmar com Doug no Gate 2) — proteção da `main` em repo privado gratuito

`GET /branches/main/protection` e `GET /rulesets` → **403 "Upgrade to GitHub Pro or make this
repository public"** (research R-03). Opções:

| Opção | Custo | Efeito |
|---|---|---|
| A. Repositório público | R$ 0 | Ruleset completo no servidor + Actions ilimitado; código/specs/roadmap públicos (o roadmap cita os bancos do Doug); `issue_comment`/`pull_request_target` passam a ser disparáveis por terceiros (exige revisão de ameaça adicional) |
| B. GitHub Pro | ≈ R$ 22/mês | Ruleset completo; **fere o teto R$ 0** (exige aprovação de custo) |
| **C. Privado + camadas compensatórias (recomendada)** | R$ 0 | Preventivo nos agentes (deny rules + hook `pre-push` + `pr:merge` com TTY que recalcula tudo) e **detectivo** no servidor (`main-guard` abre issue em ≤ 5 min e bloqueia `deploy-db`) |

**Impacto na spec (T001)** — em qualquer opção o FR-004 já foi reescrito (camadas; os agentes
usam a conta do Doug). **Se C**, reescrever antes de qualquer código:
- FR-001: "envio direto … MUST ser recusado nos agentes e no hook local e, se ocorrer, detectado
  e alertado em ≤ 5 min, sem implantar migrações";
- FR-002: "o merge pelo comando documentado MUST exigir …; merge por outra via é detectado";
- FR-005: "nenhuma camada pode ser desligada pelas configurações dos agentes; o servidor não
  impede o administrador — por isso a detecção é obrigatória";
- US1 cenários 1, 2, 3, 4, 6 ("o merge está indisponível" → "o comando de merge recusa e a
  página mostra o motivo");
- SC-002 ("0 commits fora de squash **não detectados**") e SC-003 ("bloqueado pelo comando de
  merge/hook ou detectado em 8 de 8").
Com A ou B a spec de FR-001/002/005 fica como está e a task T023 cria o ruleset.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 002 aprovada (Gate 1) + remediação registrada em Clarifications; portão bloqueia PR de feature sem spec (FR-012); hotfix de emergência usa a branch/spec da feature afetada. D1=C exige ajuste prévio da spec (T001) | ✅ (condicionado a D1) |
| II. Privacidade | Segredos de **ferramenta local** (chave do app) não são segredos do app: ficam fora do repo, cifrados com senha que só o Doug digita, nunca em logs; o token de instalação é de 1 h, restrito a 1 repo e 1 permissão; registrado no ADR 0007 como interpretação do II (que trata de segredos do app no servidor). Pacote `.review/` ignorado; fixtures sintéticas | ✅ |
| III. Dinheiro exato | N/A — sem valores monetários | ✅ |
| IV. Rastreabilidade | Veredito ligado ao `head` sha (ou impressão de conteúdo); respostas por #; issues de violação/emergência auditáveis | ✅ |
| V. Test-first | Toda função pura de `src/review/`, todo script de IO de `scripts/review/`, todo workflow e toda configuração versionada têm teste vermelho antes (tasks.md); integração com o GitHub testada contra `contracts/github-api.openapi.yaml` com `fetch` falso | ✅ |
| VI. IA assistente | Revisores são IA, mas o Doug decide o merge; vereditos explicam cada achado | ✅ |
| VII. Donos de dados / demo | Sem tabelas; N/A para modo demonstração (nenhuma tela) | ✅ |
| VIII. Revisão independente | É o objeto da feature. **Exceção de emergência (FR-024) só é conforme após a emenda v1.2.0** (pré-requisito T055). Pontos abertos C4/C5 em "Pendências de governança" | ⚠️ condicionado à v1.2.0 e à decisão de governança |
| IX. Qualidade dos artefatos | data-model tipado + máquina de estados; contratos OpenAPI (`github-api.openapi.yaml`) + tabelas de decisão/CLI; Gherkin abaixo; rastreabilidade FR→task→teste em 100% (tasks.md) | ✅ |
| X. Simplicidade | Zero dependências novas; status único em vez de app de checks; sem servidor/webhook; complexidade extra justificada abaixo | ✅ |
| Custo R$ 0 | Gemini Code Assist consumer (grátis), GitHub App (grátis), Actions ≈ 300 min/mês extra (total ≈ 700 de 2.000), Claude Code já assinado; teste `cost.test.ts` impede dependência/ação paga | ✅ (B violaria) |

**Re-check pós-design (2026-10-05)**: sem violações dentro do escopo da 002, condicionado a: D1,
emenda v1.2.0 integrada e decisão do Doug sobre C4/C5.

## Pendências de governança para o Doug (Princípio VIII) — **Aberto – decisão do Doug**

**C4 — insumos do revisor Gemini.** VIII diz que o revisor recebe "apenas diff, spec, plan,
tasks, constitution e ADRs". O pacote real inclui também data-model, contracts e o checklist
(e, em re-revisão, veredito anterior + respostas formais). O Gemini Code Assist, além disso, lê
o repositório inteiro e o corpo do PR — não há como restringi-lo.
- (a) **Emenda PATCH em VIII** descrevendo o insumo real de cada revisor: Claude limpo = pacote
  fechado (lista do data-model §3); Gemini = diff + repositório no head + corpo do PR, instruído
  pelo styleguide a ignorar justificativas do autor até formar o veredito.
- (b) Sem emenda: template de PR sem nenhum campo de justificativa (respostas só em comentário,
  já previsto) e styleguide limitando leitura. Não cumpre "apenas" literalmente (o Gemini segue
  vendo o repo).
- **Recomendação: (a)** — é a única que torna a regra verdadeira; (b) mantém um MUST que a
  ferramenta escolhida pela própria constitution não consegue cumprir.

**C5 — `.github/workflows/**` sem revisor agente.** O Gemini Code Assist não revisa arquivos de
workflow; o PR da 002 e o da 003 (T008 altera o `ci.yml`) mudam workflows.
- (a) Emenda PATCH em VIII: "arquivos que o revisor designado não consegue ler são revisados
  manualmente pelo Doug, registrado no PR".
- (b) **Sem emenda — espelho revisável**: teste `workflows-mirror.test.ts` exige que
  `tests/unit/review/__snapshots__/workflows.md` contenha o conteúdo exato de cada
  `.github/workflows/*.yml`; toda mudança de workflow obriga a atualizar o espelho, que o Gemini
  revisa (está fora de `.github/workflows/`). Custo: 1 teste + 1 arquivo (task condicional T072).
- **Recomendação: (b)** — mantém VIII literal com custo mínimo; (a) fica como plano B se o
  Gemini também ignorar o espelho (verificado no spike T010).

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
├── authorship.ts                   # trailers → Agent; rótulos → Agent
├── classify-pr.ts                  # kind, spec esperada, touchesGate
├── evaluate-gate.ts                # tabela de decisão do contrato review-gate
├── main-guard.ts                   # regras do main-guard (puro, recalcula evaluateGate)
├── merge-readiness.ts              # decisão do pr:merge (recalcula, behind_by, TTY, confirmações)
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
├── labels.ts · repo-settings.ts · ruleset.ts (só se D1 = A/B)
scripts/setup-hooks.mjs             # prepare tolerante (no-op em CI/Vercel/fora do git)
.github/
├── pull_request_template.md
└── workflows/ review-gate.yml · main-guard.yml (só schedule) · ci.yml (+ job main-guard; deploy-db needs)
.gemini/ config.yaml (novo) · styleguide.md (atualizado) · settings.json (excludeTools)
.claude/
├── settings.json                   # permissions.deny (contracts/review-cli.md §Negação)
├── agents/revisor-limpo.md         # subagente: tools Read, Glob, Grep
└── skills/revisar-pr/SKILL.md      # /revisar-pr <n>
.githooks/pre-push
tests/unit/review/                  # um arquivo por módulo/script/config + fixtures/
docs/ workflow.md · review-checklist.md · gemini-handoff.md · adr/0007-protecao-main-repo-privado.md
AGENTS.md · GEMINI.md · CLAUDE.md   # fim do bootstrap, trailers, rótulos, fluxo de revisão
.gitignore                          # + .review/
package.json                        # scripts review:*, pr:merge, gh:*, prepare
```

**Structure Decision**: lógica pura em `src/review/` (padrão da 001 com `src/synthetic/`), IO
em `scripts/review/` (que podem ler `process.env`, como `scripts/synthetic.ts`). Sem pacote
separado (X).

## Design Detalhado

### Algoritmo — `evaluateGate(s: PrSnapshot): GateResult` (FR-006–FR-013, FR-024)
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
7. `emergencia ∈ labels`: motivo = regex `/Motivo da emergência:\s*(.{20,})/` no body → success (8)
   com `emergency = true`, ou failure (9).
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

Ordenação estável, nenhuma chamada de rede; `reason` truncado em 140 caracteres.

### Algoritmo — `scripts/review/gate.ts`
1. Monta `PrSnapshot` (`github.ts`): PR, commits, files, reviews, review comments, issue
   comments, `specExists` (contents 404/200 no head), `constitutionPatch`, `fingerprints` via
   compare `main...<sha>` para o head e cada `headSha` de veredito distinto.
2. `evaluateGate` → `POST statuses` (contrato review-gate §Saídas) → upsert/delete do comentário
   `prumo:avisos` → job summary.
3. Erro de API (política do OpenAPI) → status pending "não foi possível avaliar…" e exit 1.

### Algoritmo — `main-guard` (push na main — job do `ci.yml`)
1. `parents.length ≠ 1` → violação "commit não é squash".
2. `pulls = GET /commits/{sha}/pulls`; procurar `merged_at != null && merge_commit_sha == sha`;
   nenhum → violação "commit sem PR".
3. `required = requiredChecksFromCi(ci.yml do commit)`; no `head.sha` do PR, cada `required` com
   check run `conclusion = success` e `app.slug = github-actions`; senão violação listando o que
   faltou.
4. **Recalcula** `evaluateGate(snapshot do PR)`; ≠ success → violação com o `reason`. O status
   publicado é ignorado (pode ter sido forjado por token com write ou pelo job `redispatch`).
5. Se o PR tem `emergencia` (regra 8) → criar issue "Revisão pós-merge pendente: #N" (rótulo
   `emergencia`).
6. Violação → issue `violacao-main` (idempotente por título) atribuída a `dougueta` + `exit 1`;
   como `deploy-db` tem `needs: main-guard`, migrações não são aplicadas.
7. Agendado (`main-guard.yml`): para issues abertas `emergencia`, procurar veredito válido do
   revisor designado publicado após `merged_at` no PR → fecha a issue com link; se
   `agora − merged_at > 7 d` → prefixa `VENCIDA —` e comenta mencionando `@dougueta`.

### Algoritmo — `pr:merge` (FR-002–FR-004)
1. Exige TTY (exit 8). 2. Snapshot local (`gh auth token`) + `evaluateGate` + check runs +
`compare main...head`. 3. `mergeReadiness` (data-model §2): checks (6), gate ≠ success (6),
`behind_by > 0` (7), `touchesGate` sem a confirmação `revisei` (9), `emergency` sem a
confirmação `emergencia` (9). 4. `gh pr merge <n> --squash --delete-branch`.

### Algoritmo — revisão Claude em contexto limpo (FR-017, FR-018)
1. `review:bundle <n>`: `gh pr view --json` (rótulos, draft, head/base) → valida `autor:gemini`
   (exit 3 caso contrário); `git fetch origin pull/<n>/head`; `git diff base...head > diff.patch`;
   copia do **head** `specs/<branch>/{spec,plan,tasks,data-model}.md` + `contracts/**`; da
   **`main`** a constitution, `docs/adr/*.md` e `docs/review-checklist.md`; em re-revisão,
   `anteriores/veredito.md` e `anteriores/respostas.md`; escreve `manifest.json` com sha256.
2. Skill despacha `revisor-limpo` (tools Read/Glob/Grep; prompt fixo, sem resumo do PR).
3. O Doug roda `review:publish <n>` no terminal: `parseVerdict(veredito.md)` → re-lê head do PR
   (= `manifest.headSha`?) → substitui/insere "Insumos lidos" a partir do manifest → prefixa
   marcador com `head=` → pede a senha (TTY, sem eco) → JWT → token do app → `POST issues/<n>/comments`.

### `prepare` tolerante
`scripts/setup-hooks.mjs`: se `CI`/`VERCEL` definidos ou `git rev-parse --is-inside-work-tree`
falha → sai 0 sem fazer nada; senão `git config core.hooksPath .githooks`; qualquer erro é
reportado como aviso e sai 0. Observação: `core.hooksPath` é config compartilhada entre
worktrees; worktrees cujas branches ainda não têm `.githooks/` ficam sem hook até o rebase
(sem erro) — documentado no quickstart.

### Máquina de estados
Ver [data-model.md §4](data-model.md). Transições proibidas: aprovado com veredito de outro head
sem equivalência; aprovado com veredito do autor; merge aceito com base só no status publicado;
emergência sem motivo; integrado sem aprovado/emergência (detectado pelo `main-guard`).

### Padrões e bibliotecas
- **Permitidas**: `node:crypto`, `node:fs`, `node:child_process` (só em `scripts/`), `fetch`,
  `tsx`, `yaml` (já dev-dep: parse de `ci.yml` em `scripts/` e validação de configs em teste).
- **Proibidas** (verificado por `cost.test.ts`): `@octokit/*`, `jsonwebtoken`, `@anthropic-ai/*`,
  `actions/github-script` com lógica inline, `anthropics/claude-code-action`/API paga, gatilho
  `pull_request` no portão.
- Funções puras + IO injetável (`fetch`, `exec`, `now`, `isTty`, `prompt`) — testáveis sem rede.

### Critérios de aceite (Gherkin, com verificação no GitHub)

```gherkin
Funcionalidade: Verificação "Revisão independente"
  Cenário: Aprovado pelo revisor designado no head atual
    Dado um PR "autor:claude" com rótulo "iniciativa:0", spec existente e trailers "Claude"
    E uma review de "gemini-code-assist[bot]" com commit_id igual ao head e bloco "Veredito: APROVADO" sem achados ALTO/CRÍTICO
    Quando o review-gate avalia o PR
    Então o commit status "Revisão independente" do head é "success"
    E a descrição é "APROVADO por Gemini em <sha7>"

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
    Quando executo "git push origin HEAD:main" num clone com hooks ativos
    Então o push é recusado com "push direto na main é proibido"
  Cenário: Commit fora do fluxo
    Dado um commit na main sem PR associado
    Quando o job main-guard do CI roda
    Então existe uma issue "violacao-main" atribuída a "dougueta", o job falha e "deploy-db" não roda
  Cenário: Status forjado
    Dado um PR sem veredito cujo status "Revisão independente" foi marcado "success" por outra via
    Quando o Doug executa "npm run pr:merge -- <n>"
    Então o processo termina com código 6 e "aguardando veredito de Gemini"
  Cenário: Branch desatualizada
    Dado um PR aprovado cuja branch está 1 commit atrás da main
    Quando o Doug executa "npm run pr:merge -- <n>"
    Então o processo termina com código 7
  Cenário: npm install no build da Vercel
    Dado o ambiente com VERCEL=1 e sem diretório .git
    Quando "npm install" executa o script prepare
    Então ele termina com código 0 sem alterar a configuração do git
```

## Ações externas na implementação (⚠️ exigem confirmação do Doug no momento)
1. Escolher D1 (A/B/C) — antes de qualquer código; se C, atualizar a spec (T001).
2. Instalar Gemini Code Assist (consumer) só em `dougueta/prumo`.
3. Criar e instalar o GitHub App `prumo-revisor` (Pull requests: write), cifrar a chave com
   senha e guardar o `.pem` fora do repo.
4. Executar `npm run gh:labels` e `npm run gh:repo-settings` (escrevem no GitHub).
5. Se D1 = A: tornar o repositório público; se B: assinar GitHub Pro; então `npm run gh:ruleset`.
6. Abrir PRs de teste para o roteiro de aceite (quickstart §2) e apagá-los ao final.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Gemini não emite o bloco de veredito (ou "Achados anteriores") de forma confiável | média | Spike T010 logo no início; re-acionamento `/gemini review`; plano B (veredito derivado dos selos) exigiria emenda da spec |
| Gemini não revisa `.github/workflows/**` | certa | Aviso de `GATE_SELF_PATHS` + pendência de governança C5 (espelho revisável recomendado) |
| Status "Revisão independente" forjado (token do Doug usado pelos agentes ou job `redispatch` com workflow do PR) | média | Status só informativo; `pr:merge` e `main-guard` recalculam `evaluateGate`; check runs só do app `github-actions` (PAT não cria check run) |
| Agente autor lê a chave do `prumo-revisor` | média | Chave cifrada com senha digitada pelo Doug (TTY); deny de leitura de `~/.prumo/**` |
| Regras de deny dos agentes contornáveis (padrões de texto; PTY do Gemini CLI) | média | Camadas: hook, `pr:merge` com TTY + recálculo, `main-guard` detectivo; risco residual no ADR 0007 |
| Deploy de produção da Vercel não espera o `main-guard` | baixa | `deploy-db` espera; risco residual da Vercel registrado no ADR 0007 |
| `npm install` falhar na Vercel por causa do hook | — | `setup-hooks.mjs` tolerante + teste |
| Rebase obrigatório invalida veredito | alta sem mitigação | Rebase neutro por impressão de conteúdo |
| Cota do Gemini (33–100 PRs/dia) | baixa | Volume < 5/dia |
| Minutos de Actions (repo privado) | baixa | Estimativa 700/2.000; `concurrency` cancela runs redundantes |

## Complexity Tracking

| Item | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| Exceção de emergência (FR-024: regras 8–9, issue pós-merge, modo agendado, VENCIDA) | decisão D-A revisada do Doug; **depende da emenda v1.2.0** do Princípio VIII | sem exceção (rejeitada pelo Doug em 2026-10-05) |
| `workflow_dispatch` intermediário para `pull_request_review` | evita executar o portão na versão do PR | gatilho direto (inseguro) |
| Recalcular `evaluateGate` no `pr:merge` e no `main-guard` | status de commit é forjável por qualquer token com write | confiar no status (inseguro) |
| Impressão de conteúdo para rebase neutro (compare + sha256) | constitution exige rebase antes do merge; sem isso cada rebase exige nova revisão | invalidar sempre (laço rebase→revisão com WIP 3) |
| Chave do app cifrada + senha no TTY | impede agente autor de publicar como revisor (FR-009) | chave em texto claro (forjável localmente) |
| Camadas compensatórias (se D1 = C) | plano Free não protege branch privada | pagar Pro (fere R$ 0) / repo público (exposição) |
