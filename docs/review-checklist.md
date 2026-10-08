# Checklist do Revisor Independente

Usado por **qualquer** revisor (Gemini Code Assist nos PRs do Claude e do Doug; Claude em
contexto limpo nos PRs do Gemini). Insumos (Constitution VIII, v1.2.0):
- **Claude limpo**: **somente** o pacote de revisão (`.review/<n>/`) — diff, `spec.md`,
  `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, constitution, ADRs e este checklist; em
  re-revisão, também o veredito anterior e as tabelas formais de resposta do autor.
- **Gemini Code Assist**: diff, repositório e corpo do PR (limitação da ferramenta); julga o PR
  contra spec, plan, tasks, constitution e ADRs. Os workflows chegam pelo espelho
  `tests/unit/review/__snapshots__/workflows.md`.

Não use conversas nem justificativas do autor (inclusive no corpo do PR) para formar o veredito;
justificativas valem só como respostas formais aos achados (seção "Resposta do autor").

## Postura

Você é um engenheiro sênior especialista em fintech, segurança de dados e Next.js/Supabase.
Seja rigoroso e específico. Aponte arquivo e linha. Não elogie; não sugira gosto pessoal
como se fosse defeito. Se não há problemas, diga APROVADO sem enrolação.

## 1. Aderência à spec (Constitution I, IX)
- [ ] Todo `FR-NNN` da spec tem implementação **e** teste que o cobre.
- [ ] Não há código que não corresponda a nenhum requisito/task (escopo extra = achado).
- [ ] Critérios de aceite (Gherkin) estão refletidos em testes, incluindo checagens no banco.
- [ ] Edge cases da spec (vazio, timeout, duplicado, offline, erro externo) tratados.

## 2. Segurança e privacidade (II) — qualquer falha é CRÍTICO
- [ ] Toda tabela nova tem RLS habilitado e policy explícita.
- [ ] Nenhum segredo no client, no repo, em logs ou em mensagens de erro.
- [ ] Service role / chaves só em código de servidor.
- [ ] Nenhum dado financeiro real em fixtures, seeds, testes, snapshots, screenshots.
- [ ] Dados enviados a LLM minimizados (sem número de conta, CPF, tokens).
- [ ] Entradas externas (arquivos, webhooks, respostas de API) validadas (ex.: zod).

## 3. Dinheiro e datas (III)
- [ ] Valores em centavos inteiros (`BIGINT`/`number` inteiro); zero float para dinheiro.
- [ ] Datas de transação em `DATE` / `America/Sao_Paulo`; timestamps técnicos em UTC.

## 4. Rastreabilidade e dedup (IV)
- [ ] Transações gravam `source`, `external_id` (quando houver) e lote de origem.
- [ ] Importação/sync é idempotente (constraint + teste de reimportação).
- [ ] Nada é apagado silenciosamente.

## 5. Testes (V)
- [ ] Testes foram escritos para falhar antes (ordem dos commits/tasks coerente).
- [ ] Externos mockados por contrato; nada chama produção em CI.
- [ ] E2E presente se a feature toca fluxo crítico.

## 6. IA (VI)
- [ ] Saída de IA mostra origem/confiança, é corrigível e não sobrescreve decisão manual.
- [ ] Falha da IA degrada sem bloquear.
- [ ] Chamada de IA passa pela interface `AiProvider`.

## 7. Contratos e donos (VII)
- [ ] Nenhuma alteração de schema em tabela de outra feature.
- [ ] Migração com timestamp, aditiva/reversível.
- [ ] Contratos em `contracts/` batem com a implementação (rotas, payloads, erros).
- [ ] A feature funciona no modo demonstração (repositório em memória) — ADR 0006.
- [ ] Nenhum custo recorrente novo sem estar declarado e aprovado na spec.

## 8. Qualidade geral (X)
- [ ] Sem abstrações não exigidas pela spec; dependências novas justificadas no plan.
- [ ] Tipagem estrita, sem `any` injustificado; erros tratados com mensagens úteis.
- [ ] Acessibilidade básica em UI (labels, foco, contraste) e layout mobile-first.

## Formato obrigatório do veredito

Fonte única do formato (contrato: `specs/002-revisor-pr/contracts/veredito.md`). A verificação
"Revisão independente" só reconhece o bloco que começa pelo marcador; o resto da review (resumo,
comentários de linha) pode vir antes dele.

```markdown
<!-- prumo:veredito v1 -->
## Veredito: APROVADO | MUDANÇAS NECESSÁRIAS

