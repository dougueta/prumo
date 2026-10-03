# Feature Specification: Modelo de Dados Core

**Feature Branch**: `004-modelo-dados-core`
**Created**: 2026-10-02
**Status**: Approved (Gate 1, 2026-10-02)
**Iniciativa**: 0 · Plataforma
**Onda**: 1
**Agente**: Claude (revisor: Gemini)
**Dependências**: 001 (setup-projeto — base do app e gerador de dados sintéticos)
**Input**: "Modelo de dados core: o contrato único de dados de finanças (instituições, contas,
transações, categorias, lotes de importação e trilha de auditoria) que todos os conectores
(Open Finance, CSV, OFX, PDF, planilha, manual) e todas as telas usam, com idempotência,
proteção de edições manuais, exclusão lógica, isolamento por dono e modo demonstração."

## Contexto

O Prumo vai receber dados de seis origens diferentes (Open Finance, CSV, OFX, PDF de fatura,
planilha e digitação manual) e exibi-los em dezenas de telas construídas por dois agentes em
paralelo. Sem um contrato único, cada conector inventaria seu formato e o extrato, o dashboard,
o orçamento e os alertas mostrariam números diferentes para a mesma realidade.

Esta feature define **o que** é guardado e **quais regras** valem para esses dados — não telas.
Ela é a **dona** das entidades core (Constitution VII): nenhuma outra feature altera sua
estrutura; mudanças são propostas aqui. O schema tipado, índices e regras de acesso no nível
do banco ficam no `data-model.md` desta feature.

Os "usuários" desta feature são: o **Doug** (que cadastra e corrige contas, transações e
categorias manualmente) e as **features consumidoras** (conectores, telas, motores de análise),
que dependem de um contrato estável e previsível.

### Contas reais que o modelo precisa representar (contexto de produto)

| Instituição | Tipo de conta | Papel |
|---|---|---|
| Mercado Pago | Conta corrente / carteira digital | recebe parte do salário |
| Caixa | Conta corrente | recebe parte do salário |
| PicPay | Carteira digital | uso do dia a dia |
| C6 | Cartão de crédito | maior concentração de gastos hoje |
| Caixa | Cartão de crédito | novo centralizador de gastos |

### Necessidades antecipadas das features consumidoras

O modelo precisa atender, **sem implementar a lógica delas**, às seguintes necessidades:

| Feature | O que precisa do modelo core |
|---|---|
| 005 export-backup | Todas as entidades exportáveis, inclusive registros excluídos logicamente e auditoria |
| 007 conexao-open-finance | Instituição e conta com identificador externo; saldo e limite informados pela fonte |
| 008 sync-automatica | Gravação idempotente por origem + id externo; atualização de pendentes; lote por sincronização |
| 009 importacao-csv-ofx | Lote com impressão digital do arquivo; identidade determinística quando não há id externo |
| 010 importacao-pdf-fatura | Lote em estado "em revisão" antes de efetivar; parcela n/m; moeda original |
| 011 deduplicacao | Exclusão lógica com motivo "mesclada" e referência à transação sobrevivente; auditoria |
| 012 extrato-consolidado | Consulta por conta/período ordenada; edição manual com proteção de campos |
| 014 categorizacao-ia | Categoria com origem da atribuição (manual/regra/IA/fonte) e confiança |
| 015 regras-categorizacao | Distinguir categoria manual (precedência) de automática |
| 016 transferencias-internas | Natureza da transação (transferência interna, pagamento de fatura) e vínculo de contrapartida |
| 017 dashboard | Valor com sinal consistente; tipo de categoria (despesa/receita/neutra); saldo por conta |
| 018 faturas-cartao | Dias de fechamento e vencimento do cartão; limite |
| 019 parcelamentos | Parcela n/m e agrupamento das parcelas da mesma compra |
| 021–023 recorrências, padrões, alertas | Estabelecimento, horário (quando disponível), categorias de salário e tarifas |
| 025 carteira-investimentos | Tipo de conta "investimento" básico (detalhamento de ativos é da 025) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Contrato único e confiável de transações (Priority: P1)

