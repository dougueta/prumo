# Data Model — 002 · Revisor de PR Independente

Esta feature **não cria tabelas nem migrações** (sem banco; Constitution VII não se aplica a
schema). Os "dados" são artefatos do GitHub (PR, commits, rótulos, reviews, comentários,
statuses, check runs) lidos pela API (contrato
[`contracts/github-api.openapi.yaml`](contracts/github-api.openapi.yaml)) e estruturas em
memória das funções puras de `src/review/`. Abaixo, os tipos TypeScript canônicos (dono: 002)
e suas regras de validação.

## 1. Catálogos fixos (`src/review/catalog.ts`)

| Nome | Valor |
|---|---|
| `STATUS_CONTEXT` | `"Revisão independente"` |
| `CI_WORKFLOW_PATH` | `.github/workflows/ci.yml` — fonte das verificações obrigatórias (§1.1) |
| `AUTHOR_LABELS` | `autor:claude`, `autor:gemini`, `autor:doug` |
| `REVIEWER_BY_AUTHOR` | `claude → gemini`, `doug → gemini`, `gemini → claude` |
| `REVIEWER_IDENTITY` | `gemini → { login: "gemini-code-assist[bot]", type: "Bot" }`, `claude → { login: "prumo-revisor[bot]", type: "Bot" }` |
| `REVIEWER_DISPLAY` | `gemini → "Gemini"`, `claude → "Claude (prumo-revisor)"` (usado em todas as mensagens) |
| `CHECKS_APP_SLUG` | `github-actions` (check run de outro app não conta) |
| `INITIATIVE_LABEL` | regex `^iniciativa:(?:[0-9]|10)$` |
| `EMERGENCY_LABEL` | `emergencia` |
| `VIOLATION_LABEL` | `violacao-main` |
| `PROCESS_PATHS` | `docs/**`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `.specify/**`, `.gemini/**`, `.claude/**`, `.github/pull_request_template.md` |
| `GATE_SELF_PATHS` | `.github/workflows/**`, `scripts/review/**`, `src/review/**`, `tests/unit/review/**`, `scripts/setup-hooks.mjs`, `.githooks/**`, `.gemini/**`, `.claude/settings.json`, `.claude/agents/revisor-limpo.md`, `.claude/skills/revisar-pr/**`, `docs/review-checklist.md` |
| `CONSTITUTION_PATH` | `.specify/memory/constitution.md` |
| `EMERGENCY_SLA_DAYS` | `7` |
| `VERDICT_MARKER` | `<!-- prumo:veredito v1` (Claude: `head=<40 hex>` obrigatório) |
| `RESPONSE_MARKER` | `<!-- prumo:respostas v1 -->` |
| `WARNINGS_MARKER` | `<!-- prumo:avisos v1 -->` (comentário único do portão com os avisos — FR-010) |
| `FINGERPRINT_MAX_FILES` | `300` (limite do compare da API; acima disso não há rebase neutro) |

`.gemini/**` e `.claude/**` continuam áreas de processo (dispensadas de spec, Constitution I),
mas, por estarem em `GATE_SELF_PATHS`, todo PR que os toca recebe o aviso "PR altera o portão
ou os revisores — revisão manual do Doug obrigatória" e o `pr:merge` exige confirmação
explícita do Doug (contracts/review-cli.md).

### 1.1 Verificações obrigatórias derivadas do CI (`src/review/ci-checks.ts`)

`requiredChecksFromCi(workflow: unknown): string[]` recebe o `ci.yml` **da `main`** já
parseado (o parse YAML fica em `scripts/`). Regra: todo job em `jobs.*` **sem** chave `if` é
verificação obrigatória de PR e contribui com seu `name`; job sem `name` ⇒ erro
`job sem nome no CI: <id>`. Jobs com `if` (ex.: `deploy-db`, `main-guard`, só em push na
`main`) não são verificações de PR. Com o `ci.yml` da 001 o resultado é
`"Qualidade (lint, formato, tipos)"`, `"Testes unitários"`,
`"Testes de integração (Supabase efêmero)"`, `"Testes ponta a ponta (Playwright)"`, mais os jobs
que 003/004/006 acrescentarem — sem lista fixa no código.

## 2. Tipos

