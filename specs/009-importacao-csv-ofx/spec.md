# Feature Specification: Importação manual CSV/OFX

**Feature Branch**: `009-importacao-csv-ofx`
**Created**: 2026-10-10
**Status**: Draft
**Iniciativa**: 2 · Contas e conexões
**Onda**: 2
**Agente**: Claude (revisor: Gemini)
**Dependências**: 004 (modelo-dados-core — contas, transações, lotes de importação, idempotência,
desfazer lote), 006 (login — só o Doug importa)
**Input**: "Importação manual de extratos e faturas em CSV/OFX com mapeamento de colunas e
pré-visualização antes de gravar."

## Contexto

Enquanto o Open Finance (007/008) não está disponível — e como plano B permanente quando ele
falhar —, o Doug precisa colocar no Prumo as movimentações reais das contas dele a partir dos
arquivos que os bancos já exportam. Pela pesquisa R2 (`docs/research/formatos-importacao.md`):

| Instituição | Produto | Arquivo disponível |
|---|---|---|
| Caixa | Conta | **OFX** (1.x, acentuação no padrão antigo Latin-1) |
| Mercado Pago | Conta/carteira | **CSV** (vírgula ou ponto-e-vírgula) |
| PicPay | Carteira | **CSV** |
| C6 e Caixa | Cartão de crédito | só PDF → fora desta feature (010) |

Esta feature cobre **ler o arquivo, entender as colunas, mostrar o que vai entrar e gravar com
a confirmação do Doug**. As regras de gravação — lote com impressão digital, não duplicar na
reimportação, preservar edições manuais, desfazer lote — já são da 004 e são **consumidas**, não
redefinidas, aqui. A deduplicação entre fontes diferentes (Pluggy × arquivo) é da 011.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importar um extrato OFX (Priority: P1)

O Doug baixa o extrato OFX da conta Caixa, escolhe a conta no Prumo, envia o arquivo, vê a
lista de lançamentos que serão gravados (com quantos são novos e quantos já existem) e confirma.
As transações aparecem na conta com data, valor e descrição original corretos, acentos inclusos.

**Why this priority**: OFX é estruturado (não exige mapeamento) e cobre a conta principal do
Doug; é o caminho mais curto até ter dados reais no app.

**Independent Test**: com um OFX sintético em Latin-1 (gerador de dados sintéticos), importar
numa conta de teste e verificar contagem, valores em centavos, datas no fuso de São Paulo,
acentos e vínculo de cada transação ao lote; reimportar o mesmo arquivo e verificar zero novas.

**Acceptance Scenarios**:

1. **Given** uma conta existente e um OFX válido com 40 lançamentos, **When** o Doug envia o
   arquivo, **Then** vê a pré-visualização com 40 linhas (data, descrição, valor com sinal,
   indicação "nova" ou "já existe") e o total de entradas, saídas e saldo do período, sem nada
   gravado ainda.
2. **Given** a pré-visualização, **When** o Doug confirma, **Then** as 40 transações são gravadas
   num único lote com origem `ofx`, cada uma com o identificador do banco como id externo, e ele
   vê o resumo "40 novas · 0 já existentes · 0 com erro".
3. **Given** o mesmo arquivo já importado, **When** o Doug o envia de novo, **Then** é avisado de
   que o arquivo já foi importado (data e conta do lote anterior) e, se confirmar mesmo assim,
   nenhuma transação nova é criada.
4. **Given** um OFX com acentos codificados no padrão antigo, **When** importado, **Then**
   "TRANSFERÊNCIA" e "DÉBITO" aparecem corretamente, nunca como caracteres corrompidos.
5. **Given** a pré-visualização, **When** o Doug cancela, **Then** nada é gravado e nenhum lote
   é criado.

---

### User Story 2 - Importar um CSV com mapeamento de colunas (Priority: P1)

O Doug envia o CSV do Mercado Pago ou do PicPay. O Prumo detecta separador e formato numérico,
mostra as primeiras linhas e propõe quais colunas são data, descrição e valor (ou entrada/saída
separadas, ou valor + coluna de tipo). O Doug ajusta se precisar, vê a pré-visualização já
convertida e confirma.

**Why this priority**: duas das três contas do Doug só exportam CSV; sem isso a visão
consolidada não existe.

**Independent Test**: com CSVs sintéticos nos formatos do Mercado Pago e do PicPay (vírgula,
ponto-e-vírgula, decimal com vírgula, marca de início de arquivo do Excel), mapear, importar e
conferir valores em centavos e sinais; reimportar e verificar zero novas.

**Acceptance Scenarios**:

