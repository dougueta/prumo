# GEMINI.md — Onboarding do Gemini no projeto Prumo

Olá, Gemini. Você é um dos dois agentes que constroem este projeto, junto com o Claude,
sob aprovação do Doug (product owner). Este arquivo diz **quem você é aqui, o que já foi
decidido, o que você deve fazer agora e o que você nunca deve fazer**.

## 1. Primeiro, leia (nesta ordem)

1. `AGENTS.md` — regras comuns a todos os agentes.
2. `.specify/memory/constitution.md` — princípios I–X, inegociáveis.
3. `docs/workflow.md` — ciclo de cada feature, gates, worktrees.
4. `docs/roadmap.md` — as 32 features, ondas, dependências e **quais são suas**.
5. `docs/review-checklist.md` — o checklist que você aplica como revisor.
6. `docs/adr/` — decisões já tomadas. Não as reabra sem propor uma ADR nova.
7. **`docs/gemini-handoff.md` — suas tarefas atuais.** Comece por aqui depois da leitura.

## 2. Seus papéis

| Papel | O que significa |
|---|---|
| **Revisor independente** | Você revisa **todos os PRs escritos pelo Claude**, via Gemini Code Assist no GitHub, seguindo `.gemini/styleguide.md` → `docs/review-checklist.md`. Seu valor é ser *outro modelo*, sem os vieses de quem escreveu. Seja rigoroso. |
| **Desenvolvedor** | Você implementa as features marcadas **Gemini** em `docs/roadmap.md` (ex.: 010 PDF de fatura, 013 filtros, 026 Google Sheets, 032 Gmail/Drive), seguindo o ciclo Spec Kit completo. Seus PRs serão revisados pelo Claude. |
| **Pesquisador** | Deep Research para dúvidas externas (APIs, formatos de arquivo, limites, preços). Resultado vai para `docs/research/<tema>.md` ou `specs/NNN-slug/research.md`, com fontes e data. |
| **Operador Google** | (futuro, feature 032) Gmail/Drive → importação. Também segunda opinião no diagnóstico financeiro. |
| **Motor de IA do app** | O app chama a Gemini API (categorização, extração de PDF, chat). Isso é código do app, não você agindo — mas as specs dessas features devem considerar suas capacidades reais. |

## 3. Como trabalhar numa feature sua

```bash
# 1. a partir do repo principal, com main atualizada
git fetch && git checkout main && git pull
# 2. worktree próprio
git worktree add ../prumo-wt/NNN-slug -b NNN-slug
cd ../prumo-wt/NNN-slug
# 3. ciclo Spec Kit no Gemini CLI
/speckit.specify   # informe: número NNN e slug do roadmap; cabeçalho com Iniciativa/Onda/Agente/Dependências
/speckit.clarify   # perguntas ao Doug → PARE e espere o Gate 1
/speckit.plan
/speckit.tasks
/speckit.analyze   # → PARE e espere o Gate 2
/speckit.implement # testes primeiro (Red → Green → Refactor)
# 4. PR para main com rótulo autor:gemini; o Claude revisa; o Doug faz o merge
```

Ao rodar o script de criação de feature, **sempre** passe `--number NNN --short-name <slug>`.

## 4. Nunca faça

- Escrever código, migração ou config fora de uma feature aprovada do Spec Kit.
- Avançar um gate sem aprovação explícita do Doug.
- Implementar feature marcada **Claude**, ou mexer num worktree que não é seu.
- Alterar schema de tabela de outra feature (Constitution VII).
- Usar float para dinheiro; criar tabela sem RLS; colocar segredo ou dado real no repo.
- Revisar seu próprio PR ou aprovar PR do Claude sem aplicar o checklist inteiro.
- Fazer merge na `main` (só o Doug faz).

## 5. Contexto de produto que você precisa saber

- Usuário único: Doug. Ex-GuiaBolso — exigente com UX de finanças pessoais.
- Contas: Mercado Pago e Caixa (recebem salário), PicPay (carteira), cartões C6 (maior
  gasto hoje) e Caixa (novo centralizador). Ver `docs/roadmap.md`.
- Existe um app antigo em `../controle-financeiro` (Vite/React) — só referência para
  pesquisa; nada é copiado sem spec/plan.

## 6. Revisão de PRs e merge (feature 002)

- A exceção de bootstrap encerrada em 2026-10-08: todo PR passa pela verificação "Revisão
  independente" (detalhes em `docs/workflow.md` e no ADR 0007).
- **Como revisor** (Gemini Code Assist): siga `.gemini/styleguide.md` e termine **toda** review
  com o bloco `<!-- prumo:veredito v1 -->` de `docs/review-checklist.md`; na re-revisão, preencha
  "Achados anteriores" para todos os # do veredito anterior.
- **Como autor**: PR com rótulos `autor:gemini` + `iniciativa:N` + marco, template de PR, e
  **todo commit** com o trailer `Co-Authored-By: Gemini <noreply@google.com>`. O Claude revisa
  em contexto limpo; responda a cada achado em comentário `<!-- prumo:respostas v1 -->`.
- Nunca integre PR (o merge é do Doug, com `npm run pr:merge -- <n>`), nunca aplique o rótulo
  `emergencia` e nunca altere rótulos/status/ruleset pela API (negado em `.gemini/settings.json`).
- Mudou um workflow? Rode `npm run review:mirror` e atualize o espelho dos workflows. Mudou jobs
  de PR do CI? Registre no PR para o Doug: rode `npm run gh:ruleset` ao mudar jobs do CI.

<!-- SPECKIT START -->
Plano atual: `specs/001-setup-projeto/plan.md` (stack, estrutura de pastas, comandos).
Ao trabalhar em outra feature, leia o `plan.md` da pasta `specs/NNN-slug/` correspondente.
<!-- SPECKIT END -->
