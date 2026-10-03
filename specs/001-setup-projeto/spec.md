# Feature Specification: Setup do Projeto Prumo

**Feature Branch**: `001-setup-projeto`
**Created**: 2026-10-02
**Status**: Draft
**Iniciativa**: 0 · Plataforma
**Onda**: 0
**Agente**: Claude (revisor: Gemini)
**Dependências**: nenhuma
**Input**: "Setup do projeto: base do app, ambientes local/preview/produção, verificações
automáticas de qualidade, PWA base e gerador de dados sintéticos — fundação sobre a qual
todas as outras features serão construídas."

## Contexto

O Prumo é construído por dois agentes de IA (Claude e Gemini) sob aprovação do Doug. Antes de
qualquer funcionalidade de finanças, é preciso uma base onde: (a) qualquer agente consiga rodar
e testar o app com um comando, (b) nenhuma mudança quebrada chegue à versão principal, (c) o
Doug consiga ver cada mudança antes de aprovar, e (d) ninguém precise de dados financeiros reais
para desenvolver ou testar. Os "usuários" desta feature são o **Doug** (aprovador e usuário
final) e os **agentes desenvolvedores**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rodar o app localmente com um comando (Priority: P1)

Um agente (ou o Doug) clona o repositório numa máquina nova, segue um guia curto, executa um
único comando e vê a tela inicial do Prumo no navegador, conectada a um ambiente de dados local
isolado.

**Why this priority**: sem isso nenhuma outra feature pode ser desenvolvida ou testada.

**Independent Test**: em uma máquina limpa (Windows com Git Bash e Linux), seguir o guia de
início rápido e verificar que a tela inicial com o nome "Prumo" é exibida e que o app reporta
conexão saudável com seu ambiente de dados.

**Acceptance Scenarios**:

1. **Given** um clone novo do repositório e as ferramentas pré-requisito instaladas,
   **When** o desenvolvedor executa o comando de inicialização documentado,
   **Then** o app fica acessível localmente e exibe a tela inicial "Prumo" em até 5 minutos
   (excluindo downloads).
2. **Given** o app rodando localmente, **When** o desenvolvedor acessa a verificação de saúde,
   **Then** ela informa versão do app, ambiente (`local`) e status da conexão com os dados.
3. **Given** uma configuração obrigatória ausente, **When** o app inicia,
   **Then** ele falha imediatamente com mensagem que nomeia a configuração faltante e aponta o
   guia — sem expor valores de segredos.

---

### User Story 2 — Mudanças quebradas nunca chegam à versão principal (Priority: P1)

Toda proposta de mudança (PR) passa automaticamente por verificações de qualidade: padrão de
código, checagem de tipos, testes unitários/integração e testes ponta a ponta. Se qualquer
uma falhar, a mudança fica marcada como reprovada.

**Why this priority**: dois agentes alterando o mesmo código precisam de uma rede de segurança
objetiva (Constitution V).

**Independent Test**: abrir um PR de teste com um erro de tipo proposital e verificar que as
verificações falham; corrigir e verificar que passam.

**Acceptance Scenarios**:

1. **Given** um PR com código que viola o padrão ou os tipos, **When** as verificações rodam,
   **Then** o resultado é "falhou" indicando a etapa e o arquivo.
2. **Given** um PR com um teste que falha, **When** as verificações rodam,
   **Then** o resultado é "falhou" e o relatório do teste fica disponível para consulta.
3. **Given** um PR correto, **When** as verificações rodam, **Then** todas passam em até
   10 minutos.
4. **Given** as verificações em execução, **When** qualquer etapa tentaria acessar serviços
   externos reais (bancos, IA, planilhas), **Then** ela usa simulações — nenhuma chamada real
   é feita.

---

### User Story 3 — Doug vê cada mudança antes de aprovar (Priority: P2)

Cada PR gera automaticamente uma versão de pré-visualização acessível pelo Doug por um link.
Após o merge na versão principal, a versão de produção é atualizada automaticamente.

**Why this priority**: o Gate 3 (aprovação do PR) exige que o Doug possa ver o resultado.

**Independent Test**: abrir um PR que altera o texto da tela inicial, abrir o link de
pré-visualização e ver o texto novo; após o merge, ver o texto em produção.

**Acceptance Scenarios**:

1. **Given** um PR aberto, **When** o processo de publicação conclui, **Then** um link de
   pré-visualização aparece no PR.
2. **Given** um link de pré-visualização, **When** acessado, **Then** a versão exibe o ambiente
   `preview` e **nunca** está conectada aos dados de produção.
