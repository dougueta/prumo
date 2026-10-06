# Feature Specification: Design System e Shell do App

**Feature Branch**: `003-design-system`
**Created**: 2026-10-02
**Status**: Approved (Gate 1, 2026-10-02)
**Iniciativa**: 0 · Plataforma
**Onda**: 1
**Agente**: Claude (revisor: Gemini)
**Dependências**: 001 (setup-projeto)
**Input**: "Design system e shell do app (navegação, layout mobile-first, componentes base,
tema claro/escuro) para que Claude e Gemini construam telas em paralelo com aparência e
comportamento idênticos."

## Contexto

O Prumo será construído por dois agentes diferentes (Claude e Gemini), feature a feature, ao
longo de 32 features. Sem uma base visual e de interação comum, cada agente inventaria seus
próprios botões, formatos de valor e estados de erro — e o app viraria uma colcha de retalhos.
Esta feature entrega:

1. **Identidade "Prumo"** — equilíbrio, direção e clareza: uma interface calma, que mostra
   dinheiro sem alarde e sem ruído.
2. **Shell do app** — a "moldura" onde todas as telas futuras se encaixam: navegação principal,
   cabeçalho, área de conteúdo, selo de demonstração e indicador de ambiente.
3. **Componentes base de finanças** com padrões obrigatórios (valor monetário, data, item de
   transação, card de resumo, estados vazio/carregando/erro/offline, selo de confiança de IA,
   formulários e confirmações).
4. **Catálogo navegável** dos componentes e regras de uso, que é a referência única para os
   agentes.

O Doug trabalhou no GuiaBolso e é exigente com UX de finanças pessoais: valores precisam ser
legíveis num relance, entradas e saídas inconfundíveis, e nada pode parecer "planilha".
Os "usuários" desta feature são o **Doug** (usuário final e aprovador) e os **agentes
desenvolvedores** (consumidores do catálogo).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Shell navegável, mobile-first (Priority: P1)

O Doug abre o Prumo no celular e vê a moldura do app: cabeçalho com o título da seção, área de
conteúdo e uma barra de navegação inferior com as seções principais. No computador, a mesma
navegação aparece como menu lateral. Cada seção ainda sem funcionalidade mostra uma tela "em
breve" consistente. Em pré-visualização, o selo "Demonstração — dados fictícios" fica sempre
visível.

**Why this priority**: toda feature de tela (012, 017, 018, 020, 025…) precisa de um lugar
onde se encaixar; sem o shell, cada agente criaria sua própria navegação.

**Independent Test**: abrir a pré-visualização em um celular (largura 360px) e em um desktop
(largura 1280px), navegar por todas as seções principais e confirmar layout, seção ativa
destacada, selo de demonstração e telas "em breve".

**Acceptance Scenarios**:

1. **Given** o app aberto em tela estreita (celular), **When** a tela carrega, **Then** a
   navegação principal aparece como barra inferior fixa com no máximo 5 destinos, cada um com
   ícone e rótulo de texto, e o destino atual destacado.
2. **Given** o app aberto em tela larga (desktop), **When** a tela carrega, **Then** a mesma
   navegação aparece como menu lateral, com os mesmos destinos e na mesma ordem, e a barra
   inferior não é exibida.
3. **Given** o usuário em qualquer seção, **When** toca em outro destino da navegação,
   **Then** a seção correspondente abre, o destaque muda e o endereço da página reflete a
   seção (permitindo voltar com o botão "voltar" do navegador/celular).
4. **Given** uma seção cuja feature ainda não existe, **When** o usuário a abre, **Then** vê
   uma tela "em breve" padronizada com o nome da seção, sem erros.
5. **Given** o app rodando em modo demonstração (pré-visualização), **When** qualquer tela é
   exibida, **Then** o selo "Demonstração — dados fictícios" está visível sem cobrir conteúdo
   nem a navegação.
6. **Given** o app rodando no ambiente `local`, **When** qualquer tela é exibida, **Then** um
   indicador discreto mostra o ambiente; **Given** o ambiente `production`, **Then** nenhum
   indicador de ambiente nem selo de demonstração aparece.
7. **Given** o app instalado no celular (PWA) em um aparelho com entalhe/área de gestos,
   **When** aberto, **Then** cabeçalho e barra inferior respeitam as áreas seguras da tela.

---

### User Story 2 — Valores monetários e datas inconfundíveis (Priority: P1)

