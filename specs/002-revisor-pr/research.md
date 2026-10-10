# Research — 002 · Revisor de PR Independente

Pesquisa feita em 2026-10-02/03 com documentação oficial, `gh api` contra o repositório
`dougueta/prumo` (somente leitura) e inspeção de um PR público real revisado pelo Gemini Code
Assist. A pesquisa R5 do Gemini (`docs/research/gemini-code-assist.md`) pode aprofundar R-01/R-02;
se divergir, prevalece a evidência mais recente e o plano é ajustado antes do Gate 2.
Em 2026-10-05 a R5 ainda não havia sido entregue (`docs/research/` só tem o README); esta
pesquisa a substitui para a 002 (T052 marca isso no handoff). Remediação pós-analyze
(2026-10-05): R-02, R-03, R-04 atualizados e R-08 a R-11 acrescentados.

## R-01 · O que o Gemini Code Assist (versão consumer, gratuita) faz em PRs

**Evidência**
- Versão consumer instalada como app do GitHub; gratuita, inclusive para repositórios
  **privados** (anúncio do free tier, fev/2025 — [mojoauth](https://mojoauth.com/news/news-2025-03-gemini-code-assist-free-tier),
  [i-programmer](https://i-programmer.info/news/90-tools/17881-gemini-code-assist-adds-free-layer.html)).
- Ao abrir o PR faz revisão inicial; pode ser re-acionado por comentário `/gemini review`
  (também `/gemini summary`, `/gemini help`, `@gemini-code-assist <pergunta>`).
- Configuração por repositório em `.gemini/config.yaml`
  ([customize-repo-review](https://docs.cloud.google.com/gemini/docs/code-review/customize-repo-review)):
  `have_fun`, `ignore_patterns`, `memory_config.disabled`, `code_review.disable`,
  `code_review.comment_severity_threshold` (LOW|MEDIUM|HIGH|CRITICAL, padrão **MEDIUM**),
  `code_review.max_review_comments` (-1 = ilimitado), `code_review.pull_request_opened.{help,
  summary, code_review, include_drafts}` (padrões false/false/true/**true**). Também lê
  `.gemini/styleguide.md` como instruções de revisão.
- **Não revisa arquivos em `.github/workflows/`**
  ([review-repo-code](https://docs.cloud.google.com/gemini/docs/code-review/review-repo-code)).
- Cota: "at least 100 pull request reviews per day" por instalação
  ([quotas](https://docs.cloud.google.com/gemini/docs/quotas)); resultado de busca aponta 33/dia
  para a versão consumer. Qualquer dos dois cobre o volume do Prumo (< 5 PRs/dia).
- **Inspeção real** (`gh api repos/xorbitsai/inference/pulls/5615/reviews`, 2026-10-03):
  - Identidade: `gemini-code-assist[bot]`, `type: Bot`, `id: 176961590`.
  - Publica **uma review do tipo `COMMENTED`** (nunca `APPROVED`/`CHANGES_REQUESTED`), corpo
    iniciando com `## Code Review` + resumo, e **comentários de linha** com selo de severidade
    `https://www.gstatic.com/codereviewagent/<critical|high|medium|low>-priority.svg`.
  - A review traz `commit_id` = commit avaliado.
  - **Não** cria check run nem status.

**Decision**
- `.gemini/config.yaml`: `comment_severity_threshold: LOW`, `max_review_comments: -1`,
  `pull_request_opened: {summary: true, code_review: true, include_drafts: false, help: false}`,
  `have_fun: false`, `memory_config.disabled: true` (revisor sem "memória" acumulada = sem vícios),
  `ignore_patterns: ["tests/fixtures/synthetic/**", "package-lock.json"]`.
- `.gemini/styleguide.md` passa a exigir que o **corpo da review termine com o bloco de veredito**
  (contrato `contracts/veredito.md`), com o marcador `<!-- prumo:veredito v1 -->`.
- O veredito do Gemini é lido da review (`user.login == "gemini-code-assist[bot]"`,
  `user.type == "Bot"`), validado contra `commit_id == head.sha`, e cruzado com os selos de
  severidade dos comentários de linha da mesma review (selo critical/high ⇒ veredito incoerente se
  APROVADO — FR-007).

**Risco** (alto, validado cedo — task T010): o modelo pode não obedecer o formato do styleguide
de forma confiável. Mitigação: spike com PR de teste antes do resto; se falhar, a verificação
mostra "veredito fora do formato" e o autor re-aciona `/gemini review`. Se a taxa de falha for
alta, alternativa (exige atualizar a spec): veredito **derivado** dos selos de severidade.

**Alternatives**: Gemini CLI local publicando via app (gasta cota do Doug, menos independente
operacionalmente); Gemini Code Assist enterprise (pago, fora do teto).

## R-02 · Identidade do revisor Claude: GitHub App "prumo-revisor"

**Evidência** ([JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app),
[installation token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app),
[permissões](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)):
- GitHub Apps são gratuitos. JWT assinado **RS256**, `iat` = agora − 60 s, `exp` ≤ 10 min,
  `iss` = **Client ID** (recomendado).
- `GET /repos/{owner}/{repo}/installation` → id da instalação;
  `POST /app/installations/{id}/access_tokens` → token de **1 hora**, restringível a
  `repositories` e `permissions` no próprio pedido.
- `POST /repos/{o}/{r}/issues/{n}/comments` exige **Issues: write** *ou* **Pull requests: write**;
  `POST .../pulls/{n}/reviews` exige Pull requests: write.

**Decision**
- App privado `prumo-revisor`, dono `dougueta`, instalado **só** em `dougueta/prumo`, sem webhook.
  Permissões: **Pull requests: Read & write**, **Metadata: Read** (obrigatória). Nada mais.
- O veredito do Claude é publicado como **comentário de issue no PR** (dispara `issue_comment`,
  cujo workflow roda sempre a versão da `main` — ver R-04), com marcador
  `<!-- prumo:veredito v1 head=<sha> -->`. O `head` é escrito pelo script de publicação, que só
  publica se o head atual do PR for igual ao do pacote revisado.
- JWT gerado com `node:crypto` (`createSign('RSA-SHA256')`) — sem dependência nova.
- Chave privada `.pem` fora do repositório (`%USERPROFILE%\.prumo\prumo-revisor.pem`), caminho e
  Client ID em `.env.review.local` (ignorado pelo git; `*.pem` já está no `.gitignore`).
- **Atualização 2026-10-05**: a chave fica **cifrada (PKCS#8, AES-256) com senha** que só o Doug
  digita no terminal ao publicar. Motivo: os agentes autores rodam na mesma máquina e com o
  mesmo usuário do Doug, então permissões de arquivo não impedem a leitura; sem a senha, um
  agente autor (ex.: Gemini CLI num PR `autor:gemini`) não consegue publicar como
  `prumo-revisor[bot]` (FR-009). `node:crypto.createPrivateKey({ key, passphrase })` lê o
  formato sem dependência nova.
  Token pedido com `permissions: {pull_requests: write}` e `repositories: ["prumo"]`.

**Alternatives**: conta de máquina (mais uma conta para gerir); comentário pela conta do Doug com
assinatura (forjável — rejeitado no clarify Q1).

## R-03 · Proteção da `main` num repositório PRIVADO no plano Free — **limitação descoberta**

**Evidência**
- `gh api repos/dougueta/prumo/branches/main/protection` → **HTTP 403 "Upgrade to GitHub Pro or
  make this repository public to enable this feature."** (2026-10-03).
- `gh api repos/dougueta/prumo/rulesets` → **mesmo 403**.
- [Planos do GitHub](https://docs.github.com/en/get-started/learning-about-github/githubs-plans):
  "Protected branches", "Required pull request reviewers" e afins em repositórios privados só a
  partir do **GitHub Pro** (US$ 4/mês ≈ R$ 22/mês).
- Disponível no Free/privado: configurações de merge do repositório (permitir só squash, apagar
  branch após merge), commit statuses e check runs (exibidos, **não obrigatórios**), Actions
  (2.000 min/mês).

**Consequência**: com o repositório privado e R$ 0, o GitHub **não recusa** push direto nem merge
sem verificações. Os agentes usam a conta do Doug (clarify Q1), então o servidor também não
distingue agente de Doug.

**Opções** (⚠️ decisão do Doug no Gate 2 — ver plan.md, Decisão D1):

| Opção | Custo | FR-001/002/005 no servidor | Observação |
|---|---|---|---|
| **A. Tornar o repositório público** | R$ 0 | ✅ rulesets completos + Actions ilimitado | Código e specs públicos (sem segredos/dados reais por Constitution II, mas expõe roadmap e bancos do Doug) |
| **B. GitHub Pro** | ≈ R$ 22/mês | ✅ | Viola o teto R$ 0 → exige aprovação explícita (constitution) |
| **C. Privado + controles compensatórios** (recomendada) | R$ 0 | ⚠️ preventivo nos agentes + detectivo no servidor | Exige ajustar a redação de FR-001/FR-002/FR-005 na spec |

**Decision (recomendada, C)** — defesa em camadas:
1. **Configuração do repositório** (disponível no Free): só "squash" habilitado, apagar branch
   após merge.
2. **Preventivo nos agentes**: `.claude/settings.json` com `permissions.deny` e
   `.gemini/settings.json` com `excludeTools` cobrindo a lista de `contracts/review-cli.md`
   §Negação (push para `main` em todas as formas, `--no-verify`, `gh pr merge`, `pr:merge`,
   `review:publish`, `gh api` merge/statuses/labels, rótulo `emergencia`, leitura de `~/.prumo`). A doc do
   Claude Code e do Gemini CLI avisa que regras por padrão de texto são contornáveis
   ([permissions](https://code.claude.com/docs/en/permissions), [Gemini CLI shell](https://geminicli.com/docs/tools/shell/)) — por isso não são a única camada.
3. **Preventivo local**: hook `pre-push` versionado (`.githooks/pre-push`, ativado por
   `npm install` via script `prepare`) que recusa push para `main`.
4. **Merge pelo Doug via comando de portão** `npm run pr:merge -- <n>`: só integra (squash) se as
   verificações de CI derivadas do `ci.yml` estiverem verdes no head, se `evaluateGate`
   **recalculado** localmente der success (o status publicado não basta — R-09) e se a branch
   estiver atualizada (`behind_by == 0` — R-11).
5. **Detectivo no servidor**: job `main-guard` ("Guarda da main") **dentro do `ci.yml`** em todo
   push na `main` confere que o commit veio de PR integrado por squash com CI verde e revisão
   válida **recalculada** (ou `emergencia`); se não, abre issue `violacao-main` atribuída ao
   Doug (e-mail) e falha — em ≤ 5 min. Como o `deploy-db` da 001 (`ci.yml:96-117`) passa a ter
   `needs: main-guard`, migrações de produção não são aplicadas para um commit fora do fluxo.
   O deploy de produção da Vercel não depende do CI — risco residual registrado no ADR 0007.
   O modo agendado das emergências fica em `main-guard.yml` (só `schedule`).

Se o Doug escolher **A** ou **B**, acrescenta-se o ruleset (task T023) e as camadas 2–5 continuam
(o servidor ainda não distingue agente de Doug para "só o Doug integra").

**Decisão final (Gate 2, Doug, 2026-10-05): A — repositório público** (já aplicado). O ruleset
"main protegida" (data-model §7) passa a ser o mecanismo principal. Das camadas acima: 1, 2, 4 e
5 continuam; a **3 (hook `pre-push`) foi removida** — o servidor recusa push direto, force-push
e deleção para todos, e o `prepare` trazia o risco de R-10. Análise de ameaça do repositório
público em R-12 e no plan.

## R-04 · Implementar a verificação "Revisão independente" com GitHub Actions

**Evidência / raciocínio**
- Eventos relevantes: `pull_request_target` (opened, reopened, synchronize, edited, labeled,
  unlabeled, ready_for_review, converted_to_draft), `pull_request_review` (submitted, edited,
  dismissed), `issue_comment` (created, edited, deleted — filtrar `issue.pull_request`).
- `issue_comment` e `pull_request_target` executam o workflow **da `main`** (o PR não consegue
  alterar o código do portão). `pull_request_review` executa a versão do **PR** — um PR malicioso
  poderia alterar o portão nesse evento.
- Um job disparado por `issue_comment` gera check run no commit da `main`, não no PR. Por isso o
  resultado é publicado como **commit status** (`POST /repos/{o}/{r}/statuses/{head_sha}`,
  `context: "Revisão independente"`) — um único contexto, sobrescrito pela avaliação mais recente.
- Eventos criados por apps (Gemini, prumo-revisor) disparam workflows; só eventos criados pelo
  `GITHUB_TOKEN` não disparam.

**Decision**
- Workflow `.github/workflows/review-gate.yml` com os gatilhos, `permissions: {}` no topo e
  permissões por job (contrato review-gate: `gate` com `statuses: write` e escrita de
  comentário para os avisos; `redispatch` só `actions: write`), `concurrency` por PR
  (cancel-in-progress). Faz checkout **explícito de `main`** (`ref: main`) e roda
  `scripts/review/gate.ts`, que lê tudo pela API (nunca executa código do PR).
- Mitigação do risco de `pull_request_review`: (a) o job de `pull_request_review` só re-dispara a
  avaliação via `gh workflow run review-gate.yml --ref main -f pr=<n>` (`workflow_dispatch` roda
  da `main`); (b) PR que altere `.github/workflows/**` ou `scripts/review/**`/`src/review/**`
  recebe aviso "altera o próprio portão — revisão manual do Doug obrigatória"; (c) `main-guard`
  re-verifica após o merge com o código da `main`.
- Lógica em funções puras (`src/review/*`), testadas com fixtures sintéticas no formato real da
  API (sem rede — `tests/setup.ts` bloqueia rede externa).

**Custo**: ~1 min por avaliação × ~20 eventos/PR × ~15 PRs/mês ≈ 300 min/mês + CI da 001
(~400) ≈ 700 de 2.000 min gratuitos.

## R-05 · Execução do revisor Claude em contexto limpo, a R$ 0

**Decision**
- Skill do Claude Code `.claude/skills/revisar-pr/SKILL.md` (comando `/revisar-pr <n>`), que:
  1. roda `npm run review:bundle -- <n>` (monta `.review/<n>/` com o pacote fechado + `manifest.json`);
  2. despacha o subagente `.claude/agents/revisor-limpo.md` — ferramentas **somente Read, Glob,
     Grep**, instruído a ler apenas `.review/<n>/`; contexto novo por definição (sem histórico);
  3. o subagente grava `.review/<n>/veredito.md`;
  4. roda `npm run review:publish -- <n>` (valida formato, injeta "Insumos lidos" do manifest,
     confere head, publica pelo app).
- Executa na assinatura do Claude Code que o Doug já tem — nenhum custo novo; nada roda em CI.

**Alternatives**: `claude-code-action` no Actions (exige API key paga — fora do teto);
`claude -p` headless em script (possível, mas a skill + subagente já garante contexto limpo com
menos código).

## R-06 · Autoria e tipo do PR

**Decision**
- **Autoria pelos commits**: trailer `Co-Authored-By:` contendo `Claude` ⇒ claude; `Gemini` ⇒
  gemini; nenhum ⇒ doug. Conjunto de agentes > 1 ⇒ falha "mais de um agente autor". Divergência
  com o rótulo ⇒ "rótulo de autor inconsistente com os commits". `GEMINI.md`/`AGENTS.md` passam a
  exigir o trailer `Co-Authored-By: Gemini <noreply@google.com>`.
- **Tipo do PR derivado dos arquivos alterados** (não depende de o autor marcar):
  `emenda` se altera `.specify/memory/constitution.md`; `processo` se todos os arquivos estão nas
  áreas de processo; senão `feature`. A seção "Tipo" do template é só informativa.
- **Áreas de processo**: `docs/**`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`,
  `.specify/**`, `.gemini/**`, `.claude/**`, `.github/pull_request_template.md`.
- **Spec do PR de feature**: branch `^\d{3}-[a-z0-9-]+$` e `specs/<branch>/spec.md` existente no
  head do PR.
- **Emenda**: o patch da constitution precisa alterar a linha `**Version**:` e a linha
  `Version change:` do Sync Impact Report.

## R-07 · Rótulos e marcos

- Existentes (`gh label list`, 2026-10-03): `autor:claude`, `autor:gemini`, `research`, `spec`,
  `constitution` + padrões do GitHub.
- **Decision**: script idempotente `npm run gh:labels` cria/atualiza `autor:doug`, `emergencia`,
  `violacao-main`, `iniciativa:0` … `iniciativa:10` (nomes curtos do roadmap na descrição) e os 11
  marcos "N · Nome da iniciativa". ⚠️ executado pelo Doug (escreve no GitHub).

## R-08 · Rebase neutro (FR-007) — impressão do conteúdo do PR

**Problema**: a constitution exige rebase na `main` antes do merge; como o veredito é ligado ao
sha do head, todo rebase invalidaria a revisão e, com WIP 3, geraria laço rebase → revisão.

**Decision**: `GET /repos/{o}/{r}/compare/main...<sha>` (três pontos = desde o merge-base) devolve
os arquivos e patches **do PR** naquele sha. A impressão (data-model §2.1) é o sha256 dos
patches normalizados (cabeçalhos de hunk sem números). Se a impressão do head atual é igual à
do head revisado, o veredito continua válido ("rebase neutro"). Limites da API (300 arquivos,
patch ausente em binário/diff grande) ⇒ impressão `null` ⇒ veredito tratado como desatualizado
(conservador). Mudança nas linhas de contexto também muda a impressão (conservador).

**Alternatives**: `git patch-id` (exige checkout/fetch do código do PR no portão — evitado);
invalidar sempre (laço); ignorar rebase (aceitaria conteúdo novo sem revisão).

## R-09 · Status de commit é forjável; check run não

**Evidência / raciocínio**: `POST /statuses/{sha}` aceita qualquer token com escrita no repositório
— inclusive o do Doug, que os agentes usam — e o job de `pull_request_review` roda o workflow
**do PR**, que pode declarar `statuses: write`. Check runs só podem ser criados por GitHub Apps
(PAT/OAuth não criam), e o `app.slug` identifica `github-actions`.

**Decision**: o status "Revisão independente" é informativo; `pr:merge` e `main-guard`
recalculam `evaluateGate` a partir do snapshot do PR e exigem check runs do app
`github-actions` para cada verificação obrigatória. O job `redispatch` recebe só
`actions: write`.

## R-10 · `prepare` e o build da Vercel

**Raciocínio**: `prepare` roda em todo `npm install`/`npm ci`, inclusive nos builds de preview e
produção da Vercel (001), onde o diretório `.git` pode não existir; `git config` fora de um
repositório termina com erro e quebraria a instalação (a confirmar no primeiro preview — o teste
T057 cobre o caso de qualquer forma).

**Decision**: `prepare` chama `node scripts/setup-hooks.mjs`, que não faz nada com `CI`/`VERCEL`
definidos ou fora de um repositório git e nunca sai com código ≠ 0.

## R-11 · "Branch atualizada" sem branch protection

**Raciocínio**: `mergeable_state = behind` só é calculado quando uma proteção exige branch
atualizada; com D1 = C não há proteção, então um PR atrás da `main` pode aparecer como `clean`
(a confirmar no aceite, cenário de branch desatualizada).

**Decision**: `pr:merge` usa `GET /compare/{main}...{head}` e exige `behind_by == 0` (exit 7),
independentemente de `mergeable_state`.

> R-10 ficou sem efeito com D1 = A (o `prepare` e o hook foram removidos); mantido como registro.

## R-12 · Repositório público — superfície de ataque dos workflows (D1 = A)

**Raciocínio / evidência** (documentação do GitHub sobre `pull_request_target`, eventos de
fork e "Keeping your GitHub Actions and workflows secure"):
- `pull_request_target` e `issue_comment` rodam o workflow **da branch padrão** com
  `GITHUB_TOKEN` de escrita e acesso a segredos, inclusive quando disparados por fork. O risco é
  o workflow fazer checkout/execução do código do PR, expor segredos ou interpolar texto do
  evento (título, corpo, nome da branch, comentário) em `run:` (injeção de script).
- `pull_request`/`pull_request_review` de fork rodam com token somente leitura e sem segredos; a
  aprovação de workflows de colaboradores externos (ativada pelo Doug) adiciona um portão humano
  para `pull_request`.
- Status de commit criados por um workflow são atribuídos ao app GitHub Actions; o
  `integration_id` no ruleset impede que um status criado por token pessoal satisfaça a
  proteção, mas não impede um workflow na versão de um PR da própria conta de publicar um.
- Secret scanning em repositório público varre o histórico; push protection bloqueia novos
  segredos.

**Decision**: workflows da 002 só fazem checkout da `main` (`persist-credentials: false`), não
usam segredos nem `environment`, recebem apenas o número do PR via `env`, têm permissões mínimas
por job e produzem saídas só com textos do catálogo (T061, T062). PR de autor externo ou de fork
é bloqueado pela regra 0 do portão (FR-026). `pr:merge` e `main-guard` recalculam o portão
(R-09). Auditoria única do repositório em T073.

> R-11 com D1 = A: o ruleset estrito já exige branch atualizada no servidor; o `behind_by` do `pr:merge` fica só como mensagem antecipada (exit 7).
