# ADR 0007 — Proteção da `main` com o repositório público e revisão independente verificável

- **Status**: Aceita · **Data**: 2026-10-05 (decisão) / 2026-10-08 (implementação) · **Decisor**: Doug
  · **Origem**: spec 002 (Gate 2, decisão D1) — `specs/002-revisor-pr/`

## Contexto
A Constitution VIII exige revisão por um agente que não escreveu o PR, veredito formal e merge
só com CI verde + APROVADO + Doug. Até a 002 isso era só regra escrita (exceção de bootstrap).
No plano Free do GitHub, branch protection e rulesets só existem em repositório **público**
(`gh api .../rulesets` devolvia 403 com o repositório privado — research R-03). Os agentes
(Claude e Gemini) usam a conta do Doug, então o servidor não distingue agente de Doug.

## Decisão
1. **D1 = A · repositório público** (Doug, 2026-10-05). O mecanismo principal é o ruleset
   **"main protegida"** (`npm run gh:ruleset`, data-model §7): PR obrigatório; verificações de
   PR do `ci.yml` + "Revisão independente" obrigatórias, **todas fixadas ao app GitHub Actions**
   (`integration_id` 15368); branch atualizada (estrito); só squash; histórico linear; sem
   force-push e sem deleção; `bypass_actors: []` (nem administrador).
2. **Verificação "Revisão independente"** (`.github/workflows/review-gate.yml` →
   `scripts/review/gate.ts` → `evaluateGate`): commit status calculado a partir de rótulos,
   trailers de autoria, arquivos, vereditos e respostas do PR (tabela de decisão em
   `contracts/review-gate.md`). Só valem vereditos de `gemini-code-assist[bot]` (PRs
   `autor:claude`/`autor:doug`) e de `prumo-revisor[bot]` (GitHub App do Doug, PRs `autor:gemini`).
3. **Camadas mantidas da opção C** (porque o servidor não distingue agente de Doug e o ruleset
   só vê o status, não o veredito):

| Camada | Decisão | Por quê |
|---|---|---|
| Deny rules dos agentes (`.claude/settings.json`, `.gemini/settings.json`) | Mantida | Implementa o FR-004(a): merge, publicação de veredito, ruleset, rótulos/status pela API e rótulo `emergencia` negados aos agentes |
| `npm run pr:merge` (TTY, recálculo do portão, confirmações `revisei`/`emergencia`) | Mantido | O status pode ser forjado por um workflow na versão de um PR da própria conta; o comando recalcula `evaluateGate` e exige o Doug no terminal |
| Job "Guarda da main" no `ci.yml` (`deploy-db` depende dele) | Mantido | Recalcula o portão em todo push na `main`; violação abre issue `violacao-main` e impede as migrações de produção |
| `main-guard.yml` agendado (emergências, `VENCIDA —`) | Mantido | FR-024 e emenda v1.2.0 |
| Hook `pre-push` + `prepare` | **Removido** | O servidor já recusa push direto, force-push e deleção para todos; o `prepare` arriscava quebrar o `npm install` da Vercel |