Em qualquer tela do app, um valor em dinheiro aparece sempre do mesmo jeito: `R$ 1.234,56`,
com sinal e cor distintos para entrada e saída, e datas aparecem como "Hoje", "Ontem" ou
"28 set." de forma consistente. O Doug nunca precisa adivinhar se um número é gasto ou receita.

**Why this priority**: é o coração de um app de finanças; se dois agentes formatarem valores
de jeitos diferentes, a confiança no app acaba (Constitution III).

**Independent Test**: no catálogo, conferir o componente de valor e o de data contra a tabela
de exemplos desta spec (positivos, negativos, zero, grandes, centavos, datas de hoje, ontem,
este ano, anos anteriores) nos temas claro e escuro.

**Acceptance Scenarios**:

1. **Given** o valor de `123456` centavos como entrada, **When** exibido, **Then** aparece
   como `+R$ 1.234,56` com a cor semântica de entrada.
2. **Given** o valor de `-4590` centavos como saída, **When** exibido, **Then** aparece como
   `−R$ 45,90` com a cor semântica de saída; o sinal está presente (não depende só da cor).
3. **Given** o valor `0`, **When** exibido, **Then** aparece como `R$ 0,00` na cor neutra,
   sem sinal.
4. **Given** um valor exibido em contexto de saldo (não de movimentação), **When** exibido,
   **Then** usa o formato sem `+` para positivos e com `−` para negativos (saldo devedor).
5. **Given** um valor em card de resumo com pouco espaço, **When** a variante compacta é usada,
   **Then** aparece abreviado (ex.: `R$ 12,3 mil`, `R$ 1,2 mi`) e o valor completo fica
   disponível para leitor de tela e ao tocar/passar o mouse.
6. **Given** uma data de transação igual a hoje no fuso `America/Sao_Paulo`, **When** exibida
   na forma relativa, **Then** aparece "Hoje"; ontem → "Ontem"; outro dia do ano corrente →
   "28 set."; outro ano → "28 set. 2025"; a forma absoluta completa ("28/09/2026") está
   sempre disponível ao leitor de tela e na variante absoluta.
7. **Given** um valor ou data exibido, **When** lido por leitor de tela, **Then** é anunciado
   por extenso de forma compreensível (ex.: "saída de 45 reais e 90 centavos").

---

### User Story 3 — Componentes base e estados padronizados (Priority: P1)

Um agente que vai construir a tela de extrato (012) ou a carteira de investimentos (025)
encontra prontos: item de transação, card de resumo, lista, estados vazio/carregando/erro/
offline, selo de confiança de IA, campos de formulário (incluindo campo de valor em reais),
diálogo de confirmação e aviso temporário com "desfazer". Ele monta a tela só com esses
componentes, sem criar estilos próprios.

**Why this priority**: é o que garante aparência e comportamento idênticos entre Claude e
Gemini e evita retrabalho em todas as features seguintes.

**Independent Test**: no catálogo, abrir cada componente e verificar que todas as variantes e
estados listados nos requisitos existem, funcionam com teclado, toque e leitor de tela, e estão
corretos nos dois temas, usando apenas dados sintéticos.

**Acceptance Scenarios**:

1. **Given** uma transação sintética, **When** exibida pelo item de transação, **Then** mostra
   ícone/cor da categoria, descrição, categoria, conta/origem, data e valor, e indica se está
   pendente, parcelada (ex.: "3/10") ou se é transferência entre contas próprias.
2. **Given** uma transação categorizada por IA, **When** exibida, **Then** o selo de origem
   indica "IA" com o nível de confiança (alta/média/baixa) e oferece ação para corrigir;
   confiança baixa é destacada como "revisar"; categoria definida manualmente ou por regra
   mostra a origem correspondente (Constitution VI).
3. **Given** uma lista sem itens, **When** exibida, **Then** aparece o estado vazio com
   ilustração/ícone, texto explicativo e, quando fizer sentido, uma ação principal.
4. **Given** um conteúdo carregando, **When** exibido, **Then** aparece um esqueleto com o
   formato aproximado do conteúdo final (sem "pulos" de layout quando o conteúdo chega).
5. **Given** uma falha ao obter conteúdo, **When** exibida, **Then** aparece o estado de erro
   com mensagem em português, sem detalhes técnicos, e o botão "Tentar novamente".
6. **Given** o aparelho sem conexão, **When** o app está aberto, **Then** um aviso de "Você
   está offline" aparece no shell e some sozinho quando a conexão volta.
