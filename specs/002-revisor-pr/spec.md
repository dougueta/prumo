# Feature Specification: Revisor de PR Independente

**Feature Branch**: `002-revisor-pr`
**Created**: 2026-10-02
**Status**: Draft
**Iniciativa**: 0 · Plataforma
**Onda**: 1
**Agente**: Claude (revisor: Gemini)
**Dependências**: 001 · setup-projeto (CI com verificações automáticas)
**Input**: "Revisor de PR independente e sem os vícios do autor (Constitution VIII): PRs do
Claude revisados pelo Gemini, PRs do Gemini revisados por um Claude em contexto limpo, veredito
formal no formato do checklist, proteção da versão principal, template de PR e fim da exceção de
bootstrap."

## Contexto

O Prumo é escrito por dois agentes de IA. A Constitution VIII exige que todo PR seja revisado
por um agente que **não** o escreveu, com veredito formal (**APROVADO** / **MUDANÇAS
NECESSÁRIAS**) e achados por severidade, e que o merge na versão principal só aconteça com
verificações automáticas verdes + veredito APROVADO + aprovação do Doug. Hoje isso é só uma
regra escrita: nada impede tecnicamente um merge sem revisão, e até esta feature existir vale a
**exceção de bootstrap** (PRs de processo aprovados apenas pelo Doug).

Esta feature transforma a regra em mecanismo verificável. Os "usuários" são o **Doug**
(aprovador, único que faz merge), o **agente autor** de um PR (Claude ou Gemini) e o **agente
revisor** (o outro). Teto de custo: **R$ 0/mês** (constitution v1.1.0).

### Glossário

- **Rótulo de autor**: marcação do PR que declara o agente que o escreveu — `autor:claude`,
  `autor:gemini` (ou `autor:doug`, quando o próprio Doug escreve).
- **Revisor designado**: o agente que deve revisar o PR, derivado do rótulo de autor
  (`autor:claude` → Gemini; `autor:gemini` → Claude em contexto limpo; `autor:doug` → Gemini).
- **Veredito**: registro publicado no PR, no formato obrigatório de `docs/review-checklist.md`
  (cabeçalho `Veredito`, tabela de achados, tabela de cobertura de requisitos).
- **Veredito válido**: veredito do revisor designado, no formato obrigatório, publicado
  **depois** do último commit do PR.
- **Verificação de revisão**: verificação automática obrigatória da versão principal que só
  passa quando existe um veredito válido APROVADO e as demais regras desta spec são atendidas.