4. **Segredo de ferramenta local** (interpretação do Princípio II): a chave privada do app
   `prumo-revisor` fica **fora do repositório**, em `~/.prumo/`, **cifrada (PKCS#8, AES-256) com
   uma senha que só o Doug digita** no terminal a cada publicação; nunca é impressa, gravada em
   log ou versionada. É uma credencial da ferramenta de revisão do Doug, não do app Prumo.
5. **Espelho dos workflows** (C5): o Gemini Code Assist não revisa `.github/workflows/**`; o
   conteúdo exato de cada workflow vai para `tests/unit/review/__snapshots__/workflows.md`
   (`npm run review:mirror`), travado por teste e revisado pelo Gemini.

## Análise de ameaça — repositório público

Já aplicado no GitHub pelo Doug em 2026-10-05: environment `production` restrito à branch
`main`; aprovação obrigatória de workflows para **todo** colaborador externo; secret scanning e
push protection ativos.

| Ameaça | Controle |
|---|---|
| PR de fork executando código com token de escrita ou segredos via `pull_request_target`/`issue_comment` | Os workflows da 002 só fazem checkout da `main` (`persist-credentials: false`, `npm ci --ignore-scripts`); nenhum `secrets.*` além de `GITHUB_TOKEN`; nenhum `environment`; permissões mínimas por job — travado por `tests/unit/review/workflows.test.ts` |
| Injeção de texto do PR (título, corpo, branch, comentário) em `run:` | Nenhuma expressão interpolada em `run:`; só o **número** do PR entra, via `env`; saídas (status, comentário de avisos, resumo do job) usam só textos do catálogo, números e shas |
| `pull_request_review` de fork rodando o workflow da versão do fork | Token somente leitura e sem segredos; o job `redispatch` só tem `actions: write` (negado a fork) e não faz checkout; aprovação de workflows externos ativa |
| PR de terceiro integrado | Regra 0 do portão (FR-026): autor ≠ `dougueta` ou branch de fork ⇒ failure; o ruleset exige o status verde |
| Veredito falso publicado por terceiro em comentário | Identidade só por `user.login` + `type: Bot` do catálogo; respostas do autor só da conta `dougueta` |
| Segredos de produção expostos a PR | `deploy-db` só em push na `main`, `environment: production` restrito à `main`; o CI de PR da 001 não usa segredos |
| Segredo ou dado real já no histórico | Secret scanning (varre o histórico) e auditoria única (task T073, abaixo) |
| Preview da Vercel para PR de fork | Proteção de fork da Vercel (T073); preview roda em modo demonstração, sem banco nem segredos (ADR 0006) |
| Abuso de minutos/ruído (comentários em massa) | Minutos de Actions gratuitos em repositório público; `concurrency` por PR cancela avaliações redundantes |
| Exposição de informação de produto (roadmap cita as instituições do Doug) | Aceita pelo Doug ao escolher A; nenhum dado financeiro real no repositório (Constitution II) |

### Auditoria do repositório público (task T073 — a preencher pelo Doug)
- [ ] 0 alertas abertos de secret scanning (histórico inteiro)
- [ ] `.env.example` sem valores reais
- [ ] `tests/fixtures/**` só com dados sintéticos
- [ ] nenhum dado financeiro real em `docs/` e `specs/`
- [ ] environment `production` restrito à `main` e aprovação de workflows externos confirmados
- [ ] proteção de PR de fork da Vercel ativa

## Riscos residuais
- **`autor:doug` sem trailers direciona o revisor**: a autoria vem dos trailers `Co-Authored-By`;
  um commit sem nenhum trailer é atribuído ao Doug. Um agente que omita o próprio trailer e
  rotule o PR como `autor:doug` faz o PR ser revisado pelo Gemini — um Gemini autor escaparia
  assim do revisor Claude. Mitigação: o `npm run pr:merge` avisa quando um PR `autor:doug` não
  tem nenhum trailer de agente, para o Doug confirmar que foi ele quem escreveu; os agentes são
  instruídos (AGENTS.md, GEMINI.md) a sempre assinar os commits (achado 4 da revisão do PR #10).
- **Status forjado**: um workflow na versão de um PR da própria conta (evento
  `pull_request_review`) pode publicar o status "Revisão independente" com o mesmo
  `integration_id` do Actions e satisfazer o ruleset. Mitigação: `pr:merge` recalcula e recusa
  (exit 6); a Guarda da main recalcula após o merge, abre `violacao-main` e segura o `deploy-db`;
  PRs que tocam `.github/workflows/**` recebem o aviso de revisão manual do Doug.
- **Deny rules contornáveis**: as regras dos agentes são padrões de texto (o próprio Claude Code
  e o Gemini CLI avisam); um agente pode chamar a API por outro caminho ou via shell interativo
  (PTY). O shell interativo do Gemini CLI está desativado, mas isso não fecha todos os caminhos.
- **Agente integrando PR já aprovado**: com o token do Doug, um agente que contorne as regras
  locais consegue integrar um PR que **já cumpre** todas as condições do servidor (checks verdes,
  revisão válida, branch atualizada). O dano é limitado ao que o Doug aprovaria de qualquer forma,
  mas o "só o Doug integra" (Gate 3) fica sem garantia técnica nesse caso.
- **Deploy de produção da Vercel não espera a Guarda da main**: a Vercel publica a `main` sem
  depender do CI. Um merge com status forjado chega à produção antes do alerta (as migrações não).
  Mitigação: o ruleset impede o caminho comum; reverter por PR.
- **Gemini Code Assist depende de serviço externo gratuito**: se ficar indisponível ou mudar o
  formato, o portão fica `pending` (sem bypass, FR-024) até o re-acionamento.
- **Leitura da chave cifrada pelos agentes**: a negação de leitura de `~/.prumo/**` vale só para o
  Claude Code; o arquivo é cifrado com senha, então sem a senha do Doug a chave não serve.

## Consequências
- A exceção de bootstrap termina com o merge da 002; todo PR passa pelo portão.
- Toda mudança de workflow exige atualizar o espelho; toda mudança de job de PR do `ci.yml`
  exige reexecutar `npm run gh:ruleset` depois do merge.
- Custo continua R$ 0: Gemini Code Assist (consumer), GitHub App e Actions (repositório público).

## Alternativas rejeitadas
- **B · GitHub Pro** (≈ R$ 22/mês): fora do teto R$ 0.
- **C · privado com controles compensatórios**: proteção só preventiva nos agentes e detectiva no
  servidor; exigiria reescrever FR-001/002/005.