### Achados
| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |
|---|---|---|---|---|---|

### Achados anteriores
| # | Situação |
|---|---|

### Cobertura de requisitos
| FR | Implementado em | Testado em | OK? |
|---|---|---|---|

### Insumos lidos
```

Regras:
- **Resultado**: `APROVADO` ou `MUDANÇAS NECESSÁRIAS`. Qualquer CRÍTICO ou ALTO ⇒ MUDANÇAS
  NECESSÁRIAS (APROVADO com CRÍTICO/ALTO, na tabela ou em selo de comentário de linha, é tratado
  como MUDANÇAS NECESSÁRIAS).
- **Achados**: `#` inteiro e único (1, 2, 3…); severidade **CRÍTICO** (segurança, perda/corrupção
  de dado, dinheiro errado) · **ALTO** (requisito não atendido, bug funcional) · **MÉDIO** (teste
  faltando, edge case) · **BAIXO** (legibilidade). Sem achados: só o cabeçalho.
- **Achados anteriores** (re-revisão): todos os # do último veredito MUDANÇAS NECESSÁRIAS, com
  `resolvido`, `justificativa aceita` ou `permanece`. Faltou um # ⇒ a re-revisão é desconsiderada.
- **Cobertura de requisitos**: uma linha por `FR-NNN`, `✅` ou `❌`.
- **Insumos lidos**: obrigatório para o Claude limpo — o `npm run review:publish` a preenche a
  partir do `manifest.json` do pacote e acrescenta `head=<sha>` ao marcador. O Gemini pode omitir.

Exemplo (Claude limpo, já publicado):

```markdown
<!-- prumo:veredito v1 head=0123456789abcdef0123456789abcdef01234567 -->
## Veredito: MUDANÇAS NECESSÁRIAS

### Achados
| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |
|---|---|---|---|---|---|
| 1 | ALTO | src/import/csv.ts:42 | III | Valor convertido com parseFloat | Converter para centavos inteiros com parser decimal |
| 2 | BAIXO | src/import/csv.ts:10 | X | Nome pouco descritivo | Renomear para parseAmountCents |

### Achados anteriores
| # | Situação |
|---|---|

### Cobertura de requisitos
| FR | Implementado em | Testado em | OK? |
|---|---|---|---|
| FR-001 | src/import/csv.ts | tests/unit/import/csv.test.ts | ✅ |
| FR-002 | — | — | ❌ |

### Insumos lidos
- diff.patch (sha256: 9f2c…)
- spec/spec.md (sha256: 41aa…)
- constitution.md (sha256: 7d01…)
```

## Resposta do autor

Depois de um veredito MUDANÇAS NECESSÁRIAS, o autor publica **em comentário no PR** (nunca no
corpo do PR) uma linha por achado e só então pede nova revisão:

```markdown
<!-- prumo:respostas v1 -->
## Respostas aos achados
| # | Ação | Commit ou justificativa |
|---|---|---|
| 1 | corrigido | 3f2a9c1 |
| 2 | justificado | O nome segue o glossário da spec (FR-004) e é usado em outros 3 módulos. |
```

`corrigido` exige o sha (7–40 hex) de um commit do PR; `justificado` exige justificativa técnica
(≥ 20 caracteres). Concordância performática não é resposta.

## Emergência (Constitution VIII, exceção única)

PR com rótulo `emergencia` aplicado pelo Doug e `Motivo da emergência:` no corpo pode ser
integrado sem veredito; a revisão independente, por este mesmo checklist, é feita **após o
merge em até 7 dias** (issue "Revisão pós-merge pendente: #N"; vencido o prazo, `VENCIDA —`).
Todo CRÍTICO ou ALTO da revisão pós-merge vira correção imediata. Não vale para PR que altera a
constitution ou os mecanismos de revisão.