3. **Given** um merge na versão principal, **When** a publicação conclui, **Then** a produção
   exibe a nova versão e o ambiente `production`.
4. **Given** a versão de pré-visualização ou de produção, **When** acessada por qualquer pessoa
   que não seja o Doug, **Then** o acesso é bloqueado (proteção provisória até a feature 006
   Login existir).

---

### User Story 4 — Dados sintéticos realistas para desenvolver e testar (Priority: P2)

O desenvolvedor gera, com um comando, um conjunto de dados fictícios realistas e
reproduzível que imita a vida financeira de um usuário com o mesmo perfil do Doug (salário
dividido em duas contas, carteira digital, dois cartões, assinaturas, parcelamentos,
transferências entre contas próprias, pagamento de fatura), sem usar nenhum dado real.

**Why this priority**: Constitution II proíbe dados reais em testes; todas as features
seguintes dependem desse gerador para testes e demonstrações.

**Independent Test**: executar o gerador duas vezes com a mesma semente e comparar — os
resultados são idênticos; executar com outra semente — resultados diferentes e plausíveis.

**Acceptance Scenarios**:

1. **Given** uma semente fixa, **When** o gerador roda duas vezes, **Then** produz exatamente o
   mesmo conjunto de dados.
2. **Given** o conjunto gerado, **When** inspecionado, **Then** contém pelo menos 12 meses de
   movimentações cobrindo: 2 contas que recebem salário, 1 carteira digital, 2 cartões de
   crédito, ≥ 5 assinaturas recorrentes, ≥ 3 compras parceladas, transferências entre contas
   próprias, pagamentos de fatura, estornos e ao menos uma compra internacional.
3. **Given** qualquer registro gerado, **When** inspecionado, **Then** ele é claramente
   identificável como sintético e não contém nomes, documentos ou números de conta reais.
4. **Given** o conjunto gerado, **When** exportado, **Then** está disponível também nos
   formatos de arquivo que as features de importação usarão para teste (planilha CSV e OFX).

---

### User Story 5 — App instalável no celular (Priority: P3)

O Doug abre o Prumo no navegador do celular e consegue adicioná-lo à tela inicial; ao abrir
pelo ícone, o app ocupa a tela inteira com nome e ícone "Prumo". Sem internet, aparece uma
página amigável de "sem conexão".

**Why this priority**: base de experiência mobile-first (ADR 0002); pode vir depois das demais
sem bloquear o desenvolvimento.

**Independent Test**: em Android (Chrome) e iOS (Safari), instalar a partir da produção, abrir
pelo ícone e ativar modo avião.

**Acceptance Scenarios**:

1. **Given** a produção aberta no celular, **When** o Doug escolhe instalar/adicionar à tela
   inicial, **Then** o ícone "Prumo" aparece e abre o app sem barra do navegador.
2. **Given** o app instalado e sem internet, **When** aberto, **Then** exibe a página "sem
   conexão" em português, em vez de erro do navegador.

### Edge Cases

- Configuração obrigatória ausente ou inválida → falha imediata, mensagem clara, sem vazar valor.
- Pré-visualização tentando usar configuração de produção → bloqueado por design.
- Verificações rodando sem acesso à internet externa (serviços simulados) → devem passar.
- Desenvolvimento em Windows (máquina do Doug) e Linux (CI) → mesmos comandos funcionam.
- Dois PRs simultâneos (paralelismo) → cada um tem sua própria pré-visualização e verificações
  independentes.
- Gerador de dados executado contra produção → recusado.
- Ambiente de dados local indisponível ao iniciar → verificação de saúde reporta "degradado"
  em vez de travar.

## Requirements *(mandatory)*

### Functional Requirements

**Ambiente e execução**
- **FR-001**: O projeto MUST oferecer um guia de início rápido e um único comando que deixa o
  app rodando localmente com ambiente de dados local isolado.
- **FR-002**: O app MUST expor uma verificação de saúde que informe versão, ambiente
  (`local` | `preview` | `production`) e status da conexão com os dados, sem expor segredos.
- **FR-003**: O app MUST validar todas as configurações obrigatórias na inicialização e falhar
  com mensagem que nomeia a configuração ausente/inválida, sem exibir seu valor.
- **FR-004**: O repositório MUST conter um modelo de configuração com todas as variáveis
  necessárias, descritas, e sem valores reais.
- **FR-005**: Os comandos de desenvolvimento MUST funcionar em Windows (Git Bash) e Linux.

**Qualidade automatizada**
- **FR-006**: Toda proposta de mudança MUST disparar automaticamente: verificação de padrão de
  código, checagem de tipos, testes unitários/integração e testes ponta a ponta.
