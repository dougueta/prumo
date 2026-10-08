# Pendências manuais do Doug

> Ações que só o Doug pode fazer (credenciais, aparelhos, aprovações, decisões de produto).
> Os agentes atualizam esta lista; o Doug marca `[x]` ao concluir. **Nunca** registrar aqui
> valores de segredos — o repositório é público.

Última atualização: 2026-10-08

## Credenciais e configuração externa

- [x] **Secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`** no GitHub — cadastrados em
  2026-10-08; `SUPABASE_PROJECT_REF` corrigido (apontava para outro projeto). Migrações de
  produção aplicadas pelo job `deploy-db`.
- [x] **Vercel Authentication** voltou para **Standard Protection** (estava em *All Deployments*,
  o que bloqueava a produção) — 2026-10-08.
- [x] **`PRODUCTION_GATE_USER` / `PRODUCTION_GATE_PASSWORD`** (≥ 20 caracteres) na Vercel,
  ambiente Production, + redeploy — 2026-10-08. Keepalive voltou a passar.
- [ ] **Instalar o Gemini Code Assist** (app do GitHub, gratuito) no repositório `dougueta/prumo` —
  hoje nenhum PR recebe revisão automática do Gemini. Previsto na feature 002.

## Verificações manuais

- [ ] **T031 (001)** — verificação ponta a ponta (preview em ≤ 5 min, dois previews independentes,
  merge atualiza a produção, produção pede credenciais). O Claude conduz; o Doug confirma o
  acesso à produção com as credenciais da trava.
- [ ] **T044 (001)** — abrir a produção no Android (Chrome) e no iOS (Safari), instalar o PWA e
  testar a página offline; mandar prints **sem dados** para anexar ao PR da verificação.

## Aprovações e merges

- [x] PRs #1 e #5 (constitution v1.1.0 e v1.2.0), #2 (001 · Setup) e #6 (pesquisas R1–R5) —
  integrados.
- [ ] **PR da verificação da 001** (T031/T044/T049): aprovar e integrar ao final.

## Decisões de produto pendentes (para as próximas specs)

- [ ] **Pluggy (007/008)**: confirmar se o "Meu Pluggy" gratuito cobre o fluxo direto; se não,
  escolher entre fluxo pelo app meu.pluggy.ai, plano pago ou só importação manual. Antes do
  Gate 1 da 007.
- [ ] **Gemini API Paid Tier (010/014/030)**: ~R$ 1–2/mês, fura o teto R$ 0 — aprovar ou não o
  custo (declarado na spec da feature que o introduz).
- [ ] **PDF de fatura ao LLM (010)**: enviar o documento inteiro ou exigir redação/extração prévia
  dos dados de identificação (Constitution II — minimização).