7. **Given** uma ação destrutiva (ex.: excluir), **When** o usuário a inicia, **Then** um
   diálogo de confirmação nomeia a ação e o objeto ("Excluir transação 'Mercado X'?"), com o
   botão destrutivo claramente diferenciado e "Cancelar" como opção segura.
8. **Given** um campo de valor em reais, **When** o usuário digita "1234,5" ou "1.234,50",
   **Then** o campo exibe `R$ 1.234,50`, abre teclado numérico no celular e entrega o valor
   exato em centavos (`123450`), sem arredondamento.
9. **Given** um formulário com campo inválido, **When** o usuário tenta enviar, **Then** o erro
   aparece junto ao campo, em português, o foco vai para o primeiro campo inválido e o leitor
   de tela anuncia o erro.

---

### User Story 4 — Tema claro/escuro e acessibilidade (Priority: P2)

O Prumo segue o tema do sistema (claro ou escuro) e o Doug pode fixar manualmente "Claro",
"Escuro" ou "Automático". Em qualquer tema, tudo é legível, navegável por teclado e por leitor
de tela, com áreas de toque confortáveis e sem animações para quem prefere movimento reduzido.

**Why this priority**: tema e acessibilidade precisam estar no sistema desde o início — corrigir
depois em 30 features é caro. Vem depois de P1 porque o shell e os componentes existem antes.

**Independent Test**: alternar o tema do sistema e a preferência manual, recarregar o app,
navegar o catálogo só com teclado e com leitor de tela, e rodar a verificação automática de
contraste/acessibilidade em todos os componentes nos dois temas.

**Acceptance Scenarios**:

1. **Given** a preferência "Automático" e o sistema em modo escuro, **When** o app abre,
   **Then** abre em tema escuro sem piscar o tema claro antes.
2. **Given** o usuário escolhe "Claro" manualmente, **When** fecha e reabre o app no mesmo
   aparelho, **Then** a escolha é mantida mesmo com o sistema em modo escuro.
3. **Given** qualquer texto ou ícone informativo, **When** medido nos dois temas, **Then**
   atinge contraste mínimo AA (4,5:1 para texto normal; 3:1 para texto grande e elementos
   gráficos de interface).
4. **Given** navegação só por teclado, **When** o usuário percorre qualquer tela, **Then** o
   foco é sempre visível, segue a ordem visual e há um atalho "Pular para o conteúdo".
5. **Given** o sistema com "reduzir movimento" ativado, **When** o usuário navega, **Then**
   transições e animações não essenciais são desativadas.
6. **Given** o texto do sistema ampliado para 200%, **When** o app é usado, **Then** nenhum
   conteúdo ou ação fica cortado ou inacessível.

---

### User Story 5 — Modo privacidade: ocultar valores (Priority: P2)

Em público (ônibus, escritório), o Doug toca num botão de "olho" no cabeçalho e todos os
valores monetários do app passam a aparecer mascarados (`R$ ••••`). Tocar de novo revela.

**Why this priority**: padrão de mercado em apps financeiros e pedido explícito de UX; precisa
nascer no componente de valor para que nenhuma feature futura esqueça de respeitá-lo.

**Independent Test**: no catálogo e no shell, ativar o modo privacidade e verificar que todo
componente que exibe valor monetário fica mascarado, inclusive para leitor de tela; recarregar
e verificar que o estado se mantém.

**Acceptance Scenarios**:

1. **Given** o modo privacidade desativado, **When** o usuário aciona o botão de ocultar
   valores no cabeçalho, **Then** todos os valores monetários visíveis passam a `R$ ••••`
   imediatamente, sem recarregar a tela, e a largura do texto não revela a ordem de grandeza.
2. **Given** o modo privacidade ativo, **When** um leitor de tela lê um valor, **Then** anuncia
   "valor oculto".
3. **Given** o modo privacidade ativo, **When** o usuário fecha e reabre o app no mesmo
   aparelho, **Then** o modo continua ativo.
4. **Given** o modo privacidade ativo, **When** o usuário está num campo de digitação de
   valor, **Then** o campo mostra o que está sendo digitado (o mascaramento vale só para
   exibição).

---

### User Story 6 — Catálogo navegável e regras de uso (Priority: P2)

