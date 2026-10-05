# Feature Specification: Login

**Feature Branch**: `006-login`
**Created**: 2026-10-02
**Status**: Approved (Gate 1, 2026-10-02)
**Iniciativa**: 1 · Autenticação
**Onda**: 1
**Agente**: Claude (revisor: Gemini)
**Dependências**: 001 (setup-projeto); integração após 004 e 003 (ordem de merge da onda 1: 004 → 003 → 006 → 002)
**Input**: "Login single-user com allowlist, sessão segura, logout — acesso seguro ao Prumo,
que contém dados financeiros reais de uma pessoa, usado diariamente pelo Doug como app
instalado no celular."

## Contexto

O Prumo guarda a vida financeira real do Doug (Constitution II). Hoje, a feature 001 mantém o
app fechado com uma **proteção provisória** da plataforma de hospedagem (001 · FR-013). Esta
feature entrega a autenticação de verdade: só o Doug entra, a sessão é segura e durável o
suficiente para o uso diário no celular, e nenhum dado fica acessível sem sessão válida.

Há um único usuário (o **Doug**), mas existem três contextos de uso:
- **Celular** (uso diário, app instalado na tela inicial) — precisa ser rápido de abrir.
- **Computador** (uso eventual, navegador).
- **Pré-visualizações de PR** (modo demonstração, ADR 0006) — sem banco e sem dados reais; o
  Doug revisa mudanças ali.

Fora o Doug, os "usuários" desta feature são **intrusos**: qualquer pessoa que tente entrar,
descobrir se um e-mail tem acesso ou reaproveitar uma sessão.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Entrar no Prumo e manter tudo fechado para os outros (Priority: P1)

O Doug abre o Prumo, vê a tela de entrada, se identifica pelo método definido e chega à tela
inicial. Qualquer pessoa que não seja ele — ou que tente acessar qualquer página ou dado sem
estar autenticada — é barrada, sem nenhuma pista sobre quais e-mails têm acesso.

**Why this priority**: é o núcleo da feature e pré-requisito de todas as features com dados
(007, 009, 012, 025…). Sem isso, nada com dado real pode ir para produção.

**Independent Test**: em produção (ou ambiente local com banco), tentar abrir qualquer página
interna sem sessão (deve ir para a tela de entrada); entrar com o e-mail autorizado (deve
chegar à tela inicial); tentar entrar com um e-mail não autorizado (deve ver a mesma resposta
neutra que um e-mail autorizado veria antes de concluir, e nunca obter sessão).

**Acceptance Scenarios**:

1. **Given** nenhuma sessão ativa, **When** qualquer pessoa acessa uma página interna ou
   solicita qualquer dado do app, **Then** a página não é exibida, nenhum dado é retornado e a
   pessoa é levada à tela de entrada; ao entrar com sucesso, volta para a página que tentou
   abrir.
2. **Given** a tela de entrada, **When** o Doug se identifica com o e-mail da lista de
   autorizados e conclui a verificação, **Then** uma sessão é criada, ele chega à tela inicial
   e o evento "login com sucesso" é registrado (data/hora, dispositivo, método).
3. **Given** a tela de entrada, **When** alguém informa um e-mail fora da lista de autorizados,
   **Then** a tela exibe exatamente a mesma mensagem e o mesmo tempo de resposta que exibiria
   para um e-mail autorizado (ex.: "Se este e-mail tiver acesso, você receberá as instruções"),
   nenhuma mensagem é enviada a esse e-mail, nenhuma sessão é criada e o evento "tentativa
   recusada" é registrado.
4. **Given** um usuário que tente se identificar pelo Google com uma
   conta cujo e-mail não está na lista, **When** o provedor devolve a identidade, **Then** o
   acesso é recusado com a mesma mensagem neutra, nenhuma sessão é criada e o evento é
   registrado.
5. **Given** a verificação de entrada (código por e-mail) já usada ou expirada, **When** alguém
   tenta usá-la, **Then** o acesso é recusado com a mensagem "Este código expirou ou já foi
   usado — peça um novo" e o evento é registrado.
6. **Given** a tela de entrada, **When** o mesmo e-mail ou a mesma origem acumula 5 verificações
   de código falhas em 15 minutos, **Then** novas tentativas são bloqueadas por 15 minutos com mensagem
   neutra ("Muitas tentativas. Tente novamente mais tarde."), sem revelar se o e-mail existe,
   e o bloqueio é registrado.

---

### User Story 2 — Continuar logado no celular sem atrito, com segurança (Priority: P1)

