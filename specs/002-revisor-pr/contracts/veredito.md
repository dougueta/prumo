# Contrato — Formato do veredito e da resposta do autor (FR-007, FR-010, FR-016, FR-018, FR-019, FR-020)

Fonte única do formato: `docs/review-checklist.md` (seção "Formato obrigatório do veredito"),
estendida por este contrato. Parser: `src/review/parse-verdict.ts` e
`src/review/parse-responses.ts`.

## 1. Veredito

Publicado como **corpo de review** (Gemini) ou **comentário de issue no PR** (prumo-revisor).
O bloco pode ser precedido de texto livre (ex.: o resumo `## Code Review` do Gemini); o parser
procura a partir do marcador.

```markdown
<!-- prumo:veredito v1 head=<sha40> -->        ← head= obrigatório para o Claude; opcional (ignorado) no Gemini
## Veredito: APROVADO | MUDANÇAS NECESSÁRIAS

### Achados
| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |
|---|---|---|---|---|---|
| 1 | ALTO | src/review/gate.ts:42 | VIII | ... | ... |

### Achados anteriores                          ← obrigatório em re-revisão (FR-020)
| # | Situação |
|---|---|
| 1 | resolvido \| justificativa aceita \| permanece |

### Cobertura de requisitos
| FR | Implementado em | Testado em | OK? |
|---|---|---|---|
| FR-001 | ... | ... | ✅ \| ❌ |

### Insumos lidos                               ← obrigatório para o Claude (gerado do manifest)
- diff.patch (sha256: …)
- spec/spec.md …
```

### Regras de parsing (`parseVerdict`, sem contexto)
| Situação | Resultado |
|---|---|
| Sem marcador `<!-- prumo:veredito v1` | não é veredito (ignorado silenciosamente) |
| Marcador presente, mas falta cabeçalho/tabela "Achados"/tabela "Cobertura" | `fora do formato` (aviso) |
| Severidade fora de `CRÍTICO/ALTO/MÉDIO/BAIXO` (aceita sem acento: `CRITICO`, `MEDIO`) | `fora do formato` |
| `#` repetido ou não inteiro (em "Achados" ou "Achados anteriores") | `fora do formato` |
| Situação em "Achados anteriores" fora da lista | `fora do formato` |
| Claude sem `head=` ou sem "Insumos lidos" | `fora do formato` |
| `APROVADO` com achado CRÍTICO/ALTO (tabela ou selo inline) | válido, `outcome` efetivo = MUDANÇAS NECESSÁRIAS + aviso "veredito incoerente" |

### Regra de contexto (`evaluateGate`)
| Situação | Resultado |
|---|---|
| Re-revisão cujo "Achados anteriores" não cobre todos os # do último veredito MUDANÇAS válido do mesmo revisor | desconsiderado, aviso `veredito fora do formato (Achados anteriores incompletos)` |

Selo inline do Gemini: URL `codereviewagent/(critical|high|medium|low)-priority.svg` →
`CRÍTICO|ALTO|MÉDIO|BAIXO`.

## 2. Resposta do autor (FR-019)

Comentário de issue no PR (conta do Doug, usada pelos autores). A seção "Respostas aos achados"
do template de PR é só instrução: **o corpo do PR não é lido como resposta**.

```markdown
<!-- prumo:respostas v1 -->
## Respostas aos achados
| # | Ação | Commit ou justificativa |
|---|---|---|
| 1 | corrigido | 3f2a9c1 |
| 2 | justificado | O FR-012 dispensa spec para PR de processo; o arquivo está em docs/. |
```

Regras: `Ação ∈ {corrigido, justificado}`; `corrigido` exige sha (7–40 hex) presente nos commits
do PR; `justificado` exige texto ≥ 20 caracteres; só vale comentário da conta `dougueta`. Uma
resposta cobre o veredito MUDANÇAS NECESSÁRIAS **mais recente anterior a ela**. Respostas
múltiplas se somam (união dos #).

## 3. Comentário de avisos do portão (FR-010)

Comentário único do `github-actions[bot]`, mantido pelo portão:

```markdown
<!-- prumo:avisos v1 -->
**Avisos da verificação "Revisão independente"** (head `<sha7>`)
- veredito de gemini desconsiderado: não é o revisor designado
```

Nunca é veredito nem resposta (o parser ignora o marcador).
