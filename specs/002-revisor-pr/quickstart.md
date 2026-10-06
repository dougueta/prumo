# Quickstart — 002 · Revisor de PR Independente

Guia para o Doug configurar uma vez e validar o fluxo. Pré-requisitos (task T055): emendas da
constitution v1.1.0 e v1.2.0, 001, 004, 003 e 006 integradas na `main` e a branch da 002
rebaseada; `gh auth status` logado como `dougueta`; Node 24; OpenSSL (vem com o Git for Windows).

## 1. Configuração única (⚠️ ações no GitHub — Doug)

1. **Gemini Code Assist**: instalar o app "Gemini Code Assist" (versão consumer) em
   `github.com/apps/gemini-code-assist`, **somente** no repositório `dougueta/prumo`; aceitar os
   termos com a conta Google pessoal.
2. **App `prumo-revisor`**: GitHub → Settings → Developer settings → GitHub Apps → New:
   - Nome `prumo-revisor`; Homepage `https://github.com/dougueta/prumo`; **Webhook desativado**.
   - Permissões de repositório: **Pull requests: Read and write** (Metadata: Read é automática).
   - "Only on this account". Criar → anotar o **Client ID** → "Generate a private key".
   - **Cifrar a chave com uma senha só sua** e apagar a original (Git Bash):
     ```
     mkdir -p ~/.prumo
     openssl pkcs8 -topk8 -v2 aes-256-cbc -in ~/Downloads/prumo-revisor.*.private-key.pem -out ~/.prumo/prumo-revisor.pem
     rm ~/Downloads/prumo-revisor.*.private-key.pem
     ```
   - Install App → `dougueta` → Only select repositories → `prumo`.
   - Criar `.env.review.local` na raiz do worktree (já ignorado por `.env.*`):
     ```
     PRUMO_REVISOR_CLIENT_ID=Iv23li...
     PRUMO_REVISOR_KEY_PATH=C:/Users/Doug/.prumo/prumo-revisor.pem
     PRUMO_REPO=dougueta/prumo
     ```
3. **Configurações do repositório**: `npm run gh:repo-settings` (só squash, apagar branch após
   merge) e `npm run gh:labels` (rótulos e marcos). Use `--dry-run` antes.
4. **Proteção** (conforme Decisão D1 do plano): opção C → nada a mais; opções A/B →
   `npm run gh:ruleset` (cria o ruleset "main protegida").
5. `npm install` (o `prepare` ativa o hook `pre-push`; em CI/Vercel ele não faz nada). O
   `core.hooksPath` vale para todas as worktrees: worktrees cujas branches ainda não têm
   `.githooks/` ficam sem hook até o rebase.

## 2. Validação (roteiro de aceite — SC-003)

| # | Ação | Esperado |
|---|---|---|
| 1 | `git push origin HEAD:main` num worktree | hook recusa: "push direto na main é proibido" |
| 2 | PR de teste `autor:claude`, `iniciativa:0`, com erro de tipo | CI vermelho; `npm run pr:merge -- <n>` sai com 6 |
| 3 | Corrigir; CI verde, sem veredito ainda | status "Revisão independente" = pending "aguardando veredito de Gemini" |
| 4 | Gemini publica veredito com bloco `prumo:veredito` | status success "APROVADO por Gemini em <sha7>" |
| 5 | Novo commit que altera um arquivo do PR | status pending "veredito desatualizado" |
| 6 | Remover rótulo `autor:claude` | failure "rótulo de autor ausente ou ambíguo" |
| 7 | Trocar para `autor:gemini` (commits têm trailer Claude) | failure "rótulo de autor inconsistente com os commits" |
| 8 | PR de feature em branch `999-teste` sem `specs/999-teste/spec.md` | failure "PR sem spec (Constitution I)" |
| 9 | PR `autor:gemini` de teste → `/revisar-pr <n>` no Claude Code → `npm run review:publish -- <n>` no terminal do Doug (senha) | comentário de `prumo-revisor[bot]` com "Insumos lidos"; status reflete o veredito |
| 10 | `/revisar-pr` num PR `autor:claude` | recusa "revisor e autor são o mesmo agente" (exit 3) |
| 11 | Comentário manual do Doug colando um bloco de veredito APROVADO | ignorado; comentário `prumo:avisos` explica "não é o revisor designado" |
| 12 | Veredito MUDANÇAS com 3 achados; responder 2; Gemini re-revisa APROVADO | failure "achados sem resposta: #3" |
| 13 | Branch `NNN-slug` de feature integrada, rótulo `emergencia` (aplicado pelo Doug) sem motivo / com motivo | failure / success "EMERGÊNCIA…"; após merge, issue "Revisão pós-merge pendente"; após 7 dias sem veredito, `VENCIDA —` |
| 14 | Merge com tudo verde: `npm run pr:merge -- <n>` | squash merge; job "Guarda da main" verde; `deploy-db` roda |
| 15 | PR aprovado; `main` avança em arquivo não tocado; rebase sem conflito | status success "… (rebase neutro)" sem nova revisão |
| 16 | PR sem veredito; Doug marca o status como success via `gh api …/statuses` | `npm run pr:merge -- <n>` sai com 6 ("aguardando veredito de Gemini") |
| 17 | Doug envia um commit trivial de docs direto na `main` com `--no-verify` | job "Guarda da main" falha, issue `violacao-main`, `deploy-db` não roda |
| 18 | `npm run review:publish -- <n>` executado por uma sessão de agente (sem TTY) | sai com 8; nada publicado |

Fechar e apagar as branches de teste ao final (reverter o commit do cenário 17 por PR);
registrar evidências (links) no PR da 002. SC-006: cronometrar, em cada PR de teste, o tempo até
o Doug saber se pode integrar e o motivo (≤ 1 min).

## 3. Uso diário

- **PR do Claude**: abrir com template + rótulos (`autor:claude`, `iniciativa:N`, marco) →
  Gemini revisa sozinho → responder achados com o bloco `prumo:respostas` **em comentário** →
  comentar `/gemini review` → status verde → Doug: `npm run pr:merge -- <n>`.
- **PR do Gemini**: Doug (ou sessão do Claude a pedido) roda `/revisar-pr <n>` no Claude Code;
  o Doug publica com `npm run review:publish -- <n>` no terminal dele.
- **Rebase antes do merge**: se o rebase não muda o conteúdo do PR, o veredito continua válido;
  se muda, peça nova revisão.
- **Revisor fora do ar**: re-acionar (`/gemini review` ou `/revisar-pr`); sem bypass. Só correção
  urgente de produção: o Doug aplica o rótulo `emergencia` + "Motivo da emergência:" no corpo,
  na branch `NNN-slug` da feature afetada (ou hotfix de processo), e garante a revisão
  pós-merge em até 7 dias.