Um agente (ou o Doug) abre o catálogo do design system e encontra: fundamentos (cores, tipografia,
espaçamentos, ícones, raios, sombras, movimento), cada componente com suas variantes e estados
interativos, exemplos com dados sintéticos e as regras de uso ("quando usar / quando não usar",
textos padrão em português). É a única referência que os agentes consultam para montar telas.

**Why this priority**: torna o design system utilizável por dois agentes sem conversa entre si;
depende de P1 existir.

**Independent Test**: abrir o catálogo na pré-visualização, localizar cada componente listado
nos requisitos, alternar tema e modo privacidade dentro do catálogo e verificar que cada
componente tem regras de uso documentadas.

**Acceptance Scenarios**:

1. **Given** o catálogo aberto, **When** o usuário procura um componente pelo nome, **Then**
   encontra sua página com descrição, variantes, estados e regras de uso.
2. **Given** a página de um componente, **When** o usuário alterna tema claro/escuro e modo
   privacidade, **Then** os exemplos refletem a mudança na hora.
3. **Given** o catálogo, **When** acessado em `local` ou `preview`, **Then** está disponível;
   **Given** `production`, **Then** não é acessível.
4. **Given** as regras de uso, **When** um agente precisa de um texto padrão (ex.: mensagem de
   erro genérica, rótulo de "Tentar novamente", estado vazio), **Then** encontra o texto
   oficial em português para reutilizar.

### Edge Cases

- **Valores extremos**: valores ≥ R$ 1 bilhão ou com muitos dígitos não quebram o layout do item
  de transação nem do card (truncamento controlado ou variante compacta, nunca sobreposição).
- **Centavos**: valores como `1`, `-1` e `99` centavos exibem `R$ 0,01`, `−R$ 0,01`, `R$ 0,99`.
- **Valor ausente/desconhecido**: exibido como "—" com leitura "valor indisponível", nunca
  como `R$ 0,00`.
- **Moeda diferente de BRL** (investimentos, compra internacional): o componente de valor exibe
  o código/símbolo da moeda informada (ex.: `US$ 10,00`), mantendo separadores pt-BR.
- **Descrições longas** de transação: truncadas em uma ou duas linhas com o texto completo
  acessível; nunca empurram o valor para fora da tela.
- **Datas na virada do dia**: "Hoje"/"Ontem" calculados no fuso `America/Sao_Paulo`, mesmo com
  o aparelho em outro fuso; data futura (ex.: parcela agendada) exibida como "Amanhã" ou
  data absoluta.
- **Lista vazia vs. filtro sem resultado**: estados vazios distintos ("Nenhuma transação ainda"
  × "Nenhum resultado para este filtro", com ação "Limpar filtros").
- **Carregamento demorado** (> 10 s): o esqueleto dá lugar a uma mensagem de demora com opção
  de tentar novamente, em vez de carregar indefinidamente.
- **Erro parcial**: parte da tela carregou e parte falhou → o estado de erro aparece só no bloco
  afetado, o resto da tela continua utilizável.
- **Offline durante ação**: ação que precisa de conexão iniciada sem rede → aviso claro de que
  não foi concluída; nada é dado como salvo.
- **Duplo toque/duplo envio**: botões de envio ficam em estado "enviando" e ignoram toques
  repetidos até a conclusão.
- **Muitos destinos futuros**: features novas que não cabem na barra inferior entram em "Mais",
  nunca como sexto item da barra.
- **Preferências indisponíveis** (armazenamento do navegador bloqueado/limpo): tema volta a
  "Automático" e modo privacidade a desativado, sem erro.
- **Telas muito estreitas** (320px) e **muito largas** (≥ 1920px): sem rolagem horizontal; o
  conteúdo tem largura máxima legível no desktop.
- **Selo de demonstração e indicador de ambiente** não podem ser ocultados pelo usuário nem
  sobrepostos por diálogos de forma que pareça produção.
- **Endereço inexistente**: uma URL que não corresponde a nenhuma tela mostra a página
  "Página não encontrada" em português, com o visual do Prumo (tema e selo de demonstração) e a
  ação "Voltar ao início" — nunca a página padrão em inglês da plataforma.
- **Telas fora do shell** (entrada/login, desbloqueio, "sem conexão", "não encontrada"): não
  exibem navegação principal, mas seguem os fundamentos visuais, o tema e o selo de demonstração.

## Requirements *(mandatory)*

### Functional Requirements