Qualquer conector grava transações num formato único: valor exato em centavos com sinal,
data no fuso de São Paulo, descrição original preservada, origem, identificador externo e lote
de importação. Reimportar ou ressincronizar a mesma transação nunca cria duplicata.

**Why this priority**: é a fundação de todas as 28 features seguintes. Sem idempotência e
rastreabilidade, nenhum número exibido pelo app é confiável (Constitution III e IV).

**Independent Test**: com dados sintéticos, gravar um lote de transações de uma origem, gravar
o mesmo lote novamente e verificar que a contagem de transações não mudou, que o segundo lote
registra todas como "já existentes" e que cada transação aponta para seu lote de origem.

**Acceptance Scenarios**:

1. **Given** uma conta existente, **When** um conector grava uma transação de origem `ofx` com
   id externo "X1", valor -12.345 centavos e data 2026-09-30, **Then** a transação fica
   registrada com exatamente esses dados, descrição original preservada, status informado e
   vinculada ao lote de importação corrente.
2. **Given** a transação `ofx`/"X1" já registrada na conta, **When** o mesmo arquivo é
   reimportado, **Then** nenhuma nova transação é criada e o novo lote informa 1 ignorada por
   já existir.
3. **Given** uma transação de origem `csv` sem id externo, **When** o mesmo arquivo é
   reimportado, **Then** a identidade determinística (conta, data, valor, descrição original
   e ordem de ocorrência no arquivo) reconhece a transação e não a duplica.
4. **Given** dois lançamentos legítimos idênticos no mesmo dia (ex.: dois cafés de R$ 8,00 no
   mesmo estabelecimento) num mesmo arquivo CSV, **When** o arquivo é importado, **Then** ambos
   são registrados (a ordem de ocorrência os diferencia).
5. **Given** um valor informado com casas decimais fracionárias além do centavo, **When** o
   conector tenta gravar, **Then** a gravação é rejeitada com erro explícito — nunca há
   arredondamento silencioso.
6. **Given** uma transação ocorrida às 23h30 de 30/09 no horário de São Paulo e recebida com
   horário em UTC (02h30 de 01/10), **When** gravada, **Then** sua data é 30/09.

---

### User Story 2 — Edições manuais nunca são perdidas (Priority: P1)

O Doug corrige a descrição e a categoria de uma transação importada. Sincronizações futuras,
reimportações, regras automáticas e a IA nunca sobrescrevem essa correção.

**Why this priority**: Constitution VI — confiança vem de controle. Perder uma correção uma
única vez faz o usuário parar de corrigir.

**Independent Test**: importar uma transação, editar sua descrição e categoria manualmente,
reimportar a mesma transação com descrição e categoria diferentes vindas da fonte, e verificar
que a edição manual permanece e que a auditoria registra as duas ações.

**Acceptance Scenarios**:

1. **Given** uma transação importada com descrição "PAG*JOSEDASILVA", **When** o Doug edita a
   descrição para "Feira do sábado", **Then** a descrição editável muda, a descrição original
   permanece intacta e o campo passa a ser protegido contra sobrescrita automática.
2. **Given** uma transação com categoria definida manualmente, **When** a sincronização,
   uma regra automática ou a IA propõe outra categoria, **Then** a categoria manual permanece
   e a proposta não é aplicada.
3. **Given** uma transação com categoria atribuída pela IA (não manual), **When** a IA propõe
   nova categoria com origem e confiança, **Then** a atribuição pode ser atualizada e a
   auditoria registra o valor anterior.
4. **Given** um campo protegido, **When** o Doug escolhe "voltar ao valor automático",
   **Then** a proteção é removida e o próximo processamento automático pode atualizá-lo.

---

### User Story 3 — Isolamento e privacidade dos dados (Priority: P1)

Todo dado financeiro pertence a um dono. Nenhuma consulta ou gravação alcança dados de outro
dono, mesmo que o app hoje tenha um único usuário.