- **FR-007**: Qualquer falha nas verificações MUST marcar a proposta como reprovada, indicando
  etapa e local do problema, com relatórios de teste acessíveis.
- **FR-008**: As verificações MUST rodar sem acessar serviços externos reais; integrações
  externas são simuladas.
- **FR-009**: O projeto MUST incluir ao menos um teste de cada tipo (unitário, integração,
  ponta a ponta) cobrindo a tela inicial e a verificação de saúde, servindo de exemplo para as
  próximas features.

**Publicação**
- **FR-010**: Cada proposta de mudança MUST gerar uma pré-visualização acessível por link
  publicado na própria proposta.
- **FR-011**: Pré-visualizações MUST usar um ambiente de dados separado da produção.
  Ambiente de preview: [NEEDS CLARIFICATION: as pré-visualizações compartilham um único
  ambiente de dados de homologação, ou cada PR recebe um ambiente de dados próprio e
  descartável?]
- **FR-012**: Merge na versão principal MUST atualizar a produção automaticamente.
- **FR-013**: Pré-visualização e produção MUST ficar inacessíveis a qualquer pessoa além do Doug
  até que a feature 006 (Login) assuma essa proteção.

**Dados sintéticos**
- **FR-014**: O projeto MUST fornecer um gerador de dados sintéticos determinístico por semente,
  cobrindo o perfil descrito na User Story 4.
- **FR-015**: Todo dado sintético MUST ser identificável como tal e livre de dados pessoais reais.
- **FR-016**: O gerador MUST exportar também arquivos CSV e OFX de exemplo para testes de
  importação.
- **FR-017**: O gerador MUST recusar execução contra o ambiente de produção.
- **FR-018**: Valores monetários gerados MUST ser inteiros em centavos (Constitution III).

**App instalável**
- **FR-019**: O app MUST ser instalável na tela inicial com nome "Prumo", ícone próprio,
  abertura em tela cheia e tema claro/escuro seguindo o sistema.
- **FR-020**: Sem conexão, o app MUST exibir uma página "sem conexão" em português.
- **FR-021**: A interface MUST usar idioma `pt-BR` e fuso `America/Sao_Paulo` como padrão.

**Custos**
- **FR-022**: A infraestrutura desta feature MUST caber no limite de custo mensal definido:
  [NEEDS CLARIFICATION: qual o teto de custo mensal de infraestrutura aceitável para o Prumo?]

### Key Entities

- **Ambiente**: `local`, `preview` ou `production`; cada um com sua configuração e seu
  ambiente de dados isolado.
- **Configuração**: conjunto nomeado de variáveis obrigatórias/opcionais, com descrição e
  indicação de segredo.
- **Conjunto de dados sintéticos**: identificado por semente; contém instituições, contas,
  cartões e movimentações fictícias de 12+ meses.
- **Verificação de saúde**: versão, ambiente, status dos dados, data/hora.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um agente em máquina limpa vê a tela inicial local em ≤ 5 minutos seguindo apenas
  o guia (excluindo downloads).
- **SC-002**: 100% dos PRs passam pelas verificações automáticas; nenhum merge com verificação
  reprovada.
- **SC-003**: As verificações completas de um PR terminam em ≤ 10 minutos.
- **SC-004**: 100% dos PRs exibem link de pré-visualização em ≤ 5 minutos após o push.
- **SC-005**: 0 registros reais em qualquer artefato versionado (verificável por inspeção do
  gerador e das fixtures).
- **SC-006**: O gerador produz 12 meses de dados em ≤ 30 segundos e é 100% reprodutível por
  semente.
- **SC-007**: O app é instalável e abre em tela cheia em Android e iOS.

## Assumptions

- O Doug desenvolve no Windows com Git Bash; o CI roda em Linux.
- A stack definida na constitution (Next.js, Supabase, Vercel) será usada; detalhes ficam no plano.
- Domínio de produção: o subdomínio padrão gratuito da plataforma de hospedagem; domínio
  próprio fica fora de escopo.
- Proteção provisória de acesso (FR-013) usa o mecanismo nativo da plataforma de hospedagem;
  a autenticação real é da feature 006.
- Branch protection, template de PR e revisor independente são da feature 002 — fora deste escopo.
- Design system e shell de navegação são da feature 003; aqui só existe uma tela inicial mínima.
- Modelo de dados de finanças é da feature 004; o gerador desta feature produz dados em formato
  próprio e simples, que a 004 adapta (a 004 é dona das tabelas).
- Notificações push, sincronização offline de dados e cache de dados financeiros estão fora de
  escopo.