1. **Given** um CSV com separador `;` e valores `1.250,50`, **When** enviado, **Then** o Prumo
   detecta o separador e o formato decimal e a pré-visualização mostra R$ 1.250,50 (125050
   centavos), não R$ 1,25 nem R$ 125.050,00.
2. **Given** um CSV cujo cabeçalho não é reconhecido, **When** enviado, **Then** o Doug vê as 5
   primeiras linhas e escolhe as colunas de data, descrição e valor (ou entrada/saída, ou valor
   + tipo), além do formato da data, antes de ver a pré-visualização.
3. **Given** um mapeamento confirmado para a conta Mercado Pago, **When** o Doug importa outro
   CSV com o mesmo cabeçalho nessa conta, **Then** o mapeamento é reaplicado automaticamente e
   ele vai direto para a pré-visualização (podendo editar).
4. **Given** um CSV em que saídas vêm positivas com uma coluna "Tipo" = "Débito", **When**
   mapeado como "valor + tipo", **Then** saídas ficam negativas e entradas positivas.
5. **Given** um CSV sem identificador por linha com dois lançamentos idênticos (mesma data,
   valor e descrição), **When** importado, **Then** ambos são gravados; **When** reimportado,
   **Then** nenhum dos dois duplica (identidade determinística da 004).

---

### User Story 3 - Revisar problemas antes de gravar (Priority: P2)

Algumas linhas não fazem sentido (data inválida, valor vazio, linha de saldo/total no meio do
arquivo). O Doug vê essas linhas destacadas com o motivo, pode desmarcar linhas que não quer
importar e grava só o que está certo.

**Why this priority**: extratos reais trazem linhas de saldo, cabeçalhos repetidos e rodapés;
sem isso a importação falha inteira ou grava lixo.

**Independent Test**: CSV sintético com 3 linhas inválidas e 2 linhas de "SALDO DO DIA";
verificar que aparecem destacadas, que não são gravadas e que o resumo final as contabiliza.

**Acceptance Scenarios**:

1. **Given** um arquivo com linhas inválidas, **When** pré-visualizado, **Then** cada uma aparece
   marcada com o motivo ("data inválida", "valor ausente"…) e não é selecionável.
2. **Given** linhas de saldo/total reconhecidas pela descrição, **When** pré-visualizadas,
   **Then** vêm desmarcadas por padrão com o motivo "parece linha de saldo", e o Doug pode
   remarcá-las.
3. **Given** o Doug desmarca 3 linhas válidas, **When** confirma, **Then** só as marcadas são
   gravadas e o resumo informa "3 ignoradas por você".
4. **Given** um arquivo em que nenhuma linha é válida, **When** enviado, **Then** a confirmação
   fica indisponível e o Doug vê uma mensagem explicando o provável problema (formato errado,
   arquivo de outro banco, mapeamento incorreto).

---

### User Story 4 - Ver e desfazer importações (Priority: P2)

O Doug vê a lista das importações feitas (data, conta, arquivo, contagens, situação) e pode
desfazer uma importação errada — por exemplo, um CSV importado na conta errada.

**Why this priority**: importar na conta errada é o erro mais provável; desfazer evita limpar
transação por transação. A regra de desfazer é da 004; aqui está a tela.

**Independent Test**: importar um arquivo sintético na conta errada, desfazer pela lista e
verificar que as transações somem do extrato e o lote fica "desfeito"; reimportar na conta
certa.

**Acceptance Scenarios**:

1. **Given** importações concluídas, **When** o Doug abre o histórico, **Then** vê cada uma com
   data/hora, conta, nome do arquivo, formato, contagens (novas, já existentes, com erro,
   ignoradas) e situação.
2. **Given** uma importação concluída, **When** o Doug a desfaz e confirma, **Then** a 004 aplica
   o desfazer e a lista mostra "desfeito", com o aviso de quantas transações tinham edições
   manuais.

---

### User Story 5 - Experimentar no modo demonstração (Priority: P3)

Nas pré-visualizações (sem banco), o Doug ou o revisor consegue fazer o fluxo completo com
arquivos de exemplo sintéticos oferecidos pela própria tela, com o selo "Demonstração — dados
fictícios", sem persistir nada além da sessão de demonstração.

**Why this priority**: exigência da Constitution (modo demonstração) e forma de revisar a
feature sem dados reais.

**Independent Test**: abrir uma pré-visualização, importar o OFX e o CSV de exemplo e ver o
resultado no extrato de demonstração.

**Acceptance Scenarios**:

1. **Given** o modo demonstração, **When** o Doug abre a importação, **Then** vê os arquivos de
   exemplo (um OFX estilo Caixa, um CSV estilo Mercado Pago, um CSV estilo PicPay) e pode
   importá-los com o mesmo fluxo.

---

### Edge Cases

