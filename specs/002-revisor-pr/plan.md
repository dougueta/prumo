# Implementation Plan: Revisor de PR Independente

**Branch**: `002-revisor-pr` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-revisor-pr/spec.md`

## Summary

Transformar a Constitution VIII em mecanismo verificável: (1) **Gemini Code Assist** (consumer,
gratuito) revisa PRs `autor:claude`/`autor:doug` guiado por `.gemini/config.yaml` +
`.gemini/styleguide.md`, terminando a review com um bloco de veredito padronizado; (2) uma
**skill do Claude Code** monta um pacote fechado e despacha um **subagente sem histórico**
(`revisor-limpo`) que revisa PRs `autor:gemini` e publica o veredito pelo **GitHub App gratuito
`prumo-revisor`**; (3) um workflow `review-gate` calcula o status **"Revisão independente"**
lendo vereditos, rótulos, trailers de autoria e arquivos do PR (tabela de decisão pura e
testada); (4) proteção da `main` — **descoberta: o plano Free não oferece branch protection nem
rulesets em repositório privado** (HTTP 403 verificado), então o plano propõe defesa em camadas
R$ 0 (Decisão D1, ⚠️ Doug); (5) template de PR, rótulos/marcos, fluxo de emergência e fim da
exceção de bootstrap. Detalhes e fontes em [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) · Node 24 LTS (herdados da 001)
**Primary Dependencies**: nenhuma nova. `tsx` (já dev-dep) para scripts; `node:crypto` (JWT
RS256); `fetch` nativo; `gh` CLI do Doug para leituras locais; YAML de workflow do GitHub Actions
**Storage**: N/A — estado vive no GitHub (rótulos, reviews, comentários, commit statuses)
**Testing**: Vitest 5 projeto `unit` (funções puras com fixtures sintéticas no formato da API;
rede externa bloqueada por `tests/setup.ts`) + roteiro de aceite manual em PRs de teste
(quickstart §2)
**Target Platform**: GitHub (repo privado `dougueta/prumo`, plano Free) · GitHub Actions
`ubuntu-latest` · Windows (Git Bash) para comandos locais
**Project Type**: tooling de repositório dentro do projeto Next.js único
**Performance Goals**: status recalculado ≤ 2 min após o evento; veredito Gemini ≤ 15 min
(SC-004); veredito Claude ≤ 30 min (SC-005); `main-guard` alerta ≤ 5 min
**Constraints**: R$ 0; nenhum segredo no repo; portão nunca executa código do PR; Gemini não
revisa `.github/workflows/**`
**Scale/Scope**: 1 aprovador, 2 agentes, ~15 PRs/mês

## Decisão D1 ⚠️ (confirmar com Doug no Gate 2) — proteção da `main` em repo privado gratuito

`GET /branches/main/protection` e `GET /rulesets` → **403 "Upgrade to GitHub Pro or make this
repository public"** (research R-03). Opções:

| Opção | Custo | Efeito |
|---|---|---|
| A. Repositório público | R$ 0 | Ruleset completo no servidor + Actions ilimitado; código/specs/roadmap públicos |
| B. GitHub Pro | ≈ R$ 22/mês | Ruleset completo; **fere o teto R$ 0** (exige aprovação de custo) |
| **C. Privado + camadas compensatórias (recomendada)** | R$ 0 | Preventivo nos agentes (deny rules + hook `pre-push` + `pr:merge` com TTY) e **detectivo** no servidor (`main-guard` abre issue em ≤ 5 min) |

**Impacto na spec se C**: FR-001 ("recusados para todos"), FR-002 ("merge MUST exigir") e
FR-005 ("não contornável por admin") passam de *bloqueio no servidor* para *bloqueio nos agentes
e no comando de merge + detecção e alerta no servidor*. Atualizar a redação desses FRs e da US1
(cenários 1, 2, 6) **antes** da implementação (Constitution I: mudança de escopo volta para a
spec). Com A ou B, a spec fica como está e a task T023 cria o ruleset. Em qualquer opção os
agentes usam a conta do Doug, então "só o Doug integra" (FR-004) depende das camadas locais.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação nesta feature | Status |
|---|---|---|
| I. Spec-first | Deriva da spec 002 aprovada (Gate 1); portão bloqueia PR de feature sem spec (FR-012). D1=C exige ajuste prévio da spec | ✅ (condicionado a D1) |
| II. Privacidade | Chave do app fora do repo (`*.pem` ignorado), token de 1 h restrito a 1 repo e 1 permissão, nunca logado; pacote `.review/` ignorado; fixtures sintéticas | ✅ |
| III. Dinheiro exato | N/A — sem valores monetários | ✅ |
| IV. Rastreabilidade | Veredito ligado ao `head` sha; respostas por #; issues de violação/emergência auditáveis | ✅ |
| V. Test-first | Toda função pura de `src/review/` tem teste antes; roteiro de aceite em PRs reais | ✅ |
| VI. IA assistente | Revisores são IA, mas o Doug decide o merge; vereditos explicam cada achado | ✅ |
| VII. Donos de dados / demo | Sem tabelas; N/A para modo demonstração (nenhuma tela) | ✅ |
| VIII. Revisão independente | É o objeto da feature. O PR da própria 002 é o último sob bootstrap: revisado pelo Gemini já configurado; `.github/workflows/**` não é revisto pelo Gemini → Doug revisa esses arquivos manualmente | ✅ |
| IX. Qualidade dos artefatos | data-model tipado + máquina de estados, contratos com tabelas de decisão, Gherkin abaixo, rastreabilidade FR→tasks | ✅ |
| X. Simplicidade | Zero dependências novas; status único em vez de app de checks; sem servidor/webhook | ✅ |
| Custo R$ 0 | Gemini Code Assist consumer (grátis), GitHub App (grátis), Actions ≈ 300 min/mês extra (total ≈ 700 de 2.000), Claude Code já assinado | ✅ (B violaria) |

**Re-check pós-design**: ✅ sem violações; único ponto aberto é D1 (escolha do Doug).

## Project Structure

### Documentation (this feature)

```text
specs/002-revisor-pr/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (veredito.md · review-gate.md · review-cli.md)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/review/                         # lógica pura (sem IO, sem process.env)
├── catalog.ts                      # constantes do data-model §1
├── types.ts                        # tipos do data-model §2
├── parse-verdict.ts                # contrato veredito §1
├── parse-responses.ts              # contrato veredito §2
├── authorship.ts                   # trailers → Agent; rótulos → Agent
├── classify-pr.ts                  # kind (feature/processo/emenda), spec esperada, toca o portão
├── evaluate-gate.ts                # tabela de decisão do contrato review-gate
├── main-guard.ts                   # regras do main-guard (puro)
├── merge-readiness.ts              # decisão do pr:merge (checks, mergeable, TTY)
├── bundle.ts                       # seleção de arquivos + manifest (puro)
├── publish-format.ts               # monta o comentário final (marcador head=, Insumos lidos)
├── labels.ts                       # diff rótulos/marcos existentes × desejados
└── app-jwt.ts                      # JWT RS256 com node:crypto (puro dado a chave)
scripts/review/                     # IO (GitHub API, fs, process.env) — fora de src/
├── github.ts                       # cliente mínimo (fetch injetável) → PrSnapshot
├── gate.ts                         # entrada do workflow review-gate
├── main-guard.ts                   # entrada do workflow main-guard
├── bundle.ts · publish.ts · merge.ts
├── labels.ts · repo-settings.ts · ruleset.ts (só se D1 = A/B)
.github/
├── pull_request_template.md
└── workflows/ review-gate.yml · main-guard.yml
.gemini/ config.yaml (novo) · styleguide.md (atualizado) · settings.json (excludeTools)
.claude/
├── settings.json                   # permissions.deny (push main, merge)
├── agents/revisor-limpo.md         # subagente: tools Read, Glob, Grep
└── skills/revisar-pr/SKILL.md      # /revisar-pr <n>
.githooks/pre-push
tests/unit/review/                  # um arquivo por módulo + fixtures/
docs/ workflow.md · review-checklist.md · gemini-handoff.md · adr/0007-protecao-main-repo-privado.md
AGENTS.md · GEMINI.md · CLAUDE.md   # fim do bootstrap, trailers, fluxo de revisão
.gitignore                          # + .review/ e .env.review.local
package.json                        # scripts review:*, pr:merge, gh:*, prepare
```

**Structure Decision**: lógica pura em `src/review/` (padrão da 001 com `src/synthetic/`), IO
em `scripts/review/` (que podem ler `process.env`, como `scripts/synthetic.ts`). Sem pacote
separado (X).

## Design Detalhado

### Algoritmo — `evaluateGate(s: PrSnapshot): GateResult` (FR-006–FR-013, FR-024)
1. `kind = classifyPr(s.changedFiles)`: emenda se contém `CONSTITUTION_PATH`; processo se
   todos casam `PROCESS_PATHS`; senão feature. `warnings += "altera o próprio portão…"` se algum
   arquivo casa `GATE_SELF_PATHS`.
2. Se `s.draft` → pending (regra 1).
3. `authorLabels = labels ∩ AUTHOR_LABELS`; ≠ 1 → failure (2). `labelAgent` = sufixo.
4. `trailerAgents = ⋃ agentsFromTrailers(commit.message)` (regex `^Co-Authored-By:.*\b(Claude|Gemini)\b`
   case-insensitive, por linha). `|trailerAgents| > 1` → failure (3).
   `commitAgent = único ou "doug"`; `≠ labelAgent` → failure (4).
5. kind=feature: sem `iniciativa:N` → failure (5); `!/^\d{3}-[a-z0-9-]+$/.test(headRef) ||
   !s.specExists` → failure (6).
6. kind=emenda: `constitutionPatch` precisa ter linhas `+`/`-` com `**Version**:` e com
   `Version change:` → senão failure (7).
7. `emergencia ∈ labels`: motivo = regex `/Motivo da emergência:\s*(.{20,})/` no body → success (8)
   ou failure (9).
8. `designated = REVIEWER_BY_AUTHOR[labelAgent]`. Candidatos = reviews + issueComments ordenados
   por `publishedAt`. Para cada um: identidade → agente (ou nenhum); se agente ≠ designated e
   contém marcador → aviso (desconsiderado); `parseVerdict` → se erro, aviso; para Gemini,
   `inlineSeverities` = selos dos `reviewComments` com `pull_request_review_id == review.id`.
9. `valid = candidatos válidos do designated`; vazio → pending (10).
10. `last = valid.at(-1)`; `last.headSha ≠ s.headSha` → pending (11).
11. `effective = incoerente(last) ? MUDANÇAS : last.outcome`; MUDANÇAS → failure (12) com contagem.
12. `prev = último veredito válido MUDANÇAS anterior a last`; se existe:
    `respondidos = ⋃ respostas (parseResponses) publicadas entre prev e last, autor = conta do Doug`;
    `faltam = prev.findings.n − respondidos` (≠ ∅ → failure 13).
13. success (14): `APROVADO por <designated> em <sha7>`.

Ordenação estável, nenhuma chamada de rede; `reason` truncado em 140 caracteres.

### Algoritmo — `main-guard` (push na main)
1. `parents.length ≠ 1` → violação "commit não é squash".
2. `pulls = GET /commits/{sha}/pulls`; procurar `merged_at != null && merge_commit_sha == sha`;
   nenhum → violação "commit sem PR".
3. No `head.sha` do PR: os 4 `REQUIRED_CI_CHECKS` com `conclusion = success` e status
   `Revisão independente` = success → ok; senão violação listando o que faltou.
4. Se PR tem `emergencia` → criar issue "Revisão pós-merge pendente: #N" (rótulo `emergencia`).
5. Violação → issue `violacao-main` (idempotente por título) + `exit 1`.
6. Agendado: para issues abertas `emergencia`, procurar veredito válido do revisor designado
   publicado após `merged_at` no PR → fecha a issue com link; se `agora − merged_at > 7 d` →
   prefixa `VENCIDA —` e comenta mencionando `@dougueta`.

### Algoritmo — revisão Claude em contexto limpo (FR-017, FR-018)
1. `review:bundle <n>`: `gh pr view --json` (rótulos, draft, head/base) → valida `autor:gemini`;
   `git fetch origin pull/<n>/head`; `git diff base...head > diff.patch`; copia de `head`
   `specs/<branch>/{spec,plan,tasks,data-model}.md` + `contracts/**`, a constitution, `docs/adr/*.md`
   e `docs/review-checklist.md` **da `main`** (o PR não pode reescrever o checklist que o avalia);
   escreve `manifest.json` com sha256 de cada arquivo.
2. Skill despacha `revisor-limpo` (tools Read/Glob/Grep; prompt fixo, sem resumo do PR).
3. `review:publish <n>`: `parseVerdict(veredito.md)` (mesmo parser do portão) → re-lê head do
   PR (= `manifest.headSha`?) → substitui/insere "Insumos lidos" a partir do manifest → prefixa
   marcador com `head=` → token do app → `POST issues/<n>/comments`.

### Máquina de estados
Ver [data-model.md §4](data-model.md). Transições proibidas: aprovado com veredito de outro head;
aprovado com veredito do autor; emergência sem motivo; integrado sem aprovado/emergência
(detectado pelo `main-guard`).

### Padrões e bibliotecas
- **Permitidas**: `node:crypto`, `node:fs`, `node:child_process` (só em `scripts/`), `fetch`,
  `tsx`, `yaml` (já dev-dep, para validar `.gemini/config.yaml` em teste).
- **Proibidas**: `@octokit/*`, `jsonwebtoken`, `actions/github-script` com lógica inline (lógica
  fica em TS testado), `pull_request` trigger no portão (executaria código do PR),
  `claude-code-action`/API paga.
- Funções puras + IO injetável (`fetch`, `now`) — testáveis sem rede.

### Critérios de aceite (Gherkin, com verificação no GitHub)

```gherkin
Funcionalidade: Verificação "Revisão independente"
  Cenário: Aprovado pelo revisor designado no head atual
    Dado um PR "autor:claude" com rótulo "iniciativa:0", spec existente e trailers "Claude"
    E uma review de "gemini-code-assist[bot]" com commit_id igual ao head e bloco "Veredito: APROVADO" sem achados ALTO/CRÍTICO
    Quando o review-gate avalia o PR
    Então o commit status "Revisão independente" do head é "success"
    E a descrição é "APROVADO por gemini em <sha7>"

  Cenário: Veredito desatualizado
    Dado o PR aprovado acima
    Quando um novo commit é enviado
    Então o status do novo head é "pending" com "veredito desatualizado — novo commit após a revisão"

  Cenário: Doug cola um veredito
    Dado um comentário da conta "dougueta" contendo o bloco de veredito APROVADO
    Quando o review-gate avalia
    Então o status permanece "pending" com "aguardando veredito de Gemini"
    E o job summary contém "não é o revisor designado"

  Cenário: Veredito incoerente
    Dado uma review do Gemini com "Veredito: APROVADO" e um comentário de linha com selo "high-priority"
    Quando o review-gate avalia
    Então o status é "failure" com "mudanças necessárias"

  Cenário: Achado sem resposta
    Dado um veredito MUDANÇAS NECESSÁRIAS com achados #1, #2, #3
    E uma resposta "prumo:respostas" cobrindo #1 e #2
    E um novo veredito APROVADO no head atual
    Quando o review-gate avalia
    Então o status é "failure" com "achados sem resposta: #3"

  Cenário: PR sem spec
    Dado um PR "autor:claude" da branch "999-teste" alterando "src/app/page.tsx" e sem "specs/999-teste/spec.md"
    Quando o review-gate avalia
    Então o status é "failure" com "PR sem spec (Constitution I)"

  Cenário: Emergência
    Dado um PR com rótulo "emergencia" e corpo "Motivo da emergência: produção fora do ar ao abrir o extrato"
    Quando o review-gate avalia
    Então o status é "success" com "EMERGÊNCIA — revisão independente pós-merge em até 7 dias"
    E após o merge existe uma issue aberta "Revisão pós-merge pendente: #<n>"

Funcionalidade: Revisor Claude em contexto limpo
  Cenário: Publicação pelo app
    Dado um PR "autor:gemini" aberto
    Quando o Doug executa "/revisar-pr <n>"
    Então existe um comentário de "prumo-revisor[bot]" com marcador "head=<head atual>" e seção "Insumos lidos"
    E todos os itens de "Insumos lidos" constam no manifest.json do pacote

  Cenário: Mesmo agente
    Dado um PR "autor:claude"
    Quando executo "npm run review:bundle -- <n>"
    Então o processo termina com código 3 e "revisor e autor são o mesmo agente"

Funcionalidade: Proteção da main
  Cenário: Push direto
    Quando executo "git push origin HEAD:main" num clone com hooks ativos
    Então o push é recusado com "push direto na main é proibido"
  Cenário: Commit fora do fluxo
    Dado um commit na main sem PR associado
    Quando o main-guard roda
    Então existe uma issue "violacao-main" atribuída a "dougueta" e o job falha
```

## Ações externas na implementação (⚠️ exigem confirmação do Doug no momento)
1. Escolher D1 (A/B/C) — antes de qualquer código; se C, atualizar FR-001/002/005 + US1 na spec.
2. Instalar Gemini Code Assist (consumer) só em `dougueta/prumo`.
3. Criar e instalar o GitHub App `prumo-revisor` (Pull requests: write), guardar `.pem` fora do repo.
4. Executar `npm run gh:labels` e `npm run gh:repo-settings` (escrevem no GitHub).
5. Se D1 = A: tornar o repositório público; se B: assinar GitHub Pro; então `npm run gh:ruleset`.
6. Abrir PRs de teste para o roteiro de aceite (quickstart §2) e apagá-los ao final.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Gemini não emite o bloco de veredito de forma confiável | média | Spike T010 logo no início; re-acionamento `/gemini review`; plano B (veredito derivado dos selos) exigiria emenda da spec |
| Gemini não revisa `.github/workflows/**` | certa | Aviso "altera o próprio portão" + revisão manual do Doug desses arquivos |
| `pull_request_review` roda a versão do PR | baixa | job só faz `workflow_dispatch` na `main`; `main-guard` reverifica |
| Regras de deny dos agentes contornáveis | média | Camadas: hook, `pr:merge` com TTY, `main-guard` detectivo |
| Cota do Gemini (33–100 PRs/dia) | baixa | Volume < 5/dia |
| Minutos de Actions (repo privado) | baixa | Estimativa 700/2.000; `concurrency` cancela runs redundantes |

## Complexity Tracking

| Item | Por quê | Alternativa mais simples rejeitada |
|---|---|---|
| `workflow_dispatch` intermediário para `pull_request_review` | evita executar o portão na versão do PR | gatilho direto (inseguro) |
| Camadas compensatórias (se D1 = C) | plano Free não protege branch privada | pagar Pro (fere R$ 0) / repo público (exposição) |