**Identidade e fundamentos**
- **FR-001**: O sistema MUST definir um conjunto único de fundamentos visuais nomeados (cores
  semânticas, tipografia, espaçamentos, raios, sombras, ícones e movimento), nos temas claro e
  escuro, que são a única fonte de valores visuais das telas.
- **FR-002**: A paleta MUST seguir a direção visual "sóbria e calma" da marca Prumo:
  verde-petróleo/azul profundo como cor da marca, neutros quentes, verde suave para entrada e
  terracota suave para saída (nunca vermelho alarmante), nos temas claro e escuro.
- **FR-003**: Os fundamentos MUST incluir cores semânticas de finanças — entrada, saída,
  neutro, alerta, sucesso, erro, informação e destaque de IA — com contraste AA nos dois temas.
- **FR-004**: Telas de features MUST NOT usar cores, tamanhos de fonte ou espaçamentos fora dos
  fundamentos; o projeto MUST ter verificação automática que aponte violações.
- **FR-005**: Números monetários MUST usar algarismos de largura fixa (tabulares) para que
  colunas de valores fiquem alinhadas.
- **FR-006**: O app MUST ter nome "Prumo", logotipo/ícone próprio aplicado no shell, no ícone
  de instalação e na tela de abertura, coerente com a paleta escolhida.

**Shell e navegação**
- **FR-007**: O shell MUST oferecer navegação principal com os destinos, nesta ordem:
  **Início** · **Extrato** · **Planejamento** (cartões, orçamento, metas, projeção) ·
  **Investimentos** · **Mais** (contas e conexões, importações, alertas, ajustes, exportação).
  Em telas estreitas ela é uma barra inferior fixa (máx. 5 destinos, ícone + rótulo); em telas
  largas, um menu lateral com os mesmos destinos e ordem.
- **FR-008**: O shell MUST definir um mapa de onde cada uma das 32 features do roadmap se
  encaixa (destino principal, subseção ou "Mais"), documentado nas regras de uso, para que
  nenhuma feature crie navegação própria; o mapa também lista as telas que ficam **fora do
  shell** (entrada/login, desbloqueio, "sem conexão", "não encontrada") e a feature dona de cada uma.
- **FR-009**: Destinos ainda sem feature implementada MUST exibir uma tela "em breve"
  padronizada; destinos de features futuras podem ficar ocultos até existirem, conforme o mapa.
- **FR-010**: O shell MUST ter cabeçalho com título da tela, ação de voltar em telas internas,
  botão de modo privacidade e espaço para ações da própria tela (no máximo 2 visíveis; demais
  em menu).
- **FR-011**: Cada tela MUST ter endereço próprio, compatível com voltar/avançar do navegador
  e com o gesto de voltar do celular; a seção ativa MUST ficar destacada na navegação.
