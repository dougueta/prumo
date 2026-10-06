# Pendências manuais do Doug

> Ações que só o Doug pode fazer (credenciais, aparelhos, aprovações, decisões de produto).
> Os agentes atualizam esta lista; o Doug marca `[x]` ao concluir. **Nunca** registrar aqui
> valores de segredos — o repositório é público.

Última atualização: 2026-10-05

## Credenciais e configuração externa

- [ ] **Secret `SUPABASE_ACCESS_TOKEN`** no GitHub (Settings → Secrets and variables → Actions →
  New repository secret). Criar em supabase.com → Account → Access Tokens. Sem ele o job
  `deploy-db` (migrações de produção) falha no merge da 001.
- [ ] **Secret `SUPABASE_DB_PASSWORD`** no GitHub — senha do banco do projeto Supabase `prumo`.
  Cadastrar pela interface ou no seu terminal com `gh secret set SUPABASE_DB_PASSWORD`
  (pede o valor; não colar em conversa com agentes).
- [ ] **Instalar o Gemini Code Assist** (app do GitHub, gratuito) no repositório `dougueta/prumo` —
  hoje nenhum PR recebe revisão automática do Gemini. Previsto na feature 002.

## Verificações manuais

- [ ] **T044 (001)** — abrir a produção no Android (Chrome) e no iOS (Safari), instalar o PWA e
  testar a página offline; anexar prints **sem dados** ao PR #2. Depende do merge da 001 na `main`.
- [ ] **T031 (001)** — verificação ponta a ponta (preview em ≤ 5 min, dois previews independentes,
  merge atualiza a produção, produção pede credenciais). O Claude conduz; o Doug confirma o
  acesso com as credenciais da trava. Depende do merge da 001.

## Aprovações e merges (nesta ordem)

- [ ] **PR #1** — constitution v1.1.0 (modo demonstração e teto de custo): aprovar e integrar.
- [ ] **PR #5** — constitution v1.2.0 (exceção de emergência e insumo dos revisores): aprovar e
  integrar depois do #1 (o Claude redireciona a base para a `main`).
- [ ] **PR #2** — 001 · Setup do projeto: aprovar e integrar quando sair de rascunho (após T049).
- [ ] **PR #6** — pesquisas R1–R5 do Gemini: revisão do Claude = MUDANÇAS NECESSÁRIAS; aguardar
  as correções do Gemini e o novo veredito antes de integrar.

## Decisões de produto pendentes (para as próximas specs)

- [ ] **Pluggy (007/008)**: confirmar se o "Meu Pluggy" gratuito cobre o fluxo direto; se não,
  escolher entre fluxo pelo app meu.pluggy.ai, plano pago ou só importação manual. Antes do
  Gate 1 da 007.
- [ ] **Gemini API Paid Tier (010/014/030)**: ~R$ 1–2/mês, fura o teto R$ 0 — aprovar ou não o
  custo (declarado na spec da feature que o introduz).
- [ ] **PDF de fatura ao LLM (010)**: enviar o documento inteiro ou exigir redação/extração prévia
  dos dados de identificação (Constitution II — minimização).
