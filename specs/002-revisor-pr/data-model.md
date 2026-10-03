# Data Model — 002 · Revisor de PR Independente

Esta feature **não cria tabelas nem migrações** (sem banco; Constitution VII não se aplica a
schema). Os "dados" são artefatos do GitHub (PR, commits, rótulos, reviews, comentários,
statuses) lidos pela API e estruturas em memória das funções puras de `src/review/`. Abaixo, os
tipos TypeScript canônicos (dono: 002) e suas regras de validação.

## 1. Catálogos fixos (`src/review/catalog.ts`)

| Nome | Valor |
|---|---|
| `STATUS_CONTEXT` | `"Revisão independente"` |
| `REQUIRED_CI_CHECKS` | `"Qualidade (lint, formato, tipos)"`, `"Testes unitários"`, `"Testes de integração (Supabase efêmero)"`, `"Testes ponta a ponta (Playwright)"` |
| `AUTHOR_LABELS` | `autor:claude`, `autor:gemini`, `autor:doug` |
| `REVIEWER_BY_AUTHOR` | `claude → gemini`, `doug → gemini`, `gemini → claude` |
| `REVIEWER_IDENTITY` | `gemini → { login: "gemini-code-assist[bot]", type: "Bot" }`, `claude → { login: "prumo-revisor[bot]", type: "Bot" }` |
| `INITIATIVE_LABEL` | regex `^iniciativa:(?:[0-9]|10)$` |
| `EMERGENCY_LABEL` | `emergencia` |
| `VIOLATION_LABEL` | `violacao-main` |
| `PROCESS_PATHS` | `docs/**`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `.specify/**`, `.gemini/**`, `.claude/**`, `.github/pull_request_template.md` |
| `GATE_SELF_PATHS` | `.github/workflows/**`, `scripts/review/**`, `src/review/**` |
| `CONSTITUTION_PATH` | `.specify/memory/constitution.md` |
| `EMERGENCY_SLA_DAYS` | `7` |
| `VERDICT_MARKER` | `<!-- prumo:veredito v1` (Claude: `head=<40 hex>` obrigatório) |
| `RESPONSE_MARKER` | `<!-- prumo:respostas v1 -->` |

## 2. Tipos

```ts
type Agent = "claude" | "gemini" | "doug";
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
  previousStatus?: "resolvido" | "justificativa aceita" | "permanece"; // FR-020
}

interface Coverage { fr: string /* ^FR-\d{3}$ */; implementedIn: string; testedIn: string; ok: boolean; }

interface Verdict {
  reviewer: Agent;             // derivado da identidade do autor do comentário/review
  source: "review" | "comment";
  sourceId: number;            // id da review/comentário
  headSha: string;             // review.commit_id (Gemini) ou marcador head= (Claude)
  publishedAt: string;         // ISO-8601 UTC
  outcome: Outcome;
  findings: Finding[];
  coverage: Coverage[];
  inputsRead?: string[];       // obrigatório quando reviewer = claude (FR-018)
  inlineSeverities?: Severity[]; // selos dos comentários de linha (Gemini)
}

interface AuthorResponse {     // comentário do autor com RESPONSE_MARKER
  verdictSourceId: number;     // veredito MUDANÇAS NECESSÁRIAS respondido
  lines: { n: number; action: "corrigido" | "justificado"; ref: string }[]; // ref = sha (7–40 hex) ou justificativa ≥ 20 caracteres
  publishedAt: string;
}

interface PrSnapshot {         // tudo que o portão lê, montado por scripts/review/github.ts
  number: number; draft: boolean; headSha: string; headRef: string; body: string;
  labels: string[]; changedFiles: string[]; constitutionPatch?: string;
  commits: { sha: string; message: string }[];
  specExists: boolean;
  reviews: RawReview[]; reviewComments: RawReviewComment[]; issueComments: RawIssueComment[];
}

type GateState = "success" | "pending" | "failure";
interface GateResult { state: GateState; reason: string /* ≤ 140 chars, pt-BR */; warnings: string[]; kind: PrKind; designatedReviewer?: Agent; }
```

### Regras de validação
- `Verdict` só é construído se o texto contém `VERDICT_MARKER`, a linha
  `## Veredito: APROVADO|MUDANÇAS NECESSÁRIAS`, a tabela "Achados" (6 colunas) e a tabela
  "Cobertura de requisitos" (4 colunas) — caso contrário, `parseVerdict` retorna
  `{ ok: false, error: "fora do formato" }`.
