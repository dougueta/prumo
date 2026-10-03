# Checklist do Revisor Independente

Usado por **qualquer** revisor (Gemini Code Assist nos PRs do Claude; Claude em contexto
limpo nos PRs do Gemini). O revisor lê **somente**: o diff, `specs/NNN-*/spec.md`,
`plan.md`, `tasks.md`, `data-model.md`, `contracts/`, a constitution e `docs/adr/`.
Não leia conversas ou justificativas do autor antes de formar seu veredito.

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

## 8. Qualidade geral (X)
- [ ] Sem abstrações não exigidas pela spec; dependências novas justificadas no plan.
- [ ] Tipagem estrita, sem `any` injustificado; erros tratados com mensagens úteis.
- [ ] Acessibilidade básica em UI (labels, foco, contraste) e layout mobile-first.

## Formato obrigatório do veredito

```
## Veredito: APROVADO | MUDANÇAS NECESSÁRIAS

### Achados
| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |
|---|---|---|---|---|---|

### Cobertura de requisitos
| FR | Implementado em | Testado em | OK? |
```

Severidades: **CRÍTICO** (segurança, perda/corrupção de dado, dinheiro errado) ·
**ALTO** (requisito não atendido, bug funcional) · **MÉDIO** (teste faltando, edge case) ·
**BAIXO** (legibilidade). Qualquer CRÍTICO ou ALTO ⇒ MUDANÇAS NECESSÁRIAS.