```ts
type Agent = "claude" | "gemini" | "doug";
type Reviewer = Exclude<Agent, "doug">;          // o Doug nunca é revisor
type Severity = "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
type Outcome = "APROVADO" | "MUDANÇAS NECESSÁRIAS";
type PrKind = "feature" | "processo" | "emenda";

interface Finding {            // linha da tabela "Achados"
  n: number;                   // inteiro ≥ 1, único no veredito
  severity: Severity;
  location: string;            // "arquivo:linha" (não vazio)
  principle: string;           // "I".."X" ou texto curto
  problem: string;
  suggestion: string;
}

interface PreviousFinding { n: number; status: "resolvido" | "justificativa aceita" | "permanece"; } // FR-020

interface Coverage { fr: string /* ^FR-\d{3}$ */; implementedIn: string; testedIn: string; ok: boolean; }

interface Verdict {
  reviewer: Reviewer;          // derivado da identidade do autor do comentário/review
  source: "review" | "comment";
  sourceId: number;            // id da review/comentário
  headSha: string;             // review.commit_id (Gemini) ou marcador head= (Claude)
  publishedAt: string;         // ISO-8601 UTC
  outcome: Outcome;
  findings: Finding[];
  previous: PreviousFinding[]; // seção "Achados anteriores" ([] se ausente)
  coverage: Coverage[];
  inputsRead?: string[];       // obrigatório quando reviewer = claude (FR-018)
  inlineSeverities?: Severity[]; // selos dos comentários de linha (Gemini)
}

interface AuthorResponse {     // comentário do autor com RESPONSE_MARKER
  lines: { n: number; action: "corrigido" | "justificado"; ref: string }[]; // ref = sha (7–40 hex, presente nos commits do PR) ou justificativa ≥ 20 caracteres
  publishedAt: string;
  authorLogin: string;         // só vale "dougueta" (conta usada pelos autores)
}

interface PrSnapshot {         // tudo que o portão lê, montado por scripts/review/github.ts
  number: number; draft: boolean; merged: boolean; mergedAt?: string;
  headSha: string; headRef: string; baseRef: string; body: string;
  labels: string[]; changedFiles: string[]; constitutionPatch?: string;
  commits: { sha: string; message: string }[];
  specExists: boolean;         // specs/<headRef>/spec.md no head do PR
  fingerprints: Record<string, string | null>; // sha → impressão do conteúdo do PR (§2.1): headSha e cada headSha de veredito
  reviews: RawReview[]; reviewComments: RawReviewComment[]; issueComments: RawIssueComment[];
}

type GateState = "success" | "pending" | "failure";
interface GateResult {
  state: GateState; reason: string /* ≤ 140 chars, pt-BR */; warnings: string[];
  kind: PrKind; designatedReviewer?: Reviewer; touchesGate: boolean; emergency: boolean;
}

interface CheckRunInfo { name: string; conclusion: string | null; appSlug: string; }

interface MainGuardInput {     // modo "push" (job main-guard do ci.yml)
  commit: { sha: string; parents: string[] };
  pr?: PrSnapshot;             // PR integrado cujo merge_commit_sha == sha
  requiredChecks: string[];    // requiredChecksFromCi(ci.yml do commit)
  checkRuns: CheckRunInfo[];   // check runs do head do PR
}
type MainGuardResult = { ok: true; emergencyPr?: number } | { ok: false; reasons: string[] };

interface MergeReadinessInput {
  gate: GateResult;            // evaluateGate recalculado localmente — nunca o status publicado
  requiredChecks: string[]; checkRuns: CheckRunInfo[];
  behindBy: number;            // compare(base...head).behind_by
  isTty: boolean;
  gateSelfConfirmed: boolean;  // Doug confirmou revisão manual de GATE_SELF_PATHS (se touchesGate)
  emergencyConfirmed: boolean; // Doug confirmou que ele aplicou "emergencia" (se emergency)
}
```

### 2.1 Impressão do conteúdo do PR — rebase neutro (FR-007, `src/review/fingerprint.ts`)

`patchFingerprint(files: CompareFile[]): string | null`, com `files` de
`GET /compare/{baseRef}...{sha}` (três pontos ⇒ a partir do merge-base):
1. `files.length ≥ FINGERPRINT_MAX_FILES` ou algum arquivo sem `patch` (binário/grande) →
   `null` (equivalência não comprovável ⇒ veredito tratado como desatualizado).
2. Para cada arquivo, ordenado por `filename`: `status`, `filename`, `previous_filename ?? ""` e
   `patch` com os cabeçalhos de hunk normalizados (`@@ -a,b +c,d @@…` → `@@`).
3. sha256 hex da concatenação (separador `"\n\u0000\n"`).

Dois heads são equivalentes ⇔ as duas impressões são ≠ `null` e iguais. Mudança nas linhas de
contexto (código vizinho alterado na `main`) muda a impressão — conservador por desenho.

### Regras de validação
- `Verdict` só é construído se o texto contém `VERDICT_MARKER`, a linha
  `## Veredito: APROVADO|MUDANÇAS NECESSÁRIAS`, a tabela "Achados" (6 colunas) e a tabela
  "Cobertura de requisitos" (4 colunas); caso contrário `parseVerdict` retorna
  `{ ok: false, error: "fora do formato" }`.
- Veredito com tabela de achados vazia é válido (`| — | — | — | — | — | — |` ou sem linhas).
- `outcome = APROVADO` com algum `finding.severity ∈ {CRÍTICO, ALTO}` **ou** algum
  `inlineSeverities ∈ {CRÍTICO, ALTO}` ⇒ incoerente ⇒ tratado como MUDANÇAS NECESSÁRIAS.
- **Re-revisão** (FR-020): se existe veredito válido MUDANÇAS anterior do mesmo revisor, o
  seguinte só é válido se `previous` cobre **todos** os `n` daquele; senão `evaluateGate` o
  desconsidera com aviso `veredito fora do formato (Achados anteriores incompletos)`. A regra
  depende de contexto e por isso fica em `evaluateGate`, não em `parseVerdict`.
