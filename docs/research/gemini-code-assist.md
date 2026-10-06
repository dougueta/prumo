# Research: Gemini Code Assist no GitHub (R5)

> **Data da pesquisa**: 05 de outubro de 2026  
> **Autor**: Gemini (Deep Research)  
> **Alimenta as features**: `002 · revisor-pr`  
> **Formato de entrega**: Conforme padronizado em `docs/gemini-handoff.md`

---

## 1. Resumo (5 linhas)

O Gemini Code Assist no GitHub opera via GitHub App conectado a um projeto no Google Cloud, suportando repositórios privados e configurado através dos arquivos `.gemini/config.yaml` e `.gemini/styleguide.md`.
O assistente produz resumos de PRs, comentários inline contextualizados e sugestões de código, filtrando achados por limites de severidade (`LOW`, `MEDIUM`, `HIGH`).
Nativamente, o bot posta comentários e threads de revisão, **não emitindo aprovação formal (`APPROVE`)** que satisfaça regras nativas de aprovação humana no GitHub Branch Protection.
Para transformar o veredito em bloqueio obrigatório (Gate da Constitution VIII), a solução mais robusta é um workflow no GitHub Actions que valida a presença do texto `APROVADO` do checklist nas avaliações do bot.
Essa automação, combinada com a exigência de resolução obrigatória de conversas (*Require conversation resolution*), assegura que PRs do Claude nunca sejam mesclados com apontamentos críticos pendentes.

---

## 2. Achados Detalhados

### 2.1 Instalação e Configuração em Repositório Privado

1. **GitHub App Oficial**:
   - Instalado diretamente pelo GitHub Marketplace ou console do Google Cloud vinculando a organização/usuário `dougueta`.
   - Requer permissões de leitura/escrita em Pull Requests e Checks no repositório `prumo`.
2. **Vinculação com o Google Cloud (GCP)**:
   - A GitHub App conecta-se ao projeto GCP (onde a Cloud AI Companion / Gemini Code Assist API está habilitada).
   - O faturamento e as cotas são associados ao projeto configurado no GCP.

### 2.2 Estrutura de Arquivos em `.gemini/`

O comportamento do revisor é governado por dois arquivos na raiz:

```text
.gemini/
├── config.yaml       # Configuração comportamental e limites técnicos
└── styleguide.md     # Instruções de domínio, severidade e checklist
```

#### A. Especificação de `.gemini/config.yaml`
```yaml
version: 1
enabled_features:
  auto_review: true             # Dispara automaticamente em todo PR aberto/atualizado
  post_review_summary: true     # Posta resumo estruturado no topo do PR
  inline_suggestions: true      # Sugere código nos diffs quando aplicável

code_review:
  comment_severity_threshold: LOW  # LOW garante que todos os achados (baixo a crítico) apareçam
  ignore_patterns:
    - "specs/**"                # Foca no código/testes em src/ e tests/
    - "tests/fixtures/**"       # Ignora saídas geradas determinísticas
    - "package-lock.json"
    - "public/icons/**"
```

#### B. Especificação de `.gemini/styleguide.md`
O arquivo já foi pré-criado no repositório e codifica as prioridades da Constitution:
- **Segurança/privacidade** (Constitution II) $\rightarrow$ Falha = **CRÍTICO**.
- **Dinheiro exato** (Constitution III) $\rightarrow$ Qualquer float = **CRÍTICO**.
- **Aderência à spec** (Constitution I, IX) $\rightarrow$ Falta de teste ou código extra = **ALTO**.
- **Formato obrigatório de encerramento**: Tabela de achados + Tabela de cobertura de FRs + Bloco final `## Veredito: APROVADO` ou `## Veredito: MUDANÇAS NECESSÁRIAS`.

### 2.3 Capacidades e Limitações do Bot

| Capacidade | Suportado? | Detalhes |
|---|---|---|
| **Resumo do PR** | Sim | Gera resumo em linguagem natural destacando as principais mudanças. |
| **Comentários Inline** | Sim | Anota diretamente a linha de código com o problema e sugestão de correção (*diff replacement*). |
| **Classificação de Severidade** | Sim | Marca comentários como `LOW`, `MEDIUM` ou `HIGH`. |
| **Aprovação Formal de PR (`APPROVE`)** | **Não (Nativo)** | O bot posta comentários (`COMMENT`), mas não submete o evento de revisão nativo do GitHub como aprovação humana. |
| **Rejeição Formal (`REQUEST_CHANGES`)** | **Não (Nativo)** | Aponta problemas como threads de conversa, sem mudar o status da branch protection nativa de aprovações. |

### 2.4 Como Transformar o Veredito em Check Obrigatório (Blocking Check)

Como o bot não emite um `APPROVE` formal reconhecido pela regra de aprovação humana do GitHub, adota-se um padrão em **duas camadas**:

#### Camada 1: GitHub Action de Validação de Veredito (`review-gate.yml`)
Cria-se um workflow no GitHub Actions que lê a revisão postada pelo bot e gera um Status Check verde ou vermelho:

```yaml
# .github/workflows/review-gate.yml
name: Revisor Independente Gate

on:
  pull_request_review:
    types: [submitted, edited]
  pull_request:
    types: [synchronize]

jobs:
  verify-verdict:
    runs-on: ubuntu-latest
    steps:
      - name: Verificar Veredito do Gemini
        uses: actions/github-script@v7
        with:
          script: |
            const reviews = await github.rest.pulls.listReviews({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.payload.pull_request.number,
            });

            const geminiReviews = reviews.data.filter(r => 
              r.user.login.includes('gemini') || r.user.login.includes('bot')
            );

            if (geminiReviews.length === 0) {
              core.setFailed('Aguardando revisão independente do Gemini Code Assist.');
              return;
            }

            const latestReview = geminiReviews[geminiReviews.length - 1];
            const body = latestReview.body || '';

            if (body.includes('Veredito: APROVADO') && !body.includes('MUDANÇAS NECESSÁRIAS')) {
              core.info('✅ Revisão aprovada pelo Gemini Code Assist!');
            } else {
              core.setFailed('❌ PR possui apontamentos pendentes do revisor (MUDANÇAS NECESSÁRIAS).');
            }
```

#### Camada 2: Regras de Branch Protection no GitHub
No repositório (Settings $\rightarrow$ Branches $\rightarrow$ Branch protection rule para `main`):
1. **Require status checks to pass before merging**:
   - Marcar `verify-verdict` como check obrigatório.
   - Marcar os jobs do `ci.yml` (`quality`, `unit`, `integration`, `e2e`).
2. **Require conversation resolution before merging**:
   - Marcado como ativo: todo comentário inline feito pelo Gemini precisa ser resolvido/respondido antes do merge ser habilitado.
3. **Require approvals**:
   - Exigir 1 aprovação formal do Doug (product owner / Gate 3).

---

## 3. Limitações e Riscos

1. **Falso Positivo / Alucinação em Código Complexo**:
   - Modelos de IA podem sugerir mudanças desnecessárias ou questionar regras intencionais.
   - *Mitigação*: Constitution VIII estabelece que o autor do PR pode responder com justificativa técnica se o apontamento for infundado.
2. **Latência de Revisão**:
   - O bot pode levar entre 30 segundos a 2 minutos para processar diffs grandes após o push.
   - *Mitigação*: O workflow do GitHub Actions deve aguardar ou re-executar quando a revisão for submetida (`on: pull_request_review`).
3. **Custo do Code Assist**:
   - O Gemini Code Assist no GitHub possui planos de teste/trial e planos pagos por desenvolvedor no Google Cloud. Se o trial expirar, a verificação via GitHub Actions pode usar a própria **Gemini API** (analisada em R3) com um script CLI para gerar o veredito sem custos extras.

---

## 4. Recomendações Técnicas para a Feature 002

1. **Estrutura de Arquivos da Feature 002**:
   - Criar `.gemini/config.yaml` com as configurações afinadas de severidade e exclusões.
   - Manter `.gemini/styleguide.md` alinhado ao `docs/review-checklist.md`.
2. **Implementar o Workflow `review-gate.yml`**:
   - Configurar o check `verify-verdict` no GitHub Actions para dar visibilidade transparente do status da revisão independente diretamente na UI do Pull Request.
3. **Template de Pull Request**:
   - Criar `.github/pull_request_template.md` exigindo:
     - Número e título da feature (`NNN · Slug`).
     - Rótulo de agente (`autor:claude` ou `autor:gemini`).
     - Tabela de cobertura de requisitos (`FR-NNN`).
     - Checklist pré-submissão.

---

## 5. Fontes Consultadas

1. **Google Cloud — Gemini Code Assist for GitHub Overview**:  
   [https://cloud.google.com/gemini/docs/codeassist/overview](https://cloud.google.com/gemini/docs/codeassist/overview) — Acessado em 05/10/2026.
2. **Google Cloud — Customizing Code Reviews with config.yaml and styleguide.md**:  
   [https://cloud.google.com/gemini/docs/codeassist/configure-reviews](https://cloud.google.com/gemini/docs/codeassist/configure-reviews) — Acessado em 05/10/2026.
3. **GitHub Documentation — About Protected Branches & Status Checks**:  
   [https://docs.github.com/en/repositories/configuring-branches-and-merges-in-a-repository/defining-the-mergeability-of-pull-requests/about-protected-branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-a-repository/defining-the-mergeability-of-pull-requests/about-protected-branches) — Acessado em 05/10/2026.
4. **GitHub Documentation — Actions: github-script for Pull Request Workflows**:  
   [https://github.com/actions/github-script](https://github.com/actions/github-script) — Acessado em 05/10/2026.