O Doug usa o Prumo todo dia no celular. Depois de entrar uma vez num dispositivo, ele não
deveria precisar refazer o login inteiro a cada abertura — mas, se alguém pegar o celular
desbloqueado, os dados não devem ficar expostos indefinidamente.

**Why this priority**: o uso diário depende disso; uma sessão curta demais torna o app
inutilizável, uma longa demais sem bloqueio expõe os dados.

**Independent Test**: entrar no celular, fechar o app, reabrir dentro e fora do período de
inatividade e após o vencimento da sessão, verificando em cada caso o comportamento definido
em FR-010 a FR-013.

**Acceptance Scenarios**:

1. **Given** uma sessão válida no dispositivo, **When** o Doug reabre o app dentro do período
   de inatividade permitido, **Then** ele vai direto para o app, sem nova verificação.
2. **Given** uma sessão válida e o app sem uso além do período de inatividade, **When** o Doug
   reabre o app, **Then** ele vê a tela de desbloqueio por biometria/PIN do celular (FR-012) antes de qualquer
   dado ser exibido — desde que tenha cadastrado o desbloqueio **neste** dispositivo; senão, a
   entrada completa.
3. **Given** uma sessão em uso, **When** o Doug continua usando o app regularmente, **Then** a
   sessão é renovada automaticamente sem interrupção, respeitando o limite máximo absoluto
   definido em FR-010.
4. **Given** uma sessão que atingiu o vencimento, **When** o Doug abre o app, **Then** ele é
   levado à tela de entrada e, após entrar, volta para a página em que estava.

---

### User Story 3 — Sair e encerrar sessões em outros dispositivos (Priority: P2)

O Doug consegue sair do dispositivo atual e, numa tela de segurança, ver os dispositivos com
sessão ativa e encerrar todas as sessões de uma vez — por exemplo, depois de perder o celular.

**Why this priority**: essencial para o cenário de perda/roubo do celular, mas o app já é
utilizável e seguro sem ela no primeiro dia.

**Independent Test**: entrar em dois dispositivos; no dispositivo A, usar "sair de todos os
dispositivos"; verificar que o dispositivo B perde o acesso na próxima ação e que A também
precisa entrar novamente.

**Acceptance Scenarios**:

1. **Given** uma sessão ativa, **When** o Doug toca em "Sair", **Then** a sessão deste
   dispositivo é encerrada, nenhum dado continua visível (inclusive ao usar "voltar" do
   navegador), ele vê a tela de entrada e o evento "logout" é registrado.
2. **Given** sessões ativas em mais de um dispositivo, **When** o Doug usa "Sair de todos os
   dispositivos" e confirma, **Then** todas as sessões (inclusive a atual) são encerradas, em
   até 1 minuto nenhum outro dispositivo consegue obter dados, e o evento é registrado.
3. **Given** a tela de segurança, **When** o Doug a abre, **Then** vê a lista de sessões ativas
   com descrição do dispositivo/navegador, data de início e último uso, com a sessão atual
   identificada.

---

### User Story 4 — Consultar o histórico de acessos (Priority: P2)

O Doug consegue ver um histórico dos eventos de acesso — entradas, falhas, recusas, bloqueios,
saídas — para perceber qualquer tentativa estranha.

**Why this priority**: dá visibilidade de segurança; não bloqueia o uso básico.

**Independent Test**: gerar eventos de cada tipo (login, falha, e-mail recusado, bloqueio,
logout, sair de todos) e verificar que aparecem no histórico, em ordem, com os dados mínimos.

**Acceptance Scenarios**:

1. **Given** eventos de acesso registrados, **When** o Doug abre o histórico de acessos,
   **Then** vê os eventos dos últimos 90 dias, do mais recente para o mais antigo, com
   tipo, data/hora no fuso `America/Sao_Paulo`, método, descrição do dispositivo/navegador
   e localização aproximada da origem quando disponível.
2. **Given** uma tentativa com e-mail não autorizado, **When** registrada, **Then** o histórico
   mostra o evento sem armazenar o e-mail completo digitado (apenas forma mascarada, ex.:
   `fu***@g***.com`).
3. **Given** qualquer evento registrado, **When** inspecionado, **Then** não contém códigos,
   links de acesso, identificadores de sessão nem qualquer segredo.

---

### User Story 5 — Revisar pré-visualizações em modo demonstração sem fricção (Priority: P3)