- Veredito com tabela de achados vazia é válido (escrever `| — | — | — | — | — | — |` ou omitir
  linhas).
- `outcome = APROVADO` com algum `finding.severity ∈ {CRÍTICO, ALTO}` **ou** algum
  `inlineSeverities ∈ {CRÍTICO, ALTO}` ⇒ incoerente ⇒ tratado como MUDANÇAS NECESSÁRIAS.
- Identidade: `user.type === "Bot"` **e** `user.login` exato do catálogo. Comentários da conta do
  Doug nunca contam como veredito.
- Claude: `headSha` vem do marcador; Gemini: de `review.commit_id`.

## 3. Pacote de revisão (`.review/<n>/`, ignorado pelo git)

```text
.review/<n>/
├── manifest.json        # { pr, headSha, baseSha, branch, feature, generatedAt, files: [{path, sha256}] }
├── diff.patch           # git diff base...head
├── spec/                # spec.md, plan.md, tasks.md, data-model.md, contracts/** (do head do PR)
├── constitution.md
├── adr/*.md
├── review-checklist.md
└── veredito.md          # escrito pelo revisor-limpo
```

Regras: o manifesto lista **exatamente** os arquivos do pacote (exceto `veredito.md`); a seção
"Insumos lidos" publicada é gerada do manifesto. Arquivos de spec ausentes (ex.: PR de processo)
são registrados como `ausente` no manifesto, não inventados.

## 4. Máquina de estados — status "Revisão independente" de um PR

```text
            ┌──────────── novo commit / rótulo de autor muda ────────────┐
            ▼                                                            │
[rascunho] ─ready─▶ [aguardando veredito] ─veredito APROVADO válido─▶ [aprovado] ─merge (Doug)─▶ [integrado]
     ▲                 │        ▲                                         │
     └─draft───────────┘        │ respostas + nova revisão                │ commit novo ⇒ volta a "aguardando"
                                │                                         ▼
                       [mudanças necessárias] ◀─veredito MUDANÇAS / incoerente─
[qualquer] ─regra estrutural violada (rótulo, autoria, spec, emenda)─▶ [bloqueado] ─corrigido─▶ reavaliação
[qualquer] ─rótulo emergencia + motivo─▶ [emergência] ─merge─▶ [revisão pós-merge pendente] ─veredito pós-merge─▶ [regularizado]
                                                                       └─ 7 dias sem veredito ─▶ [vencido] (issue de alerta)
```

Mapeamento para commit status: `aprovado`, `emergência` → `success`; `rascunho`, `aguardando
veredito` → `pending`; `mudanças necessárias`, `bloqueado` → `failure`.

**Transições proibidas**: `aguardando → aprovado` com veredito cujo `headSha ≠ head atual`;
`qualquer → aprovado` com veredito do agente autor; `emergência` sem motivo no corpo do PR;
`integrado` sem passar por `aprovado` ou `emergência` (detectado pelo `main-guard`).

## 5. Rótulos e marcos (estado desejado, aplicado por `npm run gh:labels`)

| Rótulo | Cor | Descrição |
|---|---|---|
| `autor:claude` | `#D97757` | PR escrito pelo Claude — revisor: Gemini (existe) |
| `autor:gemini` | `#4285F4` | PR escrito pelo Gemini — revisor: Claude (existe) |
| `autor:doug` | `#6E7781` | PR escrito pelo Doug — revisor: Gemini |
| `emergencia` | `#B60205` | Correção urgente de produção — revisão pós-merge em até 7 dias |
| `violacao-main` | `#000000` | Commit na main fora do fluxo protegido |
| `iniciativa:0` … `iniciativa:10` | `#C5DEF5` | Nome da iniciativa no roadmap |

Marcos: `0 · Plataforma`, `1 · Autenticação`, `2 · Contas e conexões`, `3 · Extrato`,
`4 · Visão geral`, `5 · Cartões`, `6 · Orçamento`, `7 · Comportamento`, `8 · Investimentos`,
`9 · Planejamento`, `10 · Inteligência`.

## 6. Configuração local (`.env.review.local`, ignorado; lido só em `scripts/review/*`)

| Nome | Segredo | Descrição |
|---|---|---|
| `PRUMO_REVISOR_CLIENT_ID` | não | Client ID do app `prumo-revisor` |
| `PRUMO_REVISOR_KEY_PATH` | caminho para segredo | `.pem` fora do repo (ex.: `~/.prumo/prumo-revisor.pem`) |
| `PRUMO_REPO` | não | `dougueta/prumo` |