- Identidade: `user.type === "Bot"` **e** `user.login` exato do catálogo. Comentários da conta do
  Doug nunca contam como veredito.
- Claude: `headSha` vem do marcador; Gemini: de `review.commit_id`.

## 3. Pacote de revisão (`.review/<n>/`, ignorado pelo git)

```text
.review/<n>/
├── manifest.json        # { pr, headSha, baseSha, branch, feature, generatedAt, files: [{path, sha256 | "ausente"}] }
├── diff.patch           # git diff base...head
├── spec/                # spec.md, plan.md, tasks.md, data-model.md, contracts/** — do HEAD do PR
├── constitution.md      # da main
├── adr/*.md             # da main
├── review-checklist.md  # da main (o PR não reescreve o checklist que o avalia)
├── anteriores/          # só em re-revisão (FR-018/FR-020)
│   ├── veredito.md      # último veredito válido do revisor designado (corpo publicado)
│   └── respostas.md     # somente as tabelas prumo:respostas publicadas depois dele
└── veredito.md          # escrito pelo revisor-limpo
```

Regras: o manifesto lista **exatamente** os arquivos do pacote (exceto `veredito.md`); a seção
"Insumos lidos" publicada é gerada do manifesto. Arquivos de spec ausentes (ex.: PR de
processo) são registrados como `ausente`, não inventados. Comentários livres do PR nunca entram
no pacote.

## 4. Máquina de estados — status "Revisão independente" de um PR

```text
            ┌── commit que muda o conteúdo / rótulo de autor muda (rebase neutro não volta) ──┐
            ▼                                                                                │
[rascunho] ─ready─▶ [aguardando veredito] ─veredito APROVADO válido─▶ [aprovado] ─merge (Doug)─▶ [integrado]
     ▲                 │        ▲                                         │
     └─draft───────────┘        │ respostas + nova revisão                │ commit que muda o conteúdo ⇒ "aguardando"
                                │                                         ▼
                       [mudanças necessárias] ◀─veredito MUDANÇAS / incoerente─
[qualquer] ─regra estrutural violada (rótulo, autoria, spec, emenda)─▶ [bloqueado] ─corrigido─▶ reavaliação
[qualquer] ─rótulo emergencia (Doug) + motivo─▶ [emergência] ─merge─▶ [revisão pós-merge pendente] ─veredito pós-merge─▶ [regularizado]
                                                                       └─ 7 dias sem veredito ─▶ [VENCIDA] (issue sinalizada)
```

Mapeamento para commit status: `aprovado`, `emergência` → `success`; `rascunho`, `aguardando
veredito` → `pending`; `mudanças necessárias`, `bloqueado` → `failure`. Falha ao consultar a
API → `pending` com `não foi possível avaliar (erro da API do GitHub) — reexecute`.

**Transições proibidas**: `aguardando → aprovado` com veredito cujo `headSha ≠ head atual` sem
equivalência por impressão; `qualquer → aprovado` com veredito do agente autor; merge aceito
pelo `pr:merge`/`main-guard` com base apenas no status publicado (ambos recalculam);
`emergência` sem motivo no corpo do PR; `integrado` sem passar por `aprovado` ou `emergência`
(detectado pelo `main-guard`).

## 5. Rótulos e marcos (estado desejado, aplicado por `npm run gh:labels`)

| Rótulo | Cor | Descrição |
|---|---|---|
| `autor:claude` | `#D97757` | PR escrito pelo Claude — revisor: Gemini (existe) |
| `autor:gemini` | `#4285F4` | PR escrito pelo Gemini — revisor: Claude (existe) |
| `autor:doug` | `#6E7781` | PR escrito pelo Doug — revisor: Gemini |
| `emergencia` | `#B60205` | Correção urgente de produção (só o Doug aplica) — revisão pós-merge em até 7 dias |
| `violacao-main` | `#000000` | Commit na main fora do fluxo protegido |
| `iniciativa:0` … `iniciativa:10` | `#C5DEF5` | Nome da iniciativa no roadmap |

Marcos: `0 · Plataforma`, `1 · Autenticação`, `2 · Contas e conexões`, `3 · Extrato`,
`4 · Visão geral`, `5 · Cartões`, `6 · Orçamento`, `7 · Comportamento`, `8 · Investimentos`,
`9 · Planejamento`, `10 · Inteligência`.

## 6. Configuração local (`.env.review.local`, já ignorado por `.env.*`; lido só em `scripts/review/*`)

| Nome | Segredo | Descrição |
|---|---|---|
| `PRUMO_REVISOR_CLIENT_ID` | não | Client ID do app `prumo-revisor` |
| `PRUMO_REVISOR_KEY_PATH` | caminho para segredo | `.pem` **cifrado com senha** (PKCS#8, AES-256) fora do repo (ex.: `~/.prumo/prumo-revisor.pem`); a senha nunca é gravada — o Doug a digita no terminal a cada publicação (FR-017) |
| `PRUMO_REPO` | não | `dougueta/prumo` |