Nas pré-visualizações de PR (modo demonstração, sem banco), o Doug entra direto como um
usuário fictício, com o selo "Demonstração — dados fictícios", e consegue ver e testar as
telas de login, sessão e segurança sem que isso crie qualquer caminho de entrada na produção.

**Why this priority**: necessário para o Gate 3 (Doug revisa na demo) desta e das próximas
features, mas não afeta a segurança da produção.

**Independent Test**: abrir um link de pré-visualização (após a proteção da plataforma) e
verificar entrada automática como usuário fictício com o selo; verificar que o mesmo
mecanismo é impossível de ativar em produção.

**Acceptance Scenarios**:

1. **Given** uma pré-visualização em modo demonstração, **When** o Doug a abre, **Then** entra
   automaticamente como o usuário fictício "Usuário Demonstração", com o selo
   "Demonstração — dados fictícios" visível em todas as telas.
2. **Given** o modo demonstração, **When** o Doug usa "Sair", **Then** vê a tela de entrada da
   demonstração, que permite simular os fluxos (e-mail autorizado, e-mail recusado, código
   expirado, bloqueio por tentativas) sem envio real de mensagens e sem provedores externos.
3. **Given** o ambiente `production`, **When** qualquer configuração, parâmetro de endereço ou
   cabeçalho tenta ativar o modo demonstração ou a entrada automática, **Then** isso é
   impossível — o ambiente de produção nunca oferece entrada automática nem usuário fictício.
4. **Given** o modo demonstração, **When** eventos de acesso e sessões são exibidos, **Then**
   são fictícios, ficam só na memória do servidor associada à sessão de demonstração (no máximo
   2 horas) e nunca são gravados em banco.

### Edge Cases

- **E-mail fora da lista de autorizados** → mesma resposta (texto e tempo) que um e-mail
  autorizado; nenhuma mensagem enviada; evento registrado com e-mail mascarado.
- **Diferença de maiúsculas/espaços no e-mail** → comparação ignora maiúsculas e espaços nas
  pontas (`Doug@Gmail.com ` = `doug@gmail.com`).
- **Código expirado** (mais de 10 minutos) → recusado; Doug pede um novo.
- **Código reutilizado** → recusado; pedir um novo invalida todos os anteriores.
- **E-mail com o código aberto em outro dispositivo** (ex.: e-mail lido no computador, pedido
  feito no celular) → o Doug digita o código no dispositivo onde pediu; a entrada vale só ali.
- **Biometria/PIN do celular falha ou indisponível no desbloqueio** → após 5 falhas seguidas, ou
  se o dispositivo não oferecer biometria/PIN, o app exige entrada completa (Google ou código).
- **Pedidos repetidos de código** → no máximo 1 a cada 60 segundos e 5 por hora por e-mail;
  além disso, a mesma mensagem neutra de "muitas tentativas".
- **Sessão expira no meio de uma ação** (ex.: salvando um lançamento) → a ação NÃO é executada
  parcialmente; o app informa "Sua sessão expirou — entre novamente; a última ação não foi
  salva" e, após entrar, retorna à mesma tela.
- **Sessão encerrada remotamente** ("sair de todos") enquanto o app está aberto em outro
  dispositivo → a próxima requisição de dados falha e o app vai para a tela de entrada,
  escondendo os dados já exibidos.
- **Offline** → sem rede não há entrada nova; o app instalado mostra a página "sem conexão" da
  001. Nenhum dado financeiro fica salvo no dispositivo para uso offline (fora de escopo, 001).
- **Troca de dispositivo** → entrar normalmente no novo; a sessão do antigo continua até
  vencer ou ser encerrada na tela de segurança.
- **Perda/roubo do celular** → o Doug entra por outro dispositivo e usa "Sair de todos os
  dispositivos"; o bloqueio por inatividade (FR-012) protege até lá.
- **Perda de acesso ao e-mail autorizado** → fora do app; a lista de autorizados é alterada
  apenas na configuração do servidor (ver Assumptions).
- **Provedor de e-mail/identidade fora do ar** → mensagem "Não foi possível concluir a entrada
  agora. Tente novamente em alguns minutos." e evento registrado; nunca libera acesso.
- **Relógio do dispositivo errado** → validade de sessão e códigos é decidida pelo servidor.
- **Cache do navegador/app instalado** → após sair ou sessão vencida, páginas com dados não
  podem ser reexibidas a partir de cache (botão "voltar", reabrir o app).

## Requirements *(mandatory)*

### Functional Requirements