- **Arquivo vazio, corrompido ou de outro tipo** (PDF, imagem, XLSX renomeado) → mensagem clara
  ("este arquivo não é um OFX/CSV legível"); nada gravado.
- **Arquivo acima do limite** (FR-014) → recusado antes do envio, com a sugestão de exportar um
  período menor.
- **OFX com várias contas** dentro do mesmo arquivo → o Doug escolhe qual conta do arquivo
  importar para qual conta do Prumo; as demais são ignoradas.
- **OFX cuja conta (agência/número) não confere** com a conta escolhida → aviso antes da
  pré-visualização, com opção de continuar.
- **Datas fora do período esperado** (futuras ou anteriores a 10 anos) → linha marcada como
  suspeita, mas selecionável.
- **Formato de data ambíguo** (`03/04/2026`) → padrão brasileiro dia/mês; o Doug pode trocar no
  mapeamento.
- **Valores com `R$`, espaços, `D`/`C` no fim ou parênteses** → normalizados para centavos com
  sinal; o que não puder ser convertido vira linha inválida, nunca valor aproximado.
- **Arquivo sobreposto a uma importação anterior** (períodos que se cruzam) → as transações já
  existentes aparecem como "já existe"; só as novas são gravadas.
- **Importação interrompida** (queda de conexão durante a gravação) → o lote fica "falhou" com
  contadores parciais (regra da 004); reenviar o arquivo completa sem duplicar.
- **Transação já importada e editada manualmente** → aparece como "já existe" e a edição do Doug
  é preservada (regra da 004).
- **Conta de cartão de crédito** com CSV em que compras vêm positivas → o mapeamento permite
  inverter o sinal ("valores positivos são gastos").

## Requirements *(mandatory)*

### Functional Requirements

**Envio e leitura**

- **FR-001**: O Doug MUST poder iniciar uma importação escolhendo uma conta existente (ou criando
  uma nova pelo fluxo de contas da 004) e selecionando um arquivo, no computador ou no celular.
- **FR-002**: O sistema MUST aceitar arquivos OFX (versões 1.x e 2.x) e CSV, identificando o
  formato pelo conteúdo, não só pela extensão.
- **FR-003**: O sistema MUST ler corretamente arquivos com acentuação no padrão antigo (Latin-1 /
  Windows-1252) e em UTF-8, com ou sem marca de início de arquivo, sem corromper caracteres.
- **FR-004**: Para CSV, o sistema MUST detectar o separador de campos (`;`, `,` ou tabulação) e o
  formato numérico (decimal com vírgula ou ponto, com ou sem separador de milhar).

**Mapeamento (CSV)**

- **FR-005**: O sistema MUST propor automaticamente o mapeamento das colunas quando reconhecer o
  cabeçalho (ao menos os formatos do Mercado Pago e do PicPay) e permitir que o Doug o ajuste.
- **FR-006**: O mapeamento MUST suportar três formas de valor: coluna única com sinal; colunas
  separadas de entrada e saída; coluna de valor + coluna de tipo (crédito/débito). Também MUST
  permitir inverter o sinal e escolher o formato da data.
- **FR-007**: O sistema MUST lembrar o último mapeamento confirmado por conta e cabeçalho e
  reaplicá-lo automaticamente em importações futuras com o mesmo cabeçalho.

**Pré-visualização e confirmação**

- **FR-008**: Antes de gravar qualquer coisa, o sistema MUST mostrar a pré-visualização de todas
  as linhas com data, descrição original, valor com sinal e situação (nova, já existe, inválida
  com motivo, desmarcada com motivo), além dos totais de entradas, saídas e saldo do período e
  da contagem por situação.
- **FR-009**: O Doug MUST poder desmarcar linhas válidas e remarcar linhas que o sistema
  desmarcou por parecerem saldo/total; linhas inválidas não podem ser marcadas.
- **FR-010**: Nada MUST ser gravado (nem lote, nem transação) até o Doug confirmar; cancelar ou
  abandonar a tela descarta tudo.
- **FR-011**: Ao confirmar, o sistema MUST gravar as linhas marcadas em um único lote da 004, com
  origem `ofx` ou `csv`, impressão digital do arquivo, id externo do banco quando existir (OFX) e
  identidade determinística quando não existir (CSV), usando exclusivamente o contrato da 004.
- **FR-012**: Ao final, o sistema MUST mostrar o resumo: novas, já existentes, com erro e
  ignoradas pelo Doug, com atalho para ver as transações no extrato.
- **FR-013**: Se a impressão digital do arquivo coincidir com um lote anterior não desfeito, o
  sistema MUST avisar (data e conta do lote anterior) antes da pré-visualização.

**Limites, privacidade e segurança**

