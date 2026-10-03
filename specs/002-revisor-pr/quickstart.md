# Quickstart — 002 · Revisor de PR Independente

Guia para o Doug configurar uma vez e validar o fluxo. Pré-requisito: feature 001 integrada
(CI ativo), `gh auth status` logado como `dougueta`, Node 24.

## 1. Configuração única (⚠️ ações no GitHub — Doug)

1. **Gemini Code Assist**: instalar o app "Gemini Code Assist" (versão consumer) em
   `github.com/apps/gemini-code-assist`, **somente** no repositório `dougueta/prumo`; aceitar os
   termos com a conta Google pessoal.
2. **App `prumo-revisor`**: GitHub → Settings → Developer settings → GitHub Apps → New:
   - Nome `prumo-revisor`; Homepage `https://github.com/dougueta/prumo`; **Webhook desativado**.
   - Permissões de repositório: **Pull requests: Read and write** (Metadata: Read é automática).
   - "Only on this account". Criar → anotar o **Client ID** → "Generate a private key".
   - Mover o `.pem` para `%USERPROFILE%\.prumo\prumo-revisor.pem` (fora do repo).
   - Install App → `dougueta` → Only select repositories → `prumo`.
   - Criar `.env.review.local` na raiz do worktree:
     ```
     PRUMO_REVISOR_CLIENT_ID=Iv23li...
     PRUMO_REVISOR_KEY_PATH=C:/Users/Doug/.prumo/prumo-revisor.pem
     PRUMO_REPO=dougueta/prumo
     ```
3. **Configurações do repositório**: `npm run gh:repo-settings` (só squash, apagar branch após
   merge) e `npm run gh:labels` (rótulos e marcos). Use `--dry-run` antes.
4. **Proteção** (conforme Decisão D1 do plano): opção C → nada a mais; opções A/B →
   `npm run gh:ruleset` (cria o ruleset "main protegida").
5. `npm install` (ativa o hook `pre-push` via `prepare`).

## 2. Validação (roteiro de aceite — SC-003)

| # | Ação | Esperado |
|---|---|---|
| 1 | `git push origin HEAD:main` num worktree | hook recusa: "push direto na main é proibido" |
| 2 | PR de teste `autor:claude`, `iniciativa:0`, com erro de tipo | CI vermelho; `npm run pr:merge -- <n>` sai com 6 |
| 3 | Corrigir; CI verde, sem veredito ainda | status "Revisão independente" = pending "aguardando veredito de Gemini" |
| 4 | Gemini publica veredito com bloco `prumo:veredito` | status success "APROVADO por Gemini em <sha7>" |
| 5 | Novo commit no PR | status pending "veredito desatualizado" |
| 6 | Remover rótulo `autor:claude` | failure "rótulo de autor ausente ou ambíguo" |
| 7 | Trocar para `autor:gemini` (commits têm trailer Claude) | failure "rótulo de autor inconsistente com os commits" |
| 8 | PR de feature em branch `999-teste` sem `specs/999-teste/spec.md` | failure "PR sem spec (Constitution I)" |
| 9 | PR `autor:gemini` de teste → `/revisar-pr <n>` no Claude Code | comentário de `prumo-revisor[bot]` com "Insumos lidos"; status reflete o veredito |
| 10 | `/revisar-pr` num PR `autor:claude` | recusa "revisor e autor são o mesmo agente" (exit 3) |
| 11 | Comentário manual do Doug colando um bloco de veredito APROVADO | ignorado (não é bot designado) |
| 12 | Veredito MUDANÇAS com 3 achados; responder 2; Gemini re-revisa APROVADO | failure "achados sem resposta: #3" |
| 13 | Rótulo `emergencia` sem motivo / com motivo | failure / success "EMERGÊNCIA…"; após merge, issue "Revisão pós-merge pendente" |
| 14 | Merge com tudo verde: `npm run pr:merge -- <n>` | squash merge; `main-guard` verde |

Fechar e apagar as branches de teste ao final; registrar evidências (links) no PR da 002.

## 3. Uso diário

- **PR do Claude**: abrir com template + rótulos → Gemini revisa sozinho → responder achados com
  o bloco `prumo:respostas` → comentar `/gemini review` → status verde → Doug: `npm run pr:merge -- <n>`.
- **PR do Gemini**: Doug (ou sessão do Claude a pedido) roda `/revisar-pr <n>` no Claude Code.
- **Revisor fora do ar**: re-acionar (`/gemini review` ou `/revisar-pr`); sem bypass. Só correção
  urgente de produção: rótulo `emergencia` + "Motivo da emergência:" no corpo.