**Entrada e lista de autorizados**
- **FR-001**: O sistema MUST permitir acesso somente a identidades cujo e-mail esteja na lista
  de autorizados (inicialmente 1 e-mail, o do Doug), comparando sem diferenciar maiúsculas e
  ignorando espaços nas pontas.
- **FR-002**: Para qualquer e-mail fora da lista, o sistema MUST responder com a mesma mensagem
  e tempo de resposta equivalente aos de um e-mail autorizado, MUST NOT enviar nenhuma
  mensagem a esse e-mail e MUST NOT criar sessão.
- **FR-003**: O sistema MUST oferecer como método principal o **login com Google** e, como
  reserva, um **código de 6 dígitos enviado por e-mail** (sem link mágico). O código por e-mail
  MUST funcionar inteiramente dentro do app instalado no celular (Android e iOS), digitado no
  próprio app. O login com Google MUST funcionar no navegador e no app instalado no Android e
  SHOULD funcionar no app instalado no iOS; se nesse contexto a entrada pelo Google não puder
  ser concluída dentro do app, a tela MUST oferecer o código por e-mail como caminho garantido
  (ver Clarifications, remediação pós-analyze).
- **FR-004**: Códigos de entrada por e-mail MUST valer por no máximo
  10 minutos, ser de uso único, e todo novo pedido MUST invalidar os anteriores.
- **FR-005**: O sistema MUST limitar tentativas: no máximo 5 verificações de código falhas em
  15 minutos por e-mail e por origem (bloqueio de 15 minutos; pedidos de código para e-mails
  não autorizados não contam como falha, para não diferenciar e-mails), e no máximo 1 pedido de código a cada 60 segundos e
  5 por hora por e-mail. Mensagens de bloqueio MUST ser neutras (não revelam se o e-mail é
  autorizado).
- **FR-006**: Após entrar, o sistema MUST levar o Doug à página que ele tentava abrir, desde que
  seja uma página interna do próprio app (nunca redirecionar para endereço externo).

**Proteção de rotas e dados**
- **FR-007**: Toda página interna e toda operação que leia ou grave dados MUST exigir sessão
  válida verificada no servidor. Sem sessão: páginas redirecionam para a entrada e operações de
  dados retornam "não autorizado" sem nenhum dado.
- **FR-008**: As únicas partes acessíveis sem sessão MUST ser: tela de entrada e seus passos,
  página "sem conexão", arquivos estáticos do app instalável e a verificação de saúde da 001
  (que já não expõe dados nem segredos).
- **FR-009**: Páginas com dados MUST NOT ser reexibidas a partir de cache do navegador/app após
  logout ou sessão vencida.

**Sessão**
- **FR-010**: A sessão MUST durar 30 dias, renovada automaticamente a cada uso, com limite
  máximo absoluto de 90 dias desde a entrada; após isso, entrada completa obrigatória.
- **FR-011**: Validade de sessão, códigos e bloqueios MUST ser decidida pelo servidor (não pelo
  relógio do dispositivo).
- **FR-012**: Ao reabrir (ou voltar para) o app após 15 minutos sem uso, o sistema MUST exigir
  desbloqueio com a biometria ou o PIN do próprio celular antes de exibir qualquer dado. O
  desbloqueio só aceita uma credencial cadastrada **neste mesmo dispositivo**. Após 5 falhas
  seguidas, ou se o dispositivo não oferecer esse recurso ou não tiver credencial cadastrada,
  MUST exigir entrada completa (FR-003). O desbloqueio não renova o limite máximo de 90 dias.
- **FR-013**: Se a sessão vencer ou for encerrada durante uma ação, o sistema MUST NOT executar
  a ação parcialmente, MUST avisar que ela não foi salva e, após nova entrada, MUST retornar à
  mesma tela.
- **FR-014**: O Doug MUST conseguir sair do dispositivo atual; a sessão é invalidada no
  servidor (não apenas apagada do dispositivo).
- **FR-015**: O Doug MUST conseguir encerrar todas as sessões ativas de uma vez, com
  confirmação; em até 1 minuto nenhuma sessão encerrada consegue obter dados.
- **FR-016**: O sistema MUST listar as sessões ativas (descrição do dispositivo/navegador,
  início, último uso, marcação da atual).

**Registro de eventos de acesso**
- **FR-017**: O sistema MUST registrar os eventos: login com sucesso, falha de verificação,
  e-mail recusado, código expirado ou reutilizado, bloqueio por tentativas, desbloqueio
  por inatividade, logout, sair de todos os dispositivos e sessão expirada.