**Why this priority**: Constitution II (NON-NEGOTIABLE). Vazamento é irreversível.

**Independent Test**: com dois donos sintéticos, criar contas e transações para cada um e
verificar que todas as operações de um dono (consultar, criar, editar, excluir) jamais
retornam ou afetam registros do outro, e que acesso sem identificação de dono é recusado.

**Acceptance Scenarios**:

1. **Given** dados do dono A e do dono B, **When** o dono A consulta transações,
   **Then** só recebe as próprias.
2. **Given** uma transação do dono B, **When** o dono A tenta editá-la ou excluí-la pelo
   identificador, **Then** a operação falha como "não encontrado", sem revelar que o
   registro existe.
3. **Given** uma requisição sem dono identificado, **When** qualquer operação é tentada,
   **Then** ela é recusada.
4. **Given** uma conta, **When** cadastrada, **Then** apenas os 4 últimos dígitos de número de
   conta ou cartão são guardados; números completos, CPF e senhas nunca são armazenados.

---

### User Story 4 — Cadastro e manutenção manual de contas, transações e categorias (Priority: P2)

O Doug cadastra contas manualmente (ex.: cartão Caixa antes de conectar o Open Finance),
lança transações manuais (ex.: gasto em dinheiro), edita, exclui e restaura registros, e
personaliza o conjunto de categorias.

**Why this priority**: plano B quando a conexão automática não existe ou falha (ADR 0003) e
base das operações das telas de extrato e categorias.

**Independent Test**: criar uma conta manual, lançar três transações, editar uma, excluir
outra, restaurá-la, criar uma subcategoria e reatribuir uma transação a ela — tudo verificável
por consulta e pela auditoria.

**Acceptance Scenarios**:

1. **Given** nenhuma conta, **When** o Doug cria a conta "Cartão Caixa" do tipo cartão de
   crédito com dia de fechamento 5 e vencimento 12, **Then** a conta existe, ativa, com origem
   manual e esses dados.
2. **Given** uma transação manual, **When** o Doug altera valor, data, descrição ou categoria,
   **Then** a alteração é aplicada e auditada com valores anterior e novo.
3. **Given** uma transação, **When** o Doug a exclui, **Then** ela deixa de aparecer nas
   consultas padrão, continua recuperável e a exclusão é auditada com motivo.
4. **Given** uma transação excluída, **When** o Doug a restaura, **Then** ela volta às
   consultas com os mesmos dados.
5. **Given** uma conta com transações, **When** o Doug a arquiva, **Then** ela sai das listas
   de contas ativas, mas seu histórico permanece consultável e contabilizado no passado.
6. **Given** uma categoria com transações, **When** o Doug a exclui, **Then** ele escolhe uma
   categoria de destino (padrão "Sem categoria"), as transações são reatribuídas e tudo é
   auditado.
7. **Given** o conjunto padrão de categorias, **When** o Doug renomeia "Alimentação" para
   "Comida", **Then** todas as transações dessa categoria passam a exibir o novo nome.

---

### User Story 5 — Trilha de auditoria: nada some sem explicação (Priority: P2)

Para qualquer transação, conta ou categoria, o Doug consegue ver o histórico: quem criou
(ele, qual importação, qual sincronização, IA ou regra), o que mudou, quando e por quê.

**Why this priority**: Constitution IV — "nenhum dado é apagado silenciosamente". Essencial
para confiar em merges (011) e categorização automática (014/015).

**Independent Test**: executar criação, edição manual, recategorização automática, exclusão,
restauração e desfazer de lote sobre dados sintéticos e verificar que cada ação gerou um
registro de auditoria com autor, ação, campos alterados (antes/depois) e data/hora.

**Acceptance Scenarios**:

1. **Given** qualquer alteração em entidade core, **When** concluída, **Then** existe um
   registro de auditoria correspondente, gravado de forma atômica com a alteração (ou ambos
   acontecem, ou nenhum).
2. **Given** registros de auditoria, **When** alguém tenta editá-los ou apagá-los,
   **Then** a operação é recusada — a trilha é somente-acréscimo.