- **Pacote de revisão**: o conjunto fechado de insumos que o revisor pode ler — diff, `spec.md`,
  `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, constitution, ADRs e o checklist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Nada entra na versão principal sem revisão independente (Priority: P1)

O Doug quer a garantia de que nenhuma mudança chega à versão principal sem PR, sem verificações
automáticas verdes e sem um veredito APROVADO do revisor designado — e que só ele faz o merge.
A página do PR mostra claramente o que falta para o merge.

**Why this priority**: é o que torna a Constitution VIII efetiva; sem isso as demais histórias
são só recomendações. Também encerra a exceção de bootstrap.

**Independent Test**: com a proteção ativa, tentar (a) enviar commit direto para a versão
principal, (b) fazer merge de um PR com verificações vermelhas, (c) fazer merge de um PR verde
sem veredito, (d) fazer merge com veredito APROVADO anterior ao último commit — todas as
tentativas são bloqueadas; um PR verde com veredito válido APROVADO pode ser integrado pelo Doug
em modo "squash".

**Acceptance Scenarios**:

1. **Given** a proteção ativa, **When** qualquer agente ou o Doug tenta enviar commits
   diretamente para a versão principal, **Then** o envio é recusado.
2. **Given** um PR com verificações automáticas reprovadas, **When** alguém tenta o merge,
   **Then** o merge está indisponível e a página indica a verificação que falhou.
3. **Given** um PR com verificações verdes e sem veredito, **When** o Doug abre o PR,
   **Then** a verificação de revisão aparece como pendente com a mensagem "aguardando veredito
   de <revisor designado>" e o merge está indisponível.
4. **Given** um PR com veredito APROVADO e, depois dele, um novo commit, **When** o Doug abre o
   PR, **Then** a verificação de revisão volta a pendente ("veredito desatualizado — novo
   commit após a revisão") e o merge está indisponível.
5. **Given** um PR com verificações verdes, veredito válido APROVADO e branch atualizada com a
   versão principal, **When** o Doug escolhe integrar, **Then** a única forma disponível é
   "squash" e o merge é concluído.
6. **Given** um agente com acesso ao repositório, **When** tenta realizar o merge de qualquer PR,
   **Then** a operação é recusada (só o Doug integra).
7. **Given** esta feature integrada, **When** qualquer PR é aberto (inclusive de documentação de
   processo), **Then** ele passa pelas mesmas regras — a exceção de bootstrap deixa de existir.

---

### User Story 2 — Gemini revisa os PRs do Claude (Priority: P1)

Quando o Claude abre um PR com rótulo `autor:claude`, o Gemini, como revisor independente,
lê o pacote de revisão, aplica integralmente `docs/review-checklist.md` e publica no PR o
veredito no formato obrigatório, em português, com achados por severidade.

**Why this priority**: o Claude implementa a maior parte do roadmap (inclusive as próximas
features da onda 1); sem esse revisor quase nenhum PR consegue ser integrado.

**Independent Test**: abrir um PR `autor:claude` de teste contendo um defeito proposital de
severidade CRÍTICO (ex.: valor monetário em ponto flutuante num arquivo de exemplo) e verificar
que o veredito publicado é MUDANÇAS NECESSÁRIAS, aponta arquivo:linha e princípio III; corrigir,
pedir nova revisão e verificar que o novo veredito é APROVADO.

**Acceptance Scenarios**:

1. **Given** um PR `autor:claude` aberto, **When** o revisor conclui, **Then** o PR contém um
   veredito com cabeçalho `Veredito: APROVADO` ou `Veredito: MUDANÇAS NECESSÁRIAS`, tabela de
   achados (# · Severidade · Arquivo:linha · Princípio · Problema · Sugestão) e tabela de
   cobertura de requisitos (FR · Implementado em · Testado em · OK?).
2. **Given** um veredito com ao menos um achado CRÍTICO ou ALTO, **When** a verificação de
   revisão avalia o PR, **Then** ela falha, mesmo que o cabeçalho diga APROVADO (veredito
   incoerente).
3. **Given** um PR `autor:claude` com novos commits após um veredito, **When** o autor solicita
   nova revisão, **Then** o revisor publica um novo veredito referente ao estado atual do PR.
4. **Given** o revisor configurado no repositório, **When** revisa, **Then** usa as instruções
   versionadas no próprio repositório (styleguide → checklist), em português, com nível mínimo
   de severidade que inclua achados BAIXO.

---

### User Story 3 — Claude em contexto limpo revisa os PRs do Gemini (Priority: P2)

Quando o Gemini abre um PR com rótulo `autor:gemini`, um revisor Claude **sem histórico** da
implementação recebe apenas o pacote de revisão, aplica o checklist e publica o veredito no PR.
A revisão é disparada localmente (na máquina do Doug), sem serviço pago.

**Why this priority**: necessária para as features do Gemini (a primeira é a 010, onda 3); pode
vir logo após as histórias P1 sem bloquear a onda 1.

**Independent Test**: abrir um PR `autor:gemini` de teste com um requisito da spec não coberto
por teste; disparar a revisão pelo comando documentado; verificar que o veredito é publicado no
PR, aponta o FR descoberto como achado (ALTO ou MÉDIO), lista os insumos lidos e que nenhum
insumo fora do pacote de revisão foi usado.

**Acceptance Scenarios**:

1. **Given** um PR `autor:gemini` aberto, **When** o Doug (ou uma sessão do Claude a pedido
   dele) executa o comando documentado de revisão informando o número do PR, **Then** um revisor
   Claude novo, sem histórico, produz o veredito e o publica no PR.
2. **Given** o revisor em contexto limpo, **When** monta sua revisão, **Then** lê somente o
   pacote de revisão — não lê conversas do PR, comentários do autor nem histórico de sessões — e
   o veredito inclui uma seção "Insumos lidos" listando exatamente esses itens.
3. **Given** o comando de revisão executado para um PR com rótulo `autor:claude`, **When** ele
   inicia, **Then** recusa a revisão com a mensagem "revisor e autor são o mesmo agente".
4. **Given** a execução da revisão, **When** concluída, **Then** nenhum custo recorrente novo foi
   gerado (usa apenas o que o Doug já possui).

---

### User Story 4 — Template de PR padroniza o que o revisor e o Doug recebem (Priority: P2)

Todo PR nasce de um modelo que pede: número/título da feature, links para `spec.md`, `plan.md`
e `tasks.md`, rótulo de autor, rótulo de iniciativa, tipo de PR (feature, processo, emenda da
constitution) e um checklist do autor (testes primeiro, CI verde local, sem segredo/dado real,
rebase na versão principal, FRs cobertos).

**Why this priority**: dá ao revisor e ao Doug o contexto mínimo para revisar sem adivinhar;
depende da proteção (US1) para ter efeito prático.

**Independent Test**: abrir um PR novo e verificar que o corpo vem pré-preenchido com todas as
seções; abrir um PR sem rótulo de autor e verificar que a verificação de revisão falha com
mensagem explicativa.

**Acceptance Scenarios**:

1. **Given** um PR novo, **When** criado, **Then** o corpo contém as seções do modelo: Feature
   (`NNN · Nome`), Artefatos (links spec/plan/tasks), Tipo, Rótulos, Checklist do autor e
   Respostas aos achados.
2. **Given** um PR sem rótulo de autor ou com mais de um rótulo de autor, **When** a
   verificação de revisão roda, **Then** falha com "rótulo de autor ausente ou ambíguo".
3. **Given** um PR de feature sem rótulo de iniciativa, **When** a verificação roda, **Then**
   falha com "rótulo de iniciativa ausente".

---

### User Story 5 — Ciclo achado → resposta → nova revisão (Priority: P3)

Diante de MUDANÇAS NECESSÁRIAS, o autor responde **cada** achado com correção (citando o commit)
ou justificativa técnica, e pede nova revisão. O revisor reavalia considerando as respostas e
emite novo veredito. Nada de concordância performática.

**Why this priority**: completa a Constitution VIII; sem isso o fluxo ainda funciona (o revisor
reavalia o diff), mas perde-se rastreabilidade de por que um achado foi aceito ou contestado.

**Independent Test**: num PR com veredito de 3 achados, publicar respostas para apenas 2 e pedir
nova revisão; verificar que a verificação de revisão aponta "achado #3 sem resposta"; responder o
terceiro e verificar que o fluxo segue.

**Acceptance Scenarios**:

1. **Given** um veredito MUDANÇAS NECESSÁRIAS com N achados, **When** o autor publica sua
   resposta, **Then** ela contém uma linha por achado (# · Ação: corrigido/justificado ·
   Commit ou justificativa).
2. **Given** um veredito anterior MUDANÇAS NECESSÁRIAS com achados sem resposta, **When** um
   novo veredito APROVADO é publicado, **Then** a verificação de revisão continua falhando com
   "achados sem resposta: #…".
3. **Given** um achado respondido com justificativa, **When** o revisor reavalia, **Then** o
   novo veredito registra se a justificativa foi aceita ou se o achado permanece.

### Edge Cases

- **Revisor indisponível** (o Gemini não responde, cota esgotada, serviço fora; ou o Claude não
  pode ser executado): a verificação de revisão permanece pendente com "aguardando veredito de
  <revisor>" e o PR fica bloqueado; é possível re-solicitar a revisão.
  Tratamento além disso: [NEEDS CLARIFICATION: existe saída de emergência quando o revisor
  designado fica indisponível por muito tempo? — ver Q2].
- **PR sem spec**: PR que altera arquivos fora das áreas de processo (`docs/`, arquivos de
  agentes, `.specify/`, `.gemini/`, `.github/` de processo) e cuja branch não corresponde a uma
  pasta `specs/NNN-slug/` com `spec.md` → verificação falha com "PR sem spec (Constitution I)".
- **PR de processo** (só documentação de processo/arquivos de agentes): dispensado de spec
  (exceção da Constitution I), mas **não** de revisão independente.
- **PR que altera a constitution**: exige tipo "emenda" no PR, Sync Impact Report atualizado e
  versão alterada no próprio arquivo; sem isso a verificação falha. Continua exigindo veredito
  do revisor designado e merge pelo Doug.
- **PR com rótulo errado** (ex.: `autor:claude` em PR escrito pelo Gemini): os commits do PR
  carregam marcação de coautoria do agente; se a marcação contradiz o rótulo, a verificação
  falha com "rótulo de autor inconsistente com os commits".
- **Commits mistos** (dois agentes no mesmo PR): proibido pelo modelo "um worktree = um agente";
  verificação falha com "PR com mais de um agente autor".
- **Veredito ausente**: verificação pendente, merge indisponível (US1, cenário 3).
- **Veredito do agente errado / revisor igual ao autor**: veredito publicado por agente que não é
  o revisor designado é ignorado pela verificação, que adiciona aviso "veredito de <agente>
  desconsiderado: não é o revisor designado".
- **Veredito fora do formato** (sem cabeçalho ou sem tabelas): ignorado, com aviso "veredito
  fora do formato".
- **Veredito desatualizado**: novo commit após o último veredito invalida-o (US1, cenário 4).
- **Veredito incoerente** (APROVADO com achado CRÍTICO/ALTO): tratado como MUDANÇAS NECESSÁRIAS.
- **Vários vereditos**: vale o mais recente do revisor designado.
- **Rótulo de autor alterado após o veredito**: a verificação é reavaliada imediatamente; o
  veredito do revisor anterior deixa de valer se o revisor designado mudar.
- **PR escrito pelo Doug** (`autor:doug`): revisor designado = Gemini; regras idênticas.
- **PR desta própria feature (002)**: é o último PR sob a exceção de bootstrap — revisado pelo
  Gemini já configurado, mas aprovado e integrado pelo Doug antes de a proteção ser obrigatória.
- **PR de branch desatualizada**: merge indisponível até rebase na versão principal e
  verificações verdes de novo.
- **PR em rascunho**: não dispara revisão; a revisão começa quando marcado "pronto para revisão".

## Requirements *(mandatory)*

### Functional Requirements

**Proteção da versão principal**
- **FR-001**: A versão principal MUST aceitar mudanças somente via PR; envio direto de commits,
  reescrita de histórico e remoção da branch MUST ser recusados para todos, inclusive o Doug.
- **FR-002**: O merge MUST exigir: (a) todas as verificações automáticas da feature 001 verdes;
  (b) a verificação de revisão verde; (c) branch atualizada com a versão principal.
- **FR-003**: O único modo de merge permitido MUST ser "squash".
- **FR-004**: Somente o Doug MUST conseguir integrar PRs; os agentes MUST NOT ter permissão de
  merge. A aprovação do Doug (Gate 3) se materializa no ato do merge.
- **FR-005**: Nenhuma regra de proteção MUST ser contornável por permissões de administrador,
  salvo o previsto em FR-024.

**Verificação de revisão**
- **FR-006**: O sistema MUST ter uma verificação automática obrigatória ("revisão
  independente") reavaliada sempre que o PR receber commit, comentário, veredito, resposta ou
  mudança de rótulo.
- **FR-007**: A verificação MUST passar somente se: existe exatamente um rótulo de autor; o
  último veredito válido do revisor designado é APROVADO; ele é posterior ao último commit; não
  contém achado CRÍTICO ou ALTO; e todos os achados do veredito anterior MUDANÇAS NECESSÁRIAS
  têm resposta do autor (FR-019).
- **FR-008**: Quando não passar, a verificação MUST exibir um único motivo legível em português
  (ex.: "aguardando veredito de Gemini", "veredito desatualizado", "rótulo de autor ausente ou
  ambíguo", "PR sem spec", "achados sem resposta: #2, #5").
- **FR-009**: A verificação MUST identificar a autoria de um veredito de forma que um agente
  autor não consiga se passar pelo revisor designado.
  [NEEDS CLARIFICATION: sob qual identidade cada agente publica no GitHub? — ver Q1]
- **FR-010**: A verificação MUST desconsiderar vereditos do agente autor, de agentes que não são
  o revisor designado e fora do formato obrigatório, registrando aviso no PR.
- **FR-011**: A verificação MUST falhar quando a marcação de coautoria dos commits contradisser o
  rótulo de autor, ou quando houver commits de mais de um agente.
- **FR-012**: A verificação MUST falhar em PR que altere arquivos de produto sem a pasta de spec
  correspondente à branch (`specs/NNN-slug/spec.md`); PRs que só alterem documentação de processo
  ou arquivos de agentes ficam dispensados de spec, não de revisão.
- **FR-013**: PR que altere a constitution MUST ser do tipo "emenda" e conter alteração de versão
  e do Sync Impact Report no próprio arquivo; caso contrário a verificação falha.

**Revisor Gemini (PRs `autor:claude` e `autor:doug`)**
- **FR-014**: O repositório MUST conter a configuração do revisor Gemini e suas instruções
  versionadas, apontando para `.gemini/styleguide.md` → `docs/review-checklist.md`, idioma
  português e inclusão de achados de todas as severidades.
- **FR-015**: O revisor Gemini MUST revisar automaticamente ao PR ficar "pronto para revisão" e
  MUST poder ser re-solicitado pelo autor ou pelo Doug após novos commits.
- **FR-016**: O veredito do Gemini MUST seguir o formato obrigatório; se a ferramenta só produzir
  comentários livres, o processo MUST prever como o veredito formal é publicado (decidido no
  plano, com base na pesquisa R5).

**Revisor Claude em contexto limpo (PRs `autor:gemini`)**
- **FR-017**: O repositório MUST conter um comando documentado que, dado o número de um PR,
  monta o pacote de revisão, inicia um revisor Claude sem histórico, gera o veredito no formato
  obrigatório e o publica no PR — executado localmente, sem serviço pago.
- **FR-018**: O revisor Claude MUST ler somente o pacote de revisão e MUST listar no veredito a
  seção "Insumos lidos"; o comando MUST recusar PRs cujo rótulo não seja `autor:gemini`.

**Resposta do autor**
- **FR-019**: Após um veredito MUDANÇAS NECESSÁRIAS, o autor MUST publicar no PR uma resposta com
  uma linha por achado (#, corrigido/justificado, commit ou justificativa técnica) antes de pedir
  nova revisão.
- **FR-020**: O novo veredito MUST registrar, para cada achado anterior, se foi resolvido, se a
  justificativa foi aceita ou se permanece.

**Template e rótulos**
- **FR-021**: O repositório MUST conter o modelo de PR (`.github/pull_request_template.md`) com as
  seções: Feature (`NNN · Nome`), Artefatos (links para spec/plan/tasks), Tipo (feature ·
  processo · emenda), Rótulos, Checklist do autor (testes antes da implementação, verificações
  verdes, sem segredo/dado real, rebase na versão principal, todos os FRs cobertos) e Respostas
  aos achados.
- **FR-022**: O repositório MUST ter os rótulos `autor:claude`, `autor:gemini`, `autor:doug`, um
  rótulo por iniciativa do roadmap (0 a 10) e um marco (milestone) por iniciativa.

**Processo e transição**
- **FR-023**: Ao integrar esta feature, a exceção de bootstrap MUST ser encerrada e registrada
  na documentação de processo (`docs/workflow.md`, `AGENTS.md`, `GEMINI.md`), com a data de fim,
  e `docs/gemini-handoff.md` MUST passar a listar os PRs aguardando revisão do Gemini.
- **FR-024**: Indisponibilidade prolongada do revisor designado MUST ser tratada conforme
  [NEEDS CLARIFICATION: saída de emergência — ver Q2]; qualquer exceção usada MUST ficar
  registrada no PR com motivo.
- **FR-025**: Esta feature MUST custar R$ 0/mês: nenhuma assinatura, API paga ou serviço novo com
  cobrança recorrente.

### Key Entities

- **PR**: número, branch (`NNN-slug`), tipo (feature/processo/emenda), rótulo de autor, rótulo de
  iniciativa, commits (com marcação de coautoria), estado (rascunho/pronto/integrado).
- **Veredito**: PR, revisor (identidade), momento de publicação, resultado (APROVADO/MUDANÇAS
  NECESSÁRIAS), achados, cobertura de requisitos, insumos lidos.
- **Achado**: número, severidade (CRÍTICO/ALTO/MÉDIO/BAIXO), arquivo:linha, princípio, problema,
  sugestão, situação (aberto/resolvido/justificativa aceita).
- **Resposta do autor**: veredito de referência, uma linha por achado (ação + commit ou
  justificativa).
- **Verificação de revisão**: PR, último commit avaliado, resultado (passou/pendente/falhou),
  motivo, avisos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos PRs integrados após esta feature têm veredito APROVADO do revisor
  designado (≠ autor), publicado depois do último commit — auditável pelo histórico dos PRs.
- **SC-002**: 0 commits na versão principal fora de merge "squash" de PR após a ativação da
  proteção.
- **SC-003**: Num roteiro de aceite com 8 cenários de bloqueio (push direto, verificação
  vermelha, sem veredito, veredito desatualizado, rótulo ausente, rótulo inconsistente, PR sem
  spec, revisor igual ao autor), o merge é bloqueado em 8 de 8.
- **SC-004**: Em ≥ 90% dos PRs `autor:claude`, o veredito do Gemini aparece em até 15 minutos
  após o PR ficar pronto ou a revisão ser re-solicitada.
- **SC-005**: O veredito do revisor Claude é publicado em até 30 minutos após o comando ser
  executado, com 100% dos insumos listados pertencendo ao pacote de revisão.
- **SC-006**: O Doug identifica, em até 1 minuto olhando a página do PR, se ele pode ser integrado
  e, se não, o motivo único.
- **SC-007**: 100% dos achados de vereditos MUDANÇAS NECESSÁRIAS têm resposta do autor antes do
  veredito seguinte.
- **SC-008**: Custo recorrente adicional = R$ 0/mês.

## Assumptions

- O Gemini Code Assist (app do GitHub, gratuito para pessoas físicas) é o revisor dos PRs do
  Claude, configurado por `.gemini/config.yaml` + `.gemini/styleguide.md`. **Dependência**: a
  pesquisa R5 (`docs/research/gemini-code-assist.md`) confirmará se ele funciona em repositório
  privado, se pode aprovar/reprovar formalmente ou só comentar, e limites de uso. A spec **não**
  assume que o Gemini aprova formalmente: o veredito é lido do conteúdo publicado no PR. Se a R5
  mostrar que ele não produz o formato obrigatório de modo confiável, o plano define a
  alternativa gratuita (FR-016) sem mudar os requisitos.
- O revisor Claude roda no Claude Code do Doug (assinatura já existente, não é custo novo);
  nenhuma chamada de API paga é feita em CI.
- As verificações automáticas usam a cota gratuita da plataforma de CI do repositório (mesma da
  feature 001).
- Os agentes abrem PRs e fazem push usando credenciais do Doug ou credenciais próprias conforme
  Q1; em ambos os casos só o Doug tem permissão de merge.
- Como o GitHub não permite aprovar o próprio PR, a aprovação do Doug é o ato de merge (FR-004).
- A marcação de coautoria nos commits (`Co-Authored-By`) já é prática dos agentes e é
  estendida a todos os commits.
- "Áreas de processo" dispensadas de spec: `docs/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
  `README.md`, `.specify/`, `.gemini/`, `.claude/` e o modelo de PR; a lista exata fica no plano.
- A exceção de bootstrap (até a 002 existir, só o Doug aprova PRs de processo) vale até o merge
  desta feature, inclusive para o próprio PR da 002.
- Fora de escopo: revisão de segurança automatizada adicional (SAST), métricas de tempo de
  revisão em painel, revisão por humanos além do Doug, e atualização de status no
  `docs/roadmap.md` (feita pelo fluxo normal).