- **FR-018**: Cada evento MUST conter tipo, data/hora (UTC armazenado; exibido em
  `America/Sao_Paulo`), método de entrada, descrição do dispositivo/navegador e origem
  aproximada; e-mails não autorizados MUST ser armazenados apenas mascarados.
- **FR-019**: Eventos MUST NOT conter códigos, links, identificadores de sessão, tokens ou
  qualquer segredo; o mesmo vale para logs técnicos do sistema.
- **FR-020**: O Doug MUST conseguir consultar os eventos dos últimos 90 dias numa tela de
  segurança, do mais recente para o mais antigo; eventos mais antigos que 90 dias MAY ser
  descartados automaticamente.
- **FR-021**: Os eventos de acesso MUST ser somente-leitura para o app (não editáveis nem
  apagáveis pela interface).

**Segredos e configuração**
- **FR-022**: A lista de autorizados e todos os segredos de autenticação MUST ficar apenas na
  configuração do servidor; nada disso MUST aparecer no código entregue ao navegador, no
  repositório ou em logs (Constitution II).
- **FR-023**: Os dados de sessão no dispositivo MUST ser inacessíveis a scripts da página e
  enviados apenas por conexão segura ao próprio app.

**Modo demonstração (ADR 0006)**
- **FR-024**: Em `preview`, o sistema MUST entrar automaticamente como o usuário fictício
  "Usuário Demonstração", exibindo o selo "Demonstração — dados fictícios" em todas as telas
  (inclusive a de entrada); sessões e eventos de acesso são fictícios e existem apenas na
  memória do servidor associada à sessão de demonstração (no máximo 2 horas), nunca em banco.
- **FR-025**: Em `preview`, a tela de entrada MUST permitir simular os fluxos (e-mail
  autorizado, recusado, código expirado, bloqueio) sem enviar mensagens reais e sem contatar
  provedores externos.
- **FR-026**: Em `production`, entrada automática, usuário fictício e simulações MUST ser
  impossíveis de ativar por qualquer configuração do lado do navegador, parâmetro de endereço
  ou cabeçalho; a decisão de ambiente é exclusivamente do servidor.
- **FR-027**: Pré-visualizações MUST continuar atrás da proteção da plataforma de hospedagem
  definida na 001 (FR-013); o modo demonstração não a substitui.

**Transição da proteção provisória**
- **FR-028**: Em `production`, esta feature MUST substituir a proteção provisória da 001
  (FR-013): após o deploy, o acesso à produção passa a depender exclusivamente do login desta
  feature, e a proteção provisória da produção é desativada na mesma entrega.
- **FR-029**: A interface de entrada, segurança e mensagens MUST estar em `pt-BR`, funcionar em
  tela de celular e no tema claro/escuro.

### Key Entities

- **Lista de autorizados**: conjunto de e-mails com permissão de entrada (inicialmente 1);
  vive na configuração do servidor, não editável pela interface.
- **Usuário**: a identidade do Doug no app (e o "Usuário Demonstração" em `preview`, com o
  identificador de dono demo definido pela 004); dono de todos os dados financeiros das outras
  features.
- **Sessão**: vínculo entre o usuário e um dispositivo — dispositivo/navegador, início, último
  uso, vencimento, estado (ativa, bloqueada, encerrada, vencida).
- **Dispositivo**: identificador aleatório do navegador/app instalado, usado para vincular a
  credencial de desbloqueio ao aparelho em que foi cadastrada.
- **Credencial de desbloqueio**: biometria/PIN cadastrados num dispositivo (só a parte pública
  fica no servidor).
- **Pedido de código por e-mail**: e-mail, criado em, expira em,
  usado em/invalidado.
- **Evento de acesso**: tipo, data/hora, método, dispositivo/navegador, origem aproximada,
  e-mail mascarado (quando não autorizado); somente-leitura.
- **Controle de tentativas**: contagem de falhas/pedidos por e-mail e por origem numa janela de
  tempo, com bloqueio até determinado horário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das páginas internas e operações de dados, testadas automaticamente sem
  sessão, retornam a tela de entrada ou "não autorizado" sem nenhum dado.
- **SC-002**: Respostas para e-mail autorizado e não autorizado são indistinguíveis em texto, e
  o tempo médio de resposta difere em menos de 100 ms em 50 tentativas de cada.
- **SC-003**: O Doug entra pela primeira vez num dispositivo novo em ≤ 60 segundos (incluindo
  a verificação).