3. **Given** um lote de importação concluído, **When** o Doug o desfaz, **Then** todas as
   transações criadas por ele são excluídas logicamente com motivo "lote desfeito",
   permanecem restauráveis e o lote passa a "desfeito".

---

### User Story 6 — Modo demonstração com o mesmo contrato (Priority: P2)

Nas pré-visualizações (sem banco), o mesmo contrato de dados funciona em memória, populado
pelo gerador de dados sintéticos da feature 001, com as mesmas regras de negócio.

**Why this priority**: ADR 0006 / Constitution VII — toda feature com dados MUST funcionar no
modo demonstração; é onde o Doug revisa os PRs.

**Independent Test**: executar a mesma bateria de testes de contrato contra a versão
persistente e a versão em memória; ambas passam 100%.

**Acceptance Scenarios**:

1. **Given** o modo demonstração, **When** o app inicia, **Then** os dados vêm do gerador
   sintético (semente fixa), cobrindo as 5 contas do perfil e ≥ 12 meses de transações.
2. **Given** o modo demonstração, **When** o Doug cria, edita ou exclui um registro,
   **Then** a alteração vale apenas durante a sessão e as mesmas regras (idempotência,
   proteção manual, auditoria, exclusão lógica) se aplicam.
3. **Given** o modo demonstração, **When** qualquer operação é executada, **Then** nenhuma
   conexão com ambiente de dados persistente é feita.

---

### User Story 7 — Transações pendentes e atualizações da fonte (Priority: P3)

Uma compra no cartão aparece como pendente e, dias depois, a fonte a confirma (às vezes com
valor ou descrição ligeiramente diferentes). O app mantém uma única transação, atualizada.

**Why this priority**: comum em Open Finance (007/008), mas só ganha relevância após os
conectores existirem.

**Independent Test**: gravar uma transação pendente via origem `pluggy`, depois gravar a mesma
(mesmo id externo) como efetivada com valor diferente e verificar que existe uma única
transação, efetivada, com o novo valor e auditoria da mudança.

**Acceptance Scenarios**:

1. **Given** uma transação pendente da fonte, **When** a fonte a confirma com o mesmo id
   externo, **Then** o status passa a efetivada na mesma transação.
2. **Given** uma transação pendente cujo valor muda na confirmação, **When** a fonte envia o
   novo valor, **Then** a mesma transação é atualizada com o novo valor, o valor anterior fica registrado na
   auditoria e campos protegidos por edição manual permanecem intocados.
3. **Given** uma transação pendente que a fonte deixa de informar (compra cancelada),
   **When** a sincronização percebe a ausência, **Then** a transação é excluída logicamente com
   motivo "cancelada na fonte" e auditada — nunca apagada.

### Edge Cases

- **Lista vazia**: dono sem contas, sem transações ou sem categorias personalizadas → consultas
  retornam vazio sem erro; o conjunto padrão de categorias existe desde o primeiro acesso.
- **Duplicado**: mesma origem + id externo na mesma conta → não duplica (atualiza se permitido);
  mesmo id externo em contas diferentes → transações distintas.
- **Mesmo arquivo reimportado** → lote detectado como repetido pela impressão digital, sem
  novas transações.
- **Valor zero** (ex.: estorno anulado, tarifa isenta) → aceito e registrado.
- **Valor fracionário abaixo do centavo, texto ou nulo** → rejeitado com erro explícito.
- **Data futura** (ex.: parcelas futuras de cartão) → aceita; data inválida ou fora de
  1900–2100 → rejeitada.
- **Moeda estrangeira** → o valor canônico é sempre em BRL (centavos); valor e moeda originais
  ficam como informação complementar.
- **Descrição vazia** → aceita com descrição exibida "(sem descrição)"; descrição original
  vazia é preservada como veio.
- **Excluir conta com transações** → somente arquivamento lógico; transações preservadas.
- **Categoria pai excluída com subcategorias** → subcategorias são movidas junto para o
  destino escolhido ou excluídas logicamente com o pai, à escolha do Doug.
