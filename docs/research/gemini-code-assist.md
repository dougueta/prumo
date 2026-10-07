# Research: Gemini Code Assist no GitHub (R5)

> **Data da pesquisa**: 05 de outubro de 2026  
> **Autor**: Gemini (Deep Research)  
> **Alimenta as features**: `002 · revisor-pr`  
> **Formato de entrega**: Conforme padronizado em `docs/gemini-handoff.md`  
> ⚠️ **Documento Exploratório / Superado**: Esta pesquisa preliminar foi complementada e detalhada pela pesquisa da Feature 002 em `specs/002-revisor-pr/research.md`. Onde houver divergência quanto a schemas, branch protection ou arquitetura de gates, **prevalecem as definições normativas da Feature 002**.

---

## 1. Resumo (5 linhas)

O Gemini Code Assist no GitHub opera via GitHub App conectado a um projeto no Google Cloud (versão enterprise) ou aplicativo consumer gratuito (cota de pelo menos 100 revisões de PR por dia por instalação, conforme a página oficial de cotas), configurado via `.gemini/config.yaml` e `.gemini/styleguide.md`.
O assistente produz resumos de PRs, comentários inline e sugestões de código filtradas por severidade (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), mas não revisa arquivos em `.github/workflows/`.
Nativamente, o bot posta comentários e threads de revisão, **não emitindo aprovação formal (`APPROVE`)** que satisfaça regras de aprovação humana no GitHub Branch Protection.
Para transformar o veredito em bloqueio obrigatório (Gate da Constitution VIII), a Feature 002 projeta uma automação segura no GitHub Actions para verificar o veredito do bot ou invocar o revisor diretamente.
As regras de branch protection devem exigir a resolução obrigatória de conversas (_Require conversation resolution_) e manter `required_approving_review_count: 0`, permitindo o merge pelo Doug sem conflito de auto-aprovação.

---

## 2. Achados Detalhados

### 2.1 Instalação e Modalidades (Consumer vs. Enterprise)

1. **Modalidade Consumer (Gratuita)**:
   - Instalada via GitHub App diretamente na conta/organização do usuário.
   - Fornece cota diária de revisões gratuitas (pelo menos 100 revisões de PR por dia por instalação, segundo a página oficial de cotas — fonte 5).
   - _Atenção ao Fallback_: Caso se utilize a Gemini API direta como fallback quando a cota acabar, se estiver em Free Tier os dados de diff estarão sujeitos a treinamento (ver R3).
2. **Modalidade Enterprise (Google Cloud)**:
   - Vinculada a um projeto GCP com Cloud AI Companion API habilitada, faturamento empresarial e SLA dedicado.

### 2.2 Estrutura de Arquivos em `.gemini/`

O comportamento do revisor é governado por dois arquivos na raiz:

```text
.gemini/
├── config.yaml       # Configuração comportamental e limites técnicos
└── styleguide.md     # Instruções de domínio, severidade e checklist
```

#### A. Especificação Oficial de `.gemini/config.yaml`

_(Schema canônico conforme documentação oficial do Google Cloud Code Assist)_:

```yaml
# Schema oficial do Gemini Code Assist para GitHub
have_fun: false
memory_config:
  disabled: false

code_review:
  disable: false
  comment_severity_threshold: LOW # Opções: LOW, MEDIUM, HIGH, CRITICAL
  max_review_comments: -1 # Padrão oficial ilimitado (-1), alinhado a specs/002-revisor-pr/research.md (R-01)
  pull_request_opened:
    help: false
    summary: true
    code_review: true
    include_drafts: false

ignore_patterns:
  # Specs NUNCA devem ser ignoradas (devem ser revisadas pelo checklist)
  - "tests/fixtures/**" # Ignora saídas estáticas geradas
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

| Capacidade                              | Suportado?       | Detalhes                                                                                                         |
| --------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Resumo do PR**                        | Sim              | Gera resumo em linguagem natural destacando as principais mudanças.                                              |
| **Comentários Inline**                  | Sim              | Anota diretamente a linha de código com o problema e sugestão de correção (_diff replacement_).                  |
| **Classificação de Severidade**         | Sim              | Marca comentários como `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL`.                                                    |
| **Aprovação Formal de PR (`APPROVE`)**  | **Não (Nativo)** | O bot posta comentários (`COMMENT`), mas não submete o evento de revisão nativo do GitHub como aprovação humana. |
| **Rejeição Formal (`REQUEST_CHANGES`)** | **Não (Nativo)** | Aponta problemas como threads de conversa, sem mudar o status da branch protection nativa de aprovações.         |

### 2.4 Implementação do Gate e Branch Protection (Normativo na Feature 002)

Como o bot não emite um `APPROVE` formal reconhecido pela regra de aprovação humana do GitHub, a Feature 002 desenha a arquitetura canônica (ver `specs/002-revisor-pr/research.md`):

#### Camada 1: Validação do Veredito via GitHub Actions

- O script conceitual de checagem do veredito deve validar com rigor:
  - Comparação estrita do `commit_id == head.sha` para evitar aprovações defasadas.
  - Paginação completa de comentários e reviews via GitHub REST API.
  - Verificação de autenticidade do bot oficial (`gemini-code-assist[bot]`).
- _Atenção_: A implementação oficial e segura deste portão pertence à Feature 002 (`R-04`, `R-09` e `R-12`), que deve ser consultada como fonte normativa.

#### Camada 2: Regras de Branch Protection no GitHub

No repositório (Settings $\rightarrow$ Branches $\rightarrow$ Branch protection rule para `main`):

1. **Require status checks to pass before merging**:
   - Status checks obrigatórios do CI (`quality`, `unit`, `integration`, `e2e`).
   - Status check do revisor implementado pela 002.
2. **Require conversation resolution before merging**:
   - Ativo: todo apontamento de revisão feito pelo Gemini Code Assist deve ser explicitamente resolvido/respondido antes da liberação do merge.
3. **Required Approvals**:
   - Configurar `required_approving_review_count: 0` (conforme `specs/002-revisor-pr/data-model.md §7`). Motivo: Como os commits e PRs dos agentes são executados sob a conta do Doug, exigir 1 aprovação nativa de terceiros travaria os merges por impossibilidade de auto-aprovação na plataforma.

---

## 3. Limitações e Riscos

1. **Arquivos Ignorados Nativamente**:
   - O Gemini Code Assist **não analisa nem comenta arquivos localizados em `.github/workflows/`** (conforme documentado oficialmente em `https://cloud.google.com/gemini/docs/code-review/review-repo-code`). Mudanças de CI/CD dependem exclusivamente da revisão de checklist manual/contexto limpo do Claude.
2. **Falso Positivo / Alucinação em Código Complexo**:
   - Modelos de IA podem sugerir mudanças desnecessárias. A Constitution VIII garante que o autor pode justificar tecnicamente suas decisões caso o apontamento não proceda.
3. **Latência de Revisão**:
   - O bot leva entre 30 segundos a 2 minutos para processar diffs grandes após o push.

---

## 4. Recomendações Técnicas para a Feature 002

1. **Priorizar a Pesquisa Canônica da Feature 002**:
   - Utilizar diretamente `specs/002-revisor-pr/research.md` como guia de implementação para as tarefas de automação, webhook e proteção de branch.
2. **Configuração de `.gemini/config.yaml`**:
   - Remeter à Feature 002 R-01 (`specs/002-revisor-pr/research.md`), adotando o padrão oficial `max_review_comments: -1` e assegurando que specs e arquivos de regras não sejam excluídos da análise.

---

## 5. Fontes Consultadas

1. **Google Cloud — Gemini Code Assist for GitHub Overview & Review Details**:  
   [https://cloud.google.com/gemini/docs/code-review/review-repo-code](https://cloud.google.com/gemini/docs/code-review/review-repo-code) — Acessado em 05/10/2026.
2. **Google Cloud — Customize Code Review for GitHub (Severity Thresholds & Ignore Patterns)**:  
   [https://docs.cloud.google.com/gemini/docs/code-review/customize-repo-review](https://docs.cloud.google.com/gemini/docs/code-review/customize-repo-review) — Acessado em 05/10/2026.
3. **GitHub Documentation — About Protected Branches & Status Checks**:  
   [https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — Acessado em 05/10/2026.
4. **GitHub Documentation — Actions: github-script for Pull Request Workflows**:  
   [https://github.com/actions/github-script](https://github.com/actions/github-script) — Acessado em 05/10/2026.
5. **Google Cloud — Gemini Code Assist Quotas**:  
   [https://docs.cloud.google.com/gemini/docs/quotas](https://docs.cloud.google.com/gemini/docs/quotas) — Acessado em 06/10/2026.