- **FR-012**: Em modo demonstração, o app MUST exibir o selo "Demonstração — dados fictícios"
  em todas as telas — dentro e fora do shell (inclusive entrada/login, "sem conexão" e "não
  encontrada") —, sempre visível e não removível pelo usuário (ADR 0006).
- **FR-013**: O shell MUST exibir indicador discreto do ambiente em `local`; em `production`
  não exibe indicador nem selo.
- **FR-014**: O shell MUST exibir aviso de "offline" quando o aparelho perde conexão e
  removê-lo automaticamente ao reconectar.
- **FR-015**: O shell MUST respeitar as áreas seguras da tela em aparelhos com entalhe/área de
  gestos quando instalado como app.
- **FR-016**: No desktop, a área de conteúdo MUST ter largura máxima legível e não pode exigir
  rolagem horizontal entre 320px e 1920px de largura.
- **FR-017**: O shell MUST oferecer acesso a uma tela de "Ajustes" com, no mínimo, a escolha de
  tema (Automático/Claro/Escuro) e o modo privacidade.

**Tema e acessibilidade**
- **FR-018**: O app MUST seguir o tema do sistema por padrão e permitir fixar Claro ou Escuro;
  a escolha MUST persistir no aparelho e ser aplicada antes da primeira exibição (sem
  "piscar" o tema errado).
- **FR-019**: Todo texto e elemento informativo MUST atingir contraste WCAG 2.1 AA nos dois
  temas; nenhuma informação pode ser transmitida apenas por cor.
- **FR-020**: Todo elemento interativo MUST ser operável por teclado, ter foco visível e nome
  acessível em português; o shell MUST ter atalho "Pular para o conteúdo".
- **FR-021**: Áreas de toque MUST ter no mínimo 44×44 pontos.
- **FR-022**: Com "reduzir movimento" ativo no sistema, animações e transições não essenciais
  MUST ser desativadas.
- **FR-023**: O app MUST permanecer utilizável com texto ampliado a 200%.
- **FR-024**: Diálogos MUST prender o foco enquanto abertos, fechar com Esc (e gesto de voltar
  no celular) e devolver o foco ao elemento que os abriu.

**Valor monetário e data**
- **FR-025**: O componente de valor MUST receber o valor como inteiro em centavos e a moeda
  (padrão BRL), e exibir no formato pt-BR (`R$ 1.234,56`), sem nenhum arredondamento ou
  conversão intermediária que perca precisão (Constitution III).
- **FR-026**: O componente de valor MUST ter as variantes: movimentação (com `+` em entradas e
  `−` em saídas e cor semântica), saldo (sem `+`, com `−` para negativo), neutra e compacta
  (`R$ 12,3 mil`, `R$ 1,2 mi`, com valor completo acessível).
- **FR-027**: O componente de valor MUST respeitar o modo privacidade, exibindo máscara de
  largura fixa (`R$ ••••`) e anunciando "valor oculto" ao leitor de tela.
- **FR-028**: O componente de valor MUST exibir "—" para valor ausente, com leitura
  "valor indisponível".
- **FR-029**: O componente de data MUST ter as variantes relativa ("Hoje", "Ontem", "Amanhã",
  "28 set.", "28 set. 2025") e absoluta ("28/09/2026"), calculadas no fuso
  `America/Sao_Paulo`, com a data completa sempre disponível ao leitor de tela.
- **FR-030**: O componente de período MUST exibir mês/ano e intervalos em pt-BR
  (ex.: "Setembro de 2026", "1–15 set.") para uso em filtros e resumos.

**Modo privacidade**
- **FR-031**: O usuário MUST poder ativar/desativar o modo privacidade pelo cabeçalho e pelos
  Ajustes; a escolha MUST persistir no aparelho e valer para todo valor monetário exibido no
  app, inclusive em gráficos e cards de resumo futuros. O modo privacidade entra completo
  nesta feature (botão no cabeçalho, opção em Ajustes, persistência e respeito por todo
  componente de valor).

**Componentes de finanças**
- **FR-032**: O item de transação MUST exibir ícone/cor da categoria, descrição, categoria,
  conta/origem, data, valor e indicadores opcionais de pendente, parcela ("3/10"),
  natureza (transferência entre contas próprias, pagamento de fatura, estorno — Constitution IV),
  valor na moeda original (compra internacional) e origem/confiança da categorização; MUST ser
  acionável (abre detalhe) e ter versões compacta e normal.
- **FR-033**: O card de resumo MUST exibir título, valor principal, variação opcional em
  relação a um período de referência (com seta e sinal, não só cor) e estados
  carregando/erro/vazio próprios.
- **FR-034**: A lista agrupada MUST agrupar itens por data com cabeçalho de grupo (data
  relativa) e, opcionalmente, total do dia.
- **FR-035**: O selo de origem/confiança MUST distinguir as origens IA, regra, manual e fonte
  (categoria informada pela instituição ou pelo arquivo importado); para IA,
  MUST exibir o nível de confiança (alta/média/baixa), destacar "revisar" na confiança baixa,
  explicar o significado ao ser tocado e oferecer ação de corrigir (Constitution VI).
- **FR-036**: O sistema MUST oferecer um conjunto de ícones de categoria e de instituição
  genérica, com regra para instituições sem ícone (iniciais em círculo); o ícone e a cor de cada
  categoria de 1º nível vêm de um mapa fixo do design system (subcategorias herdam do pai;
  categorias sem mapeamento recebem ícone e cor neutros), e nenhuma feature escolhe cor de
  categoria por conta própria.

**Estados**
- **FR-037**: O sistema MUST oferecer componentes padronizados para os estados: vazio (com
  variante "sem resultados de filtro"), carregando (esqueleto com o formato do conteúdo),
  carregamento demorado (> 10 s), erro (mensagem em português sem detalhes técnicos + "Tentar
  novamente"), erro parcial (restrito ao bloco afetado) e offline.
- **FR-038**: Toda mensagem de erro exibida ao usuário MUST ser em português, explicar o que
  aconteceu e o que fazer, e nunca exibir códigos internos, rastros técnicos ou dados sensíveis.

**Formulários, ações e feedback**
- **FR-039**: O sistema MUST oferecer campos de formulário padronizados: texto, valor em reais
  (entrada pt-BR, teclado numérico, saída em centavos exatos, sinal entrada/saída
  selecionável), data (com atalhos "Hoje"/"Ontem"), seleção (incluindo categoria e conta),
  alternância e área de texto — todos com rótulo, ajuda opcional e erro junto ao campo.
- **FR-040**: Formulários MUST validar ao sair do campo e ao enviar, levar o foco ao primeiro
  erro e impedir envio duplicado (botão em estado "enviando").
- **FR-041**: O sistema MUST oferecer botões com hierarquia (principal, secundário, discreto,
  destrutivo) e no máximo um botão principal por tela/diálogo.
- **FR-042**: Ações destrutivas MUST usar diálogo de confirmação que nomeia ação e objeto, com
  "Cancelar" como foco inicial; ações reversíveis MAY usar aviso temporário com "Desfazer" em
  vez de confirmação.
- **FR-043**: O sistema MUST oferecer aviso temporário (sucesso/erro/informação) anunciado ao
  leitor de tela, que não cubra a navegação e dure tempo suficiente para leitura (≥ 5 s, ou
  até ser dispensado quando contém ação).
- **FR-044**: Em telas estreitas, diálogos e seleções longas (mais de 7 opções) MUST abrir como painel inferior
  (bottom sheet); em telas largas, como diálogo central.

**Catálogo e regras de uso**
- **FR-045**: O projeto MUST ter um catálogo navegável que apresente fundamentos e cada
  componente com todas as variantes e estados, alternância de tema e de modo privacidade, e
  exemplos que usam exclusivamente dados sintéticos (Constitution II).
- **FR-046**: O catálogo MUST estar disponível em `local` e `preview` e MUST NOT estar
  acessível em `production`.
- **FR-047**: Cada componente MUST ter regras de uso documentadas: quando usar, quando não usar,
  textos padrão em português, comportamento de acessibilidade e exemplos certo/errado.
- **FR-048**: As regras MUST incluir um guia de escrita (tom de voz, termos padronizados — ex.:
  "entrada"/"saída", "transação", "conta", "cartão" — e textos padrão de vazio, erro e
  confirmação).
- **FR-049**: Cada componente MUST ter verificação automática de comportamento, acessibilidade
  e aparência nos temas claro e escuro, para que mudanças futuras que o quebrem sejam
  detectadas antes do merge.

**Modo demonstração e escopo**
- **FR-050**: Shell e catálogo MUST funcionar integralmente em modo demonstração, sem banco de
  dados (Constitution VII, ADR 0006).
- **FR-051**: Esta feature MUST NOT criar telas de funcionalidades (extrato, dashboard etc.)
  nem tabelas de dados; cada feature constrói suas telas com estes componentes.
- **FR-052**: A feature MUST custar R$ 0/mês (sem serviços pagos de fontes, ícones ou
  catálogo).

### Key Entities

- **Fundamento visual (token)**: valor nomeado e semântico (ex.: "cor de saída", "espaço
  médio") com versões para tema claro e escuro; única fonte de valores visuais.
- **Componente**: elemento reutilizável com variantes, estados, regras de uso e verificação
  automática.
- **Destino de navegação**: seção do app com nome, ícone, endereço, posição e as features do
  roadmap que abriga.
- **Preferências de exibição**: tema (Automático/Claro/Escuro) e modo privacidade
  (ligado/desligado), guardados no aparelho, não no banco.
- **Ambiente**: `local`, `preview` (modo demonstração) ou `production`, que define selo,
  indicador e disponibilidade do catálogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos componentes listados nos requisitos aparecem no catálogo com todas as
  variantes e estados, nos dois temas.
- **SC-002**: 0 violações de acessibilidade de nível A/AA detectadas pela verificação automática
  em todos os componentes e no shell, nos dois temas.
- **SC-003**: 100% dos exemplos da tabela de formatação (valores e datas, incluindo edge
  cases) exibem exatamente o texto esperado.
- **SC-004**: O Doug identifica corretamente se um valor é entrada ou saída em 10 de 10
  exemplos exibidos em escala de cinza (sem depender de cor).
- **SC-005**: No celular intermediário com conexão 4G, o shell fica utilizável em ≤ 2 s após
  abrir o app instalado, e a troca entre seções responde em ≤ 300 ms (percepção imediata).
- **SC-006**: Uma tela de exemplo montada só com componentes do catálogo passa na verificação
  de fundamentos com 0 valores visuais fora do sistema.
- **SC-007**: Navegação completa do catálogo e do shell é possível só com teclado e só com
  leitor de tela (testado em pelo menos um leitor de tela de celular e um de desktop).
- **SC-008**: Nenhuma rolagem horizontal ou sobreposição de conteúdo entre 320px e 1920px de
  largura e com texto a 200%.
- **SC-009**: Na revisão da pré-visualização, o Doug aprova a identidade visual e os padrões de
  valor/data sem pedir mudanças estruturais (no máximo ajustes finos).

## Clarifications

### Session 2026-10-02

- Q: Qual direção visual/paleta da marca Prumo? → A: Sóbria e calma — verde-petróleo/azul
  profundo como cor da marca, neutros quentes, verde suave para entrada e terracota suave para
  saída (FR-002).
- Q: Quais destinos compõem a navegação principal? → A: Início · Extrato · Planejamento
  (cartões, orçamento, metas, projeção) · Investimentos · Mais (contas e conexões, importações,
  alertas, ajustes, exportação) (FR-007).
- Q: O modo privacidade (ocultar valores) entra já nesta feature? → A: Sim, completo: botão no
  cabeçalho e em Ajustes, persistido no aparelho e respeitado por todo componente de valor
  (FR-031).

### Remediação pós-analyze 2026-10-05

Ajustes de requisito vindos do `/speckit-analyze` e das decisões transversais da onda 1
(sem renumerar FRs; reaprovação no Gate 2 junto com plan + tasks):

- FR-012: o selo de demonstração vale para **todas** as telas, inclusive fora do shell
  (entrada/login da 006, "sem conexão", "não encontrada") — fica no layout raiz (ADR 0006).
- FR-008: o mapa de navegação lista também as telas fora do shell e suas donas
  (`/entrar`, `/entrar/codigo`, `/desbloquear` → 006; `/~offline` → 001; 404 raiz → 003). A tela
  de segurança da conta fica em `/mais/seguranca` (decisão do Doug, D-B).
- FR-032: o item de transação mostra a natureza (entre contas, pagamento de fatura, estorno) e
  o valor na moeda original — alinhado ao modelo da 004 sem alterá-la.
- FR-035, FR-036 e FR-044 tiveram o texto alterado por decisão do Doug (2026-10-05) para
  coincidir com os contratos: nova origem "fonte" no selo (existe no modelo da 004); ícone e
  cor de categoria por mapa fixo da 003 por categoria de 1º nível (subcategorias herdam;
  sem mapeamento → neutro); "seleção longa" = mais de 7 opções. Ver contracts/components.md
  e data-model §1.4 e §5.
- Edge cases novos: endereço inexistente (404 em português com o visual do app) e telas fora do shell.

## Assumptions

- A biblioteca de interface definida na constitution será a base dos componentes; detalhes
  ficam no plano.
- Ícones e fontes usados são gratuitos e de licença aberta, servidos pelo próprio app (sem
  dependência de serviço externo em tempo de execução).
- Preferências de tema e de modo privacidade ficam no aparelho; sincronização entre aparelhos
  fica fora de escopo (pode ser revista após a feature 006 Login).
- Valores monetários chegam aos componentes já em centavos inteiros, com sinal (negativo =
  saída), conforme Constitution III e o modelo da feature 004; a decisão de "entrada" ou
  "saída" vem do sinal.
- Saídas usam cor semântica de "saída" (tom avermelhado/terroso suave, não alarmante) e
  entradas a cor de "entrada" (tom verde suave), conforme FR-002.
- Gráficos (barras, linhas, pizza) ficam fora desta feature; a feature 017 (dashboard) os
  define usando os fundamentos daqui.
- Tela de login é da feature 006; esta feature apenas garante que o shell não exige login para
  existir.
- Central de notificações (024) e chat (030) não ganham espaço reservado agora; o mapa de
  navegação (FR-008) indica onde entrarão.
- O catálogo é uma área do próprio app (não um site separado), restrita a `local`/`preview`.
- Idioma `pt-BR` e fuso `America/Sao_Paulo` como padrão (herdados da 001).
- A PWA base (instalação, página "sem conexão") é da feature 001; esta feature aplica a
  identidade visual a ela.