- **SC-004**: Reabrir o app no celular com sessão válida e dentro do período de inatividade
  leva ≤ 2 segundos até a tela inicial, sem nenhuma etapa de verificação.
- **SC-005**: Após "sair de todos os dispositivos", 100% das sessões encerradas falham ao
  pedir dados em ≤ 1 minuto.
- **SC-006**: 100% dos tipos de evento de FR-017 aparecem no histórico do Doug, e 0 eventos ou
  logs contêm códigos, links, tokens ou e-mails não autorizados completos.
- **SC-007**: Após 5 falhas em 15 minutos, 100% das tentativas seguintes na janela são
  bloqueadas.
- **SC-008**: Em 100% das pré-visualizações o Doug entra sem digitar nada e vê o selo de
  demonstração; em produção, 0 formas de ativar entrada automática (verificado por testes).
- **SC-009**: Ao reabrir o app após 15 minutos sem uso, 100% das vezes nenhum dado é exibido
  antes do desbloqueio por biometria/PIN ou nova entrada.

## Clarifications

### Session 2026-10-02

- Q: Método de entrada? → A: Login com Google como principal + código de 6 dígitos por e-mail
  como reserva (sem link mágico, que no iOS abre fora do app instalado).
- Q: Duração da sessão e bloqueio por inatividade? → A: Sessão de 30 dias renovada com o uso,
  máximo absoluto de 90 dias; ao reabrir após 15 minutos parado, desbloqueio com biometria/PIN
  do celular.

### Remediação pós-analyze 2026-10-05

Ajustes de requisito decorrentes do `/speckit-analyze` (sem renumerar FRs):
- **FR-005 / US1-6** (achado H1): "falha" passa a significar **verificação de código falha**.
  Pedidos de código para e-mail fora da lista não contam como falha — contá-los criava um
  oráculo de enumeração (o contador por origem só crescia para e-mails não autorizados).
- **FR-012 / US2-2** (achado M3): o desbloqueio só aceita credencial cadastrada **no mesmo
  dispositivo**; um computador sem credencial própria exige entrada completa, mesmo que o
  celular tenha credencial (evita desbloquear o computador pelo celular via QR).
- **FR-003** (achado M14): o código por e-mail é o caminho **garantido** dentro do app
  instalado; o Google é MUST no navegador e no Android instalado e SHOULD no iOS instalado
  (limitação de cookies do app de tela inicial do iOS). Se falhar, a tela oferece o código.
- **FR-024 / US5-4** (decisão transversal da onda 1): a sessão de demonstração é a da 004
  (`prumo_demo_sid`, até 2 h); sessões e eventos fictícios vivem na memória do servidor ligada
  a ela, não "somem ao recarregar". O selo aparece também na tela de entrada.
- **US1-5** (achado L4): texto unificado "Este código expirou ou já foi usado — peça um novo".
- **Tela de segurança** (decisão D-B da onda 1): fica em `/mais/seguranca`, dentro do shell da
  003; a tela de desbloqueio fica fora do shell.

## Assumptions

- O Doug usa um e-mail pessoal do Google como e-mail autorizado; a lista começa com 1 e-mail
  (Constitution II). Alterar a lista (ex.: perda de acesso ao e-mail) é feito por ele direto
  na configuração do servidor, sem tela no app — evita um caminho de escalada de acesso.
- Não existe cadastro, convite, recuperação de senha nem múltiplos usuários; não há senha
  tradicional (métodos sem senha reduzem risco de vazamento e de força bruta).
- Envio do código por e-mail usa o serviço gratuito do provedor de autenticação, cujo limite
  baixo de envios por hora é suficiente para 1 usuário (teto de custo R$ 0, ADR 0006).
- O login com Google tem uso gratuito para este volume.
- Alerta por e-mail/push de "novo dispositivo" fica fora de escopo; o histórico de acessos
  cobre a visibilidade. Pode entrar via 024 (central de notificações).
- Os testes ponta a ponta de login com banco rodam no CI contra o ambiente efêmero (ADR 0006);
  provedores externos são simulados no CI (Constitution V).
- As tabelas de sessão, eventos de acesso e controle de tentativas (se próprias do app) são de
  propriedade desta feature (Constitution VII), com RLS e acesso restrito ao usuário/servidor.
- A tela de segurança (sessões + histórico) fica em "Mais → Segurança", dentro do shell da 003,
  que é integrada antes desta feature (ordem de merge da onda 1).
- Localização aproximada da origem é a informada pela plataforma de hospedagem, sem serviço
  pago de geolocalização.