- **FR-014**: O sistema MUST aceitar arquivos de até 5 MB e até 10.000 lançamentos por
  importação, recusando arquivos maiores antes do envio com uma orientação clara.
- **FR-015**: Só o Doug autenticado (006) MUST poder importar, ver o histórico e desfazer; as
  transações gravadas pertencem a ele (regra de dono da 004).
- **FR-016**: O arquivo original MUST ser descartado depois do processamento; o sistema guarda
  apenas nome do arquivo, formato, tamanho, impressão digital e contadores do lote.
- **FR-017**: Conteúdo dos arquivos (descrições, valores, números de conta) MUST NOT aparecer em
  logs, mensagens de erro técnicas ou ferramentas de monitoramento; os erros referenciam a linha
  pelo número.

**Histórico**

- **FR-018**: O Doug MUST poder ver a lista de importações (data/hora, conta, arquivo, formato,
  contagens, situação), mais recentes primeiro.
- **FR-019**: O Doug MUST poder desfazer uma importação a partir dessa lista, com confirmação; o
  desfazer segue integralmente a regra da 004.

**Modo demonstração**

- **FR-020**: No modo demonstração, a tela MUST oferecer arquivos de exemplo sintéticos (OFX
  estilo Caixa, CSV estilo Mercado Pago, CSV estilo PicPay) e o fluxo completo MUST funcionar
  sem banco, gravando só na sessão de demonstração.
- **FR-021**: O gerador de dados sintéticos MUST produzir arquivos OFX e CSV nesses formatos (com
  acentos em Latin-1, separadores e decimais brasileiros, linhas de saldo e linhas inválidas)
  para testes e demonstração; nenhum arquivo real entra no repositório.

### Key Entities *(include if feature involves data)*

- **Perfil de mapeamento** (dono: 009): o mapeamento confirmado de um CSV para uma conta —
  assinatura do cabeçalho, coluna de data e formato, coluna de descrição, forma do valor e
  colunas envolvidas, inversão de sinal, separador e formato decimal. Um por conta + cabeçalho;
  atualizado a cada confirmação.
- **Lote de importação** (dono: 004): consumido. Recebe origem, impressão digital, nome, formato,
  tamanho e contadores; situação controlada pela 004.
- **Transação** (dono: 004): consumida. Gravada só pelo contrato da 004 (origem, id externo ou
  identidade determinística, lote, descrição original, valor em centavos, data em São Paulo).
- **Conta** (dono: 004): consumida; destino da importação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O Doug importa um extrato mensal OFX da Caixa — do arquivo baixado até o resumo
  final — em menos de 1 minuto.
- **SC-002**: Na primeira importação de um CSV do Mercado Pago ou do PicPay, o mapeamento
  proposto está correto sem ajuste; nas seguintes, o Doug chega à pré-visualização sem tocar no
  mapeamento.
- **SC-003**: 100% dos valores importados dos arquivos de teste batem, centavo a centavo, com os
  valores esperados, inclusive formatos `1.250,50`, `-1250.50`, `1250,50 D` e `(1.250,50)`.
- **SC-004**: Reimportar qualquer arquivo já importado cria 0 transações novas.
- **SC-005**: 0 caracteres corrompidos nas descrições de arquivos Latin-1 e UTF-8 de teste.
- **SC-006**: Um arquivo de 10.000 lançamentos chega à pré-visualização em até 10 segundos e
  conclui a gravação em até 30 segundos.
- **SC-007**: Nenhum conteúdo de arquivo importado aparece nos logs da aplicação durante a suíte
  de testes.

## Assumptions

- Escopo de formatos: OFX e CSV. XLSX fica fora; o Doug exporta CSV (Mercado Pago oferece os
  dois). PDF de fatura é a feature 010.
- Faturas de cartão em CSV/OFX são suportadas pelo mesmo fluxo se algum banco oferecer, mas não
  há perfil pronto (C6 e Caixa só exportam PDF).
- Formato de data padrão é dia/mês/ano; datas convertidas para o fuso de São Paulo.
- Linhas "parecem saldo/total" são reconhecidas por descrição (ex.: "SALDO", "SALDO DO DIA",
  "SALDO ANTERIOR", "TOTAL") — heurística ajustável no plano.
- Saldo informado pelo banco no OFX, quando existir, é mostrado como informação na
  pré-visualização, sem bloquear a importação; conciliação de saldo fica fora do escopo.
- Correspondência entre transações de fontes diferentes (Pluggy × arquivo) é da 011; aqui vale só
  a idempotência dentro da mesma origem definida pela 004.
- Categorização das transações importadas é da 014; aqui elas entram sem categoria (ou com a da
  fonte, se a 004 permitir).
- Custo: R$ 0 — processamento dentro do plano gratuito já usado; nenhum serviço novo.