- **Categoria de sistema** ("Sem categoria", "Transferência entre contas", "Pagamento de
  fatura") → pode ser renomeada, nunca excluída.
- **Transação vinculada a lote desfeito e editada manualmente depois** → também é excluída
  logicamente ao desfazer, mas o aviso informa quantas tinham edições manuais.
- **Gravação concorrente** (sincronização e edição manual ao mesmo tempo) → a edição manual
  prevalece nos campos que ela alterou; nenhuma das duas é perdida silenciosamente.
- **Falha no meio de um lote** (timeout, queda) → lote marcado "falhou" com contadores
  parciais; reprocessar o lote não duplica o que já foi gravado.
- **Offline / ambiente de dados indisponível** → operações falham com erro explícito e
  recuperável; nenhuma gravação parcial sem auditoria.
- **Parcela inconsistente** (n > m, m < 1) → rejeitada.
- **Transferência interna com contrapartida excluída** → o vínculo é desfeito e a transação
  restante volta à natureza "comum", auditado.

## Requirements *(mandatory)*

### Functional Requirements

**Identidade, dono e acesso**
- **FR-001**: Todo registro de instituição personalizada, conta, transação, categoria, lote de
  importação e auditoria MUST pertencer a exatamente um dono.
- **FR-002**: Toda operação (consulta ou gravação) MUST ser restrita aos registros do dono
  identificado; operações sem dono identificado MUST ser recusadas. A restrição MUST valer
  no nível do armazenamento de dados, não apenas na interface.
- **FR-003**: Tentativas de acessar registro de outro dono MUST responder como "não
  encontrado", sem revelar a existência do registro.
- **FR-004**: O modelo MUST NOT armazenar números completos de conta ou cartão, CPF, senhas ou
  credenciais; apenas os 4 últimos dígitos, quando informados.

**Instituições**
- **FR-005**: O sistema MUST oferecer um catálogo de instituições de referência (não pessoal)
  contendo ao menos Mercado Pago, Caixa, PicPay e C6, e permitir ao dono criar instituições
  personalizadas.
- **FR-006**: A instituição MUST guardar nome de exibição e, quando aplicável, código
  bancário e identificador externo do provedor de Open Finance.

**Contas**
- **FR-007**: O sistema MUST suportar os tipos de conta: corrente, carteira digital, cartão de
  crédito, poupança e investimento (este último sem detalhamento de ativos).
- **FR-008**: Toda conta MUST ter nome, tipo, instituição, moeda (BRL por padrão), origem
  (`pluggy` ou `manual`), situação (ativa/arquivada) e, opcionalmente, apelido, 4 últimos
  dígitos e identificador externo.
- **FR-009**: Contas de cartão de crédito MUST aceitar limite (em centavos), dia de fechamento
  e dia de vencimento (1–31), todos opcionais.
- **FR-010**: A conta MUST guardar o saldo informado pela fonte (em centavos, com data de
  referência), quando houver, e o contrato MUST oferecer também o saldo calculado a partir
  das transações (mais saldo inicial, para contas manuais); quando ambos existirem e forem
  diferentes, a divergência MUST ser exposta para exibição.
- **FR-011**: O dono MUST poder criar, editar, arquivar e desarquivar contas; contas MUST NOT
  ser excluídas fisicamente; arquivar preserva todo o histórico.
- **FR-012**: Origem + identificador externo de conta MUST ser único por dono.

**Transações**
- **FR-013**: Toda transação MUST ter: conta, valor em centavos inteiros com sinal (negativo =
  saída da conta, positivo = entrada), data no fuso America/Sao_Paulo, descrição original
  (imutável), status (`pendente` | `efetivada`), origem (`pluggy` | `csv` | `ofx` | `pdf` |
  `sheets` | `manual`) e data/hora técnica de criação e última alteração (UTC).
- **FR-014**: Toda transação importada (origem diferente de `manual`) MUST referenciar o lote
  de importação que a criou; transações manuais MAY não ter lote.
- **FR-015**: A transação MUST suportar campos opcionais: descrição editável, estabelecimento,
  horário original (quando a fonte informa), identificador externo, categoria, notas livres,
  parcela (número n, total m e identificador que agrupa as parcelas da mesma compra), valor
  original em centavos e código da moeda original (ISO 4217) para compras internacionais.
- **FR-016**: A convenção de sinal MUST ser a perspectiva da própria conta: em cartão de
  crédito, compras são negativas e pagamentos de fatura/estornos recebidos são positivos.
- **FR-017**: A transação MUST ter uma natureza: `comum`, `transferencia_interna`,
  `pagamento_fatura` ou `estorno`, com `comum` como padrão, e MAY referenciar uma transação
  relacionada (contrapartida da transferência/pagamento ou transação estornada).
- **FR-018**: Valores, datas e parcelas inválidos (fração de centavo, não numérico, data
  inexistente ou fora de 1900–2100, n > m) MUST ser rejeitados com erro que identifica o campo.
- **FR-019**: O dono MUST poder criar, editar, excluir logicamente e restaurar transações
  manuais em todos os campos editáveis.
- **FR-020**: Em transações importadas, o dono MUST poder editar descrição editável,
  estabelecimento, categoria, natureza, transação relacionada e notas; valor, data, conta,
  origem, identificador externo e descrição original MUST permanecer como vieram da fonte —
  exceto quando a própria fonte atualiza uma transação pendente (US7), caso em que valor e
  descrição de origem são atualizados na mesma transação, com auditoria.

**Idempotência e unicidade**
- **FR-021**: Origem + identificador externo MUST ser único por conta; regravação da mesma
  transação MUST atualizar (quando permitido) ou ignorar, nunca duplicar.
- **FR-022**: Para origens sem identificador externo, o sistema MUST derivar uma identidade
  determinística a partir de conta, data, valor, descrição original normalizada e ordem de
  ocorrência entre lançamentos idênticos na mesma importação.
- **FR-023**: A deduplicação **entre origens diferentes** (ex.: mesma compra via Open Finance e
  PDF) está fora do escopo; o modelo MUST apenas oferecer a exclusão lógica com motivo
  "mesclada" e referência à transação sobrevivente, para uso da feature 011.

**Proteção de edição manual**
- **FR-024**: Todo campo editado manualmente pelo dono MUST ficar marcado como protegido e
  MUST NOT ser sobrescrito por sincronização, reimportação, regra automática ou IA.
- **FR-025**: O dono MUST poder remover a proteção de um campo ("voltar ao automático").
- **FR-026**: A categoria de cada transação MUST registrar a origem da atribuição (`manual`,
  `regra`, `ia`, `fonte`) e, quando automática, a confiança (0–100%); atribuição manual
  MUST ter precedência sobre qualquer outra.

**Categorias**
- **FR-027**: Categorias MUST formar hierarquia de no máximo dois níveis (categoria →
  subcategoria); transações podem ser atribuídas a qualquer nível.
- **FR-028**: Cada categoria MUST ter tipo `despesa`, `receita` ou `neutra` (não conta como
  entrada nem saída, ex.: transferências), herdado pelas subcategorias.
- **FR-029**: Todo dono MUST receber, no primeiro acesso, o conjunto padrão de categorias
  brasileiro no estilo GuiaBolso (cerca de 15 categorias com subcategorias; lista exata
  definida no plano), incluindo sempre as categorias de sistema "Sem categoria", "Transferência entre contas",
  "Pagamento de fatura", além de categorias para salário e tarifas bancárias.
- **FR-030**: O dono MUST poder criar, renomear, ocultar, mover (trocar de pai), excluir
  logicamente e restaurar categorias; categorias de sistema podem ser renomeadas, mas não
  excluídas.
- **FR-031**: Ao excluir categoria com transações, o dono MUST escolher a categoria de destino
  (padrão "Sem categoria"); a reatribuição MUST ser auditada.
- **FR-032**: Nome de categoria MUST ser único entre irmãs do mesmo pai (sem diferenciar
  maiúsculas/minúsculas e acentos).

**Lotes de importação**
- **FR-033**: Toda importação ou execução de sincronização MUST criar um lote com: origem,
  conta(s) alvo, iniciador, impressão digital do arquivo (quando houver), período coberto,
  situação (`em_processamento`, `em_revisao`, `concluido`, `falhou`, `desfeito`), contadores
  (lidas, criadas, atualizadas, ignoradas por duplicidade, rejeitadas) e datas de início/fim.
- **FR-034**: Arquivo com a mesma impressão digital já importado com sucesso para a mesma conta
  MUST ser sinalizado como repetido antes de processar.
- **FR-035**: O dono MUST poder desfazer um lote concluído; isso exclui logicamente todas as
  transações criadas pelo lote (restauráveis), informando quantas tinham edições manuais.
- **FR-036**: Lotes MUST NOT ser excluídos fisicamente.

**Exclusão lógica e auditoria**
- **FR-037**: Nenhuma entidade core MUST ser apagada fisicamente pelas operações do app;
  exclusão é lógica, com motivo (`usuario`, `mesclada`, `lote_desfeito`, `cancelada_na_fonte`)
  e data/hora.
- **FR-038**: Consultas padrão MUST omitir registros excluídos logicamente; deve existir
  consulta explícita que os inclua.
- **FR-039**: Toda criação, alteração, exclusão, restauração, mesclagem e desfazer de lote
  MUST gerar registro de auditoria com: entidade, identificador, ação, autor (`usuario`,
  `sincronizacao`, `importacao`, `ia`, `regra`, `sistema`) com referência ao lote/processo
  quando houver, campos alterados com valores anterior e novo, e data/hora (UTC).
- **FR-040**: A auditoria MUST ser gravada atomicamente com a alteração e MUST ser
  somente-acréscimo (sem edição nem exclusão).
- **FR-041**: Registros de auditoria MUST NOT conter segredos ou credenciais.

**Consultas do contrato**
- **FR-042**: O contrato MUST oferecer consulta de transações por dono, filtrável por conta(s)
  e período, ordenada por data decrescente (desempate estável), paginada.
- **FR-043**: O contrato MUST oferecer consulta de contas (ativas/arquivadas), da árvore de
  categorias, de lotes e do histórico de auditoria de um registro.
- **FR-044**: Todos os dados do dono (inclusive excluídos logicamente e auditoria) MUST ser
  integralmente legíveis pelo contrato, para viabilizar a exportação completa (feature 005).

**Modo demonstração**
- **FR-045**: O contrato MUST ter duas implementações intercambiáveis — persistente e em
  memória — com comportamento idêntico para todas as regras desta spec.
- **FR-046**: Uma única bateria de testes de contrato MUST rodar contra as duas implementações.
- **FR-047**: A implementação em memória MUST ser populada pelo gerador de dados sintéticos da
  feature 001 (semente fixa), adaptado ao modelo desta feature, e suas gravações MUST valer
  apenas durante a sessão.

**Evolução do modelo**
- **FR-048**: Mudanças de estrutura nas entidades core MUST ser aditivas e reversíveis sempre
  que possível; outras features propõem mudanças nesta spec (Constitution VII).

### Key Entities

- **Dono**: o usuário a quem todos os dados pertencem. Hoje há um único (o Doug); o modelo
  nunca assume isso.
- **Instituição**: banco, carteira ou emissor. Nome, código bancário opcional, identificador
  externo opcional; catálogo de referência + personalizadas do dono.
- **Conta**: pertence a uma instituição. Nome, apelido, tipo (corrente, carteira digital,
  cartão de crédito, poupança, investimento), moeda, origem, identificador externo, 4 últimos
  dígitos, situação, saldo informado pela fonte + data de referência (ver FR-010); para cartão: limite, dia de fechamento e vencimento.
- **Transação**: movimento numa conta. Valor em centavos com sinal, data (São Paulo), horário
  opcional, descrição original e editável, estabelecimento, status, origem, identificador
  externo, lote, categoria + origem/confiança da atribuição, natureza, transação relacionada,
  parcela n/m + agrupador, valor/moeda originais, notas, campos protegidos, exclusão lógica.
- **Categoria**: nó de hierarquia de 2 níveis com nome, tipo (despesa/receita/neutra), pai,
  marcação de sistema/padrão/personalizada, oculta, exclusão lógica.
- **Lote de importação**: uma execução de importação ou sincronização: origem, contas, arquivo
  (impressão digital), período, situação, contadores, iniciador, datas.
- **Registro de auditoria**: evento imutável: entidade, registro, ação, autor, referência de
  processo, antes/depois dos campos, data/hora.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reimportar 10 vezes o mesmo conjunto sintético de 12 meses gera 0 transações
  duplicadas.
- **SC-002**: 100% dos campos editados manualmente permanecem intactos após 100 ciclos
  sintéticos de sincronização/reimportação/recategorização automática.
- **SC-003**: Em teste com dois donos, 0 registros de um dono são lidos ou alterados pelo
  outro em todas as operações do contrato.
- **SC-004**: 100% das alterações em entidades core têm registro de auditoria correspondente;
  0 registros apagados fisicamente pelas operações do app.
- **SC-005**: A mesma bateria de testes de contrato passa 100% nas implementações persistente
  e em memória.
- **SC-006**: Soma de valores de qualquer período bate ao centavo com a soma dos dados de
  origem do gerador sintético (diferença 0).
- **SC-007**: Com 100.000 transações (≈ 25 anos de uso no perfil do Doug), a consulta de um
  mês de extrato de todas as contas é percebida como instantânea (≤ 1 segundo).
- **SC-008**: O Doug consegue cadastrar uma conta manual e lançar uma transação manual em
  menos de 1 minuto cada (medido quando a tela da feature 012 existir).

## Clarifications

### Session 2026-10-02

- Q: Qual taxonomia padrão de categorias? → A: Estilo GuiaBolso, cerca de 15 categorias com
  subcategorias; a lista exata fica no plano.
- Q: Como tratar transação pendente que muda de valor na confirmação? → A: Atualiza a mesma
  transação; o valor anterior fica na auditoria; campos protegidos por edição manual ficam
  intocados.
- Q: Saldo armazenado ou calculado? → A: Ambos — guarda o saldo da fonte com data de
  referência e oferece o saldo calculado a partir das transações; exibe a divergência.

## Assumptions

- Nesta feature não há telas próprias; a interface de extrato/edição é da 012 e a de
  categorias usa o shell da 003. O contrato é validado por testes e pelo modo demonstração.
- Saldos, filtros avançados, busca textual, faturas, regras de categorização, dedup entre
  origens e detalhamento de investimentos são das features 012–025; aqui ficam apenas os
  campos e vínculos de que elas precisam.
- Em transações importadas, valor/data/conta são fatos da fonte; para "corrigir" um deles, o
  Doug exclui logicamente e cria uma transação manual (decisão assumida, revisável no clarify).
- A identidade determinística de CSV usa a ordem de ocorrência dentro do arquivo; o algoritmo
  exato e a normalização de descrição ficam no plano.
- A confiança de IA é um percentual inteiro 0–100; a interpretação fica com a 014.
- Excluídos logicamente são mantidos indefinidamente (sem expurgo automático); retenção
  diferente exigiria nova decisão.
- O catálogo de instituições de referência começa com as instituições do Doug e é ampliado
  conforme os conectores (007) informarem novas.
- Fuso padrão America/Sao_Paulo para todas as datas de transação; o horário original, quando
  existe, é guardado como instante (UTC) e apenas exibido no fuso de São Paulo.
- O gerador sintético da 001 produz formato próprio; esta feature fornece o adaptador para o
  modelo core (a 004 é dona das entidades).
- Custo recorrente desta feature: R$ 0 (sem serviços novos).
