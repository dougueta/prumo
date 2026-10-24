<!--
Sync Impact Report
- Version change: 1.2.0 → 2.0.0 (MAJOR: redefinição do Princípio VIII)
- Modified principles: VIII. Revisão Independente Obrigatória — o revisor dos PRs do Claude
  deixa de ser o Gemini Code Assist (versão consumer encerrada pelo Google em 2026-07-17; a
  enterprise exige Google Cloud com faturamento) e passa a ser um subagente Claude em contexto
  limpo, com o mesmo pacote de revisão dos PRs do Gemini; o veredito MUST ficar registrado no
  PR. "Revisão cruzada" (outro modelo) vira "revisão independente" (outro contexto).
  Fluxo/Papéis: Gemini deixa de ser revisor.
- Added/Removed sections: nenhuma
- Origem: decisão do Doug em 2026-10-24 (PR #11 sem revisor disponível) — ADR 0007
- Templates: ✅ plan/spec/tasks templates (sem mudança estrutural) · ✅ GEMINI.md, CLAUDE.md,
  docs/workflow.md, docs/review-checklist.md, docs/adr/0001 (superada em parte pela 0007),
  docs/roadmap.md, docs/pendencias-doug.md · ✅ removido .gemini/styleguide.md
- Follow-up: ⚠ specs/002-revisor-pr (PR #10) foi desenhada em torno do Gemini Code Assist e
  MUST voltar para spec/plan (Princípio I) antes de seguir · ⚠ PR #9 (004) foi integrado sem
  veredito: revisão pós-merge pelo protocolo novo
- Deferred TODOs: nenhum
- Histórico: 1.0.0 → 1.1.0 (VII + modo demonstração; Restrições: ambientes e custo — ADR 0006,
  2026-10-02) · 1.1.0 → 1.2.0 (VIII: exceção de emergência e insumo dos revisores, 2026-10-05)
-->

# Prumo Constitution

**Prumo** — app pessoal de finanças (inspirado no GuiaBolso) construído exclusivamente por Spec-Driven
Development com GitHub Spec Kit, por dois agentes de IA (Claude e Gemini) sob aprovação do
product owner (Doug).

## Core Principles

### I. Spec-First, Sem Exceção (NON-NEGOTIABLE)

- Nenhum código, migração, configuração de infraestrutura, dependência ou arquivo de produto
  pode ser criado fora de uma feature do Spec Kit (`specs/NNN-nome/`).
- Fluxo obrigatório por feature: `specify → clarify → plan → tasks → (analyze) → implement`.
- Cada feature tem número fixo definido em `docs/roadmap.md`, uma branch `NNN-nome` e um PR.
- Mudança de escopo durante a implementação MUST voltar para a spec (atualizar + reaprovar)
  antes de virar código.
- Exceções permitidas sem spec: correções de documentação de processo (`docs/`, arquivos de
  agentes) via PR comum, e a própria constitution via emenda (ver Governança).

**Rationale**: rastreabilidade total e zero alucinação; o repositório é a fonte da verdade
para dois agentes diferentes.

### II. Privacidade e Segurança dos Dados Financeiros (NON-NEGOTIABLE)

- O app é single-user (allowlist de 1 e-mail). Toda tabela no Supabase MUST ter RLS
  habilitado com policy explícita; nenhuma tabela pública.
- Segredos (Pluggy, Gemini API, service role do Supabase, conta de serviço Google) MUST
  existir apenas em variáveis de ambiente do servidor (Vercel/Supabase). Nunca no client,
  nunca no repositório, nunca em logs.
- Dados financeiros reais MUST NOT aparecer em fixtures, testes, seeds, screenshots,
  prompts de exemplo, issues ou PRs. Usar exclusivamente o gerador de dados sintéticos.
- Dados enviados a LLMs (Gemini/Claude) MUST ser minimizados ao necessário para a tarefa
  (ex.: descrição + valor + data para categorizar; nunca número de conta/CPF).
- Usuário MUST conseguir exportar todos os seus dados (spec de export/backup).

**Rationale**: é a vida financeira de uma pessoa real; vazamento é irreversível.

### III. Dinheiro é Exato

- Valores monetários MUST ser armazenados e calculados como inteiros em centavos
  (`BIGINT amount_cents`), com sinal (negativo = saída). Proibido `float`/`double`/`real`
  para dinheiro em qualquer camada.
- Moeda padrão BRL; campo de moeda explícito onde houver investimentos.
- Datas de transação são `DATE` no fuso `America/Sao_Paulo`; timestamps técnicos em UTC
  (`TIMESTAMPTZ`).
- Formatação monetária só na camada de apresentação (`pt-BR`).

**Rationale**: um centavo errado destrói a confiança no app inteiro.

### IV. Fonte da Verdade Rastreável e Deduplicada

- Toda transação MUST registrar `source` (`pluggy` | `csv` | `ofx` | `pdf` | `sheets` |
  `manual`), `external_id` quando existir, e o lote/importação de origem.
- Importações MUST ser idempotentes: reimportar o mesmo arquivo ou ressincronizar não cria
  duplicatas (constraint de unicidade + algoritmo de dedup especificado).
- Transferências entre contas próprias e pagamentos de fatura MUST ser identificáveis para
  não inflar entradas/saídas.
- Nenhum dado é apagado silenciosamente: remoções e merges ficam auditáveis.

**Rationale**: múltiplas fontes (Open Finance + arquivos + planilha) só funcionam com
rastreabilidade e dedup rigorosos.

### V. Test-First (NON-NEGOTIABLE)

- Testes MUST ser escritos e falhar antes da implementação (Red → Green → Refactor).
- Toda regra de negócio tem teste unitário; todo contrato (API route, Edge Function,
  integração externa) tem teste de contrato/integração; fluxos críticos (login, conexão,
  importação, extrato, dashboard) têm E2E Playwright.
- Integrações externas (Pluggy, Gemini, Google Sheets) são testadas com mocks de contrato
  e, quando disponível, sandbox. Nunca contra produção em CI.
- CI MUST passar (lint, typecheck, unit, integração, E2E) para qualquer merge.

**Rationale**: dois agentes alterando o mesmo código precisam de uma rede de segurança
objetiva.

### VI. IA é Assistente, Não Autoridade

- Toda saída de IA no app (categorização, extração de PDF, alertas, chat, diagnóstico)
  MUST exibir origem e confiança, ser corrigível pelo usuário e nunca sobrescrever uma
  decisão manual.
- Correções do usuário viram regras determinísticas que têm precedência sobre a IA.
- Falha ou indisponibilidade da IA MUST degradar com elegância (transação fica
  "sem categoria", importação vai para revisão manual) — nunca bloquear o fluxo.
- Alertas e insights MUST explicar por que dispararam.

**Rationale**: confiança vem de controle e explicabilidade.

### VII. Contratos Compartilhados e Donos de Dados

- O modelo de dados core (contas, transações, categorias, origens) é definido por uma spec
  própria e é o contrato único que todos os conectores usam.
- Cada tabela tem uma feature dona (registrada no `data-model.md` da spec dona). Outras
  features MUST NOT alterar o schema de uma tabela que não possuem; a mudança é proposta
  na spec da dona.
- Migrações usam timestamp (Supabase CLI) e são sempre aditivas/reversíveis quando possível.
- Todo acesso a dados passa por repositórios com duas implementações: Supabase e memória.
  Toda feature com dados MUST funcionar no **modo demonstração** (pré-visualizações sem
  banco, dados sintéticos, selo "Demonstração — dados fictícios") — ver ADR 0006.

**Rationale**: é o que torna seguro o desenvolvimento paralelo por agentes diferentes.

### VIII. Revisão Independente Obrigatória (NON-NEGOTIABLE)

- Todo PR é revisado por um revisor que NÃO o escreveu e não tem o contexto da implementação:
  - PR do Gemini → revisor Claude em contexto limpo.
  - PR do Claude → revisor Claude em contexto limpo: um subagente novo, nunca a sessão que
    implementou nem um subagente que herde o histórico dela.
- Insumo do revisor: apenas o pacote de revisão — diff, artefatos da spec (`spec.md`,
  `plan.md`, `tasks.md`, `data-model.md`, `contracts/`), constitution, ADRs e
  `docs/review-checklist.md`. Justificativas do autor valem só como respostas formais aos
  achados, depois do veredito.
- O revisor aplica o checklist fixo de `docs/review-checklist.md` e emite veredito formal:
  **APROVADO** ou **MUDANÇAS NECESSÁRIAS**, com achados por severidade
  (CRÍTICO / ALTO / MÉDIO / BAIXO). Veredito e achados MUST ficar registrados no PR, num
  comentário que identifica o commit revisado.
- O autor responde a cada achado com correção ou justificativa técnica — nunca concordância
  performática.
- Merge na `main` exige: CI verde + veredito APROVADO do revisor + aprovação do Doug.
- **Exceção única — correção urgente de produção**: indisponibilidade do revisor não tem
  bypass, salvo um PR com rótulo `emergencia`, que o Doug (e somente ele) pode integrar com CI
  verde e **sem** veredito, desde que:
  - o PR registre o motivo da urgência;
  - a revisão independente, pelas mesmas regras acima, seja feita após o merge em até
    **7 dias**, e cada achado CRÍTICO ou ALTO vire correção imediata;
  - o processo sinalize de forma visível as emergências com revisão pós-merge pendente e as
    vencidas (prazo estourado), até que sejam revisadas.

  A exceção não vale para PR que altera esta constitution nem os mecanismos de revisão
  (portão, workflows de revisão, checklist).

**Rationale**: revisor sem os vícios do autor encontra o que o autor não vê. Contexto limpo e
checklist fixo afastam o viés de quem implementou; como o mesmo modelo ainda divide pontos
cegos, a aprovação do Doug no Gate 3 continua obrigatória. A exceção existe
porque um incidente em produção não pode esperar um revisor indisponível; ela adia a revisão,
nunca a dispensa.

### IX. Qualidade dos Artefatos (Padrão SDD-Architect)

Cada feature MUST entregar, distribuído nos artefatos do Spec Kit:
- `spec.md` (o quê/por quê, sem tecnologia): histórias priorizadas, requisitos `FR-NNN`,
  fluxos de erro, edge cases (lista vazia, timeout, duplicado, offline), regras de acesso,
  critérios de sucesso mensuráveis e cabeçalho com **Iniciativa** e **Onda**.
- `data-model.md`: schemas com tipos de banco (`UUID`, `BIGINT`, `VARCHAR(n) NOT NULL`…),
  índices, constraints de unicidade, policies RLS e dono de cada tabela.
- `contracts/`: endpoints/funções no estilo OpenAPI — verbo, headers, payload, respostas de
  sucesso e erro.
- `plan.md`: máquinas de estado (com transições proibidas), algoritmos de cálculo passo a
  passo, padrões de projeto, libs permitidas/proibidas, estrutura de pastas.
- Critérios de aceite em Gherkin (Given-When-Then) incluindo verificações no banco.
- Rastreabilidade: cada `FR-NNN` citado em pelo menos uma task e um teste.

**Rationale**: specs que um agente consegue implementar sem adivinhar.

### X. Simplicidade (YAGNI)

- Só se constrói o que está na spec aprovada. Nada de abstração "para o futuro".
- Complexidade adicional MUST ser justificada na tabela "Complexity Tracking" do plano.
- Decisões que atravessam features são registradas como ADR em `docs/adr/`.

## Restrições Técnicas e Stack

- **Frontend/App**: Next.js (App Router) + TypeScript estrito, React Server Components por
  padrão, shadcn/ui + Tailwind, PWA instalável, mobile-first, tema claro/escuro, `pt-BR`.
- **Backend/Dados**: Supabase (Postgres, Auth, Storage, Edge Functions, Cron). Acesso a
  dados sempre pelo servidor ou com RLS; service role apenas no servidor.
- **Hospedagem**: Vercel (preview por PR, produção pela `main`). Variáveis por ambiente.
- **Open Finance**: Pluggy (sandbox em dev/preview, produção só em produção).
- **IA no app**: Gemini API (tier gratuito como padrão), atrás de uma interface própria
  (`AiProvider`) para permitir troca de provedor sem reescrever features.
- **Investimentos**: entrada manual + Google Sheets API (conta de serviço, somente leitura).
- **Testes**: Vitest (unit/integração), Playwright (E2E), mocks de contrato para externos.
- **Qualidade**: ESLint + Prettier + `tsc --noEmit` no CI; Conventional Commits.
- Dependência nova MUST ser listada e justificada no `plan.md` da feature que a introduz.
- **Ambientes** (ADR 0006): `local` (Supabase via Docker), `CI` (Supabase efêmero no job),
  `preview` (modo demonstração, sem banco), `production` (único projeto Supabase hospedado).
- **Custo**: teto padrão R$ 0/mês. Qualquer custo recorrente (serviço, API, plano) MUST ser
  declarado na spec da feature que o introduz, com valor estimado, e aprovado pelo Doug.

## Fluxo de Desenvolvimento, Paralelismo e Revisão

- Fluxo detalhado, gates e papéis: `docs/workflow.md`. Mapa de features e ondas:
  `docs/roadmap.md`. Checklist do revisor: `docs/review-checklist.md`.
- **Gates do Doug**: (1) aprova `spec.md` após clarify; (2) aprova `plan.md` + `tasks.md`;
  (3) aprova o PR após CI verde e revisor APROVADO.
- **Paralelismo**: features da mesma onda sem dependência entre si podem rodar em paralelo,
  cada uma em seu git worktree. Limite de WIP: no máximo 3 features em implementação.
  Specs podem ser escritas à frente, em lote.
- **Números fixos**: a branch/pasta de cada feature usa o número do roadmap
  (`--number N --short-name <slug>`), nunca a numeração automática.
- **Antes do merge**: rebase na `main` atualizada e CI verde novamente.
- **Papéis**: Claude = arquiteto e dev principal (núcleo, dados, segurança) e analista
  financeiro, e revisor em contexto limpo de todos os PRs; Gemini = dev de features delimitadas (marcadas no roadmap), operador do
  ecossistema Google, motor de IA do app e pesquisador; Doug = product owner e aprovador.

## Governança

- Esta constitution prevalece sobre qualquer outra prática, preferência de agente ou skill.
- Emendas: PR dedicado alterando este arquivo, com Sync Impact Report atualizado,
  versionamento semântico (MAJOR = remoção/redefinição de princípio; MINOR = princípio ou
  seção nova; PATCH = redação) e aprovação do Doug.
- Todo `plan.md` executa o Constitution Check contra os princípios I–X antes da pesquisa e
  novamente após o design; violações só com justificativa em Complexity Tracking.
- Todo revisor de PR verifica conformidade com esta constitution.
- Orientação operacional para agentes: `AGENTS.md` (comum), `CLAUDE.md`, `GEMINI.md`.

**Version**: 2.0.0 | **Ratified**: 2026-10-02 | **Last Amended**: 2026-10-24
