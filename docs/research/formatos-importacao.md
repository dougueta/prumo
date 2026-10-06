# Research: Formatos de Importação de Extratos e Faturas (R2)

> **Data da pesquisa**: 05 de outubro de 2026  
> **Autor**: Gemini (Deep Research)  
> **Alimenta as features**: `009 · importacao-csv-ofx`, `010 · importacao-pdf-fatura`, `011 · deduplicacao`, `016 · transferencias-internas`, `018 · faturas-cartao`  
> **Formato de entrega**: Conforme padronizado em `docs/gemini-handoff.md`

---

## 1. Resumo (5 linhas)

Caixa, Mercado Pago e PicPay disponibilizam extratos de conta em formatos estruturados (OFX e CSV), enquanto para cartão de crédito o C6 Bank (Pessoa Física) e a Caixa exportam precipuamente faturas em **PDF**.
No Brasil, arquivos OFX tipicamente utilizam codificação **ISO-8859-1 (Latin1)** no padrão OFX 1.x (SGML não fechado), enquanto CSVs variam entre separador ponto-e-vírgula (`;`) e vírgula (`,`) com separador decimal em vírgula.
Os PDFs de faturas de C6 e Caixa frequentemente possuem proteção por senha padrão (6 dígitos do CPF ou 4 dígitos do cartão) e segregam lançamentos nacionais de internacionais.
Parcelamentos são demarcados por padrões de sufixo como `(03/10)` ou `03/10`, compras em moeda estrangeira incluem cotação cambial associada a linhas de IOF (3,5%), e pagamentos/estornos entram com sinal de crédito.
A arquitetura de ingestão deve contar com um parser determinístico tolerante a encodings para CSV/OFX (Feature 009) e extração visual via Gemini 3.8 Flash para PDFs de fatura (Feature 010).

---

## 2. Achados Detalhados

### 2.1 Matriz de Exportação por Instituição do Doug

| Instituição | Produto | Formatos Disponíveis | Onde Exportar | Particularidades / Quirks |
|---|---|---|---|---|
| **Caixa Econômica Federal** | Conta Corrente / Poupança | **OFX**, TXT, PDF | Internet Banking (Desktop) $\rightarrow$ *Extrato por Período* $\rightarrow$ *Gerar Arquivo para Gerenciadores*. | OFX 1.02 em **ISO-8859-1**; descrição com códigos bancários (`DEB PIX`, `CRED TEF`). |
| **Caixa Econômica Federal** | Cartão de Crédito | **PDF** | App Cartões CAIXA / Internet Banking $\rightarrow$ *Faturas Fechadas*. | Geralmente sem senha no app; histórico de até 40 meses; compras e parcelas listadas por cartão. |
| **C6 Bank** | Conta Corrente | **PDF** (PF) / OFX, CSV (PJ) | App C6 $\rightarrow$ *Extrato* $\rightarrow$ *Exportar Extrato* (enviado para o e-mail). | No app de Pessoa Física, a exportação nativa é exclusivamente em **PDF** protegido por senha. |
| **C6 Bank** | Cartão de Crédito | **PDF** | App C6 $\rightarrow$ *Cartões* $\rightarrow$ *Fatura* $\rightarrow$ *Baixar Fatura* (ou e-mail). | Arquivo PDF protegido por senha (6 primeiros dígitos do CPF). É a maior concentração de gastos do Doug. |
| **Mercado Pago** | Carteira / Conta | **CSV**, XLSX, PDF | Portal Web $\rightarrow$ *Relatórios e Faturamento* (ou App $\rightarrow$ *Atividade*). | CSV configurável em **UTF-8**, separador vírgula ou ponto-e-vírgula, fuso Horário de Brasília (GMT-3). |
| **PicPay** | Carteira / Conta | **CSV**, PDF | App PicPay $\rightarrow$ *Extrato* $\rightarrow$ *Baixar Extrato* $\rightarrow$ *Gerar Extrato*. | Gera arquivo CSV ou PDF enviado por e-mail; histórico detalhado nativo a partir de 2025. |

---

### 2.2 Estrutura e Parsing de Arquivos de Extrato (Feature 009)

#### A. Padrão OFX (Caixa Econômica Federal)
- **Versão**: OFX 1.02 (formato SGML textual legatário, anterior ao XML).
- **Encoding**: Quase universalmente `ISO-8859-1` / `Windows-1252` em bancos brasileiros. O parser não pode assumir `UTF-8` sob risco de quebrar acentuação (`TRANSFERÊNCIA`, `DÉBITO`).
- **Tags Abertas sem Fechamento**: No OFX 1.x, tags não possuem fechamento correspondente:
  ```sgml
  <STMTTRN>
  <TRNTYPE>DEBIT
  <DTPOSTED>20261005120000[-03:EST]
  <TRNAMT>-150.00
  <FITID>202610050001827361
  <MEMO>PAGTO ELETRON COBRANCA
  </STMTTRN>
  ```
- **Identificador Único (`FITID`)**: O campo `<FITID>` é o identificador fornecido pelo banco e deve ser utilizado diretamente como `external_id` para garantir a idempotência (Constitution IV).
- **Datas**: Formato `YYYYMMDDHHMMSS` ou `YYYYMMDD`. Converter para `DATE` no fuso `America/Sao_Paulo`.

#### B. Padrão CSV (Mercado Pago e PicPay)
- **Separadores**:
  - Delimitador de campos: Pode ser `;` (padrão regional brasileiro) ou `,`. O parser deve detectar o delimitador inspecionando a linha de cabeçalho.
  - Separador decimal: Vírgula (ex.: `1.250,50` ou `1250,50`) ou ponto (`1250.50`). Converter estritamente para inteiro em centavos (`125050` centavos).
- **Representação de Sinais**:
  - Mercado Pago e PicPay costumam separar o sinal pela coluna `Tipo de Operação` ou trazer o valor com sinal explícito (`-` para saídas, `+` para entradas).
  - O parser precisa normalizar para valores com sinal: **negativo para saídas, positivo para entradas** (Constitution III).
- **BOM (Byte Order Mark)**: Arquivos CSV gerados no Excel/Windows costumam iniciar com UTF-8 BOM (`\uFEFF`), que precisa ser removido antes de ler a primeira coluna de cabeçalho.

---

### 2.3 Estrutura Detalhada dos PDFs de Fatura de Cartão (Feature 010)

Como o **C6 Bank** (principal cartão de gastos) e a **Caixa** disponibilizam faturas em PDF para clientes pessoa física, a extração via IA (Gemini 3.8 Flash multimodal) é a peça central.

#### A. Cabeçalho e Metadados da Fatura
Toda fatura contém 5 valores mestres fundamentais:
1. **Data de Vencimento** (ex.: `10/11/2026`).
2. **Data de Fechamento / Corte** (ex.: `03/11/2026`).
3. **Valor Total da Fatura** (em centavos).
4. **Pagamento Mínimo** (em centavos).
5. **Melhor Dia de Compra** ou limite total de crédito.

#### B. Seções Típicas de Lançamentos
1. **Resumo / Pagamentos Anteriores**:
   - `PAGAMENTO RECEBIDO` ou `PAGAMENTO FICHA COMPENSACAO` (com sinal negativo ou indicado como crédito).
   - Identifica a liquidação da fatura anterior para alimentar a Feature 016 (Transferências Internas).
2. **Despesas Nacionais (Titular e Adicionais)**:
   - Formato por linha: `[Data] [Descrição / Estabelecimento] [Valor]`.
   - Pode haver divisão por cartões físicos e virtuais.
3. **Parcelamentos de Compras**:
   - Padrão textual mais comum:
     - `AMAZON.COM.BR (03/10)`
     - `MAGALU 02/06`
     - `MERCADOLIVRE PARC 05/12`
   - O extrator deve identificar:
     - `currentInstallment`: 3
     - `totalInstallments`: 10
     - Descrição limpa do estabelecimento: `AMAZON.COM.BR`
4. **Compras Internacionais e IOF**:
   - Estrutura comum no C6 Bank e Caixa:
     - Linha 1 (Compra): Data, estabelecimento, valor original em moeda estrangeira (ex.: `USD 24.90`), taxa de câmbio PTAX/spread (ex.: `1 USD = R$ 5,4200`) e valor final convertido em BRL (ex.: `R$ 134,96`).
     - Linha 2 (Tributo): Linha associada com o `IOF COMPRA INTERNACIONAL` (alíquota padrão de 3,5% sobre o valor convertido, ex.: `R$ 4,72`).
   - A extração deve vincular o IOF ou registrá-lo como lançamento de tarifa associado.
5. **Estornos e Créditos**:
   - Apresentados com sinal negativo (`-R$ 89,90`), cor diferenciada no app ou texto explícito (`ESTORNO COMPRA`, `CANCELAMENTO`).
   - O valor deve ser abatido do saldo total da fatura.
6. **Encargos, Juros e Anuidades**:
   - Lançamentos de anuidade, encargos de refinanciamento rotativo, juros e multas por atraso.

---

## 3. Limitações e Riscos

1. **Proteção por Senha nos PDFs**:
   - PDFs de faturas de C6 e Caixa são frequentemente criptografados com senha padrão (primeiros 6 dígitos do CPF do titular).
   - Se o usuário fizer upload do arquivo protegido diretamente, a API do Gemini ou bibliotecas de parsing falharão ao ler o documento sem a senha.
   - *Mitigação*: Na tela de upload da Feature 010, se o arquivo estiver bloqueado, solicitar a senha ao usuário na sessão para descriptografar em memória (usando `pdf-lib` no Node.js) antes de enviar para extração. Nunca persistir essa senha no banco de dados.
2. **Ambiguidade de Nomes de Estabelecimentos**:
   - Estabelecimentos físicos muitas vezes aparecem truncados ou com prefixos de maquininha (`PAG*`, `MP*`, `STONE*`, `IFOOD*IFOOD`). O modelo de IA deve extrair a descrição fiel do extrato para preservar a rastreabilidade da fonte original.
3. **Encoding Corrompido em CSV**:
   - Abrir um arquivo ISO-8859-1 com leitor UTF-8 resulta em caracteres corrompidos (`PARC CRDITO`).
   - *Mitigação*: Detectar charset automaticamente ou usar fallback com biblioteca robusta (`iconv-lite` ou `chardet`).
4. **Conflito de Deduplicação (Open Finance vs. Arquivo)**:
   - Se a transação do C6 Bank foi sincronizada via Pluggy (Open Finance) e depois o Doug fizer o upload do PDF da fatura do mesmo mês, os registros duplicarão se não houver correlação.
   - *Mitigação*: A Feature 011 (Deduplicação) precisará correlacionar data idêntica, valor em centavos e semelhança textual de descrição, mantendo a fatura como detalhamento auditável.

---

## 4. Recomendações Técnicas para as Specs 009 e 010

1. **Estratégia da Feature 009 (CSV/OFX)**:
   - **Parser OFX**: Utilizar biblioteca padrão de parsing OFX SGML/XML (como `node-ofx-parser` ou parser leve em TypeScript) com decodificação forçada para `ISO-8859-1` quando ausente flag UTF-8.
   - **Parser CSV**: Implementar mapeamento assistido de colunas: o usuário vê uma pré-visualização das 3 primeiras linhas e confirma as colunas de Data, Descrição e Valor.
   - **Sanitização Monetária**: Criar função utilitária `parseMonetaryToCents(valueString: string): bigint` que lida transparentemente com formatos `R$ 1.234,56`, `-1234.56` e `1234,56 D`.
2. **Estratégia da Feature 010 (PDF de Fatura)**:
   - **Remoção de Senha Pré-Envio**: Utilizar biblioteca `pdf-lib` no servidor para checar se o PDF está criptografado. Se sim, desbloquear em memória usando a senha fornecida pelo Doug no fluxo.
   - **Prompt Multimodal no Gemini 3.8 Flash**: Passar o PDF diretamente com `response_schema` tipado (Zod/JSON Schema) exigindo a decomposição de:
     - Instituição e datas (vencimento, fechamento).
     - Itens com valor em centavos (`amountCents`).
     - Metadados de parcelas (`installmentCurrent`, `installmentTotal`).
     - Sinal booleano `isCredit` (para pagamentos e estornos).
3. **Auditoria de Importação (Constitution IV)**:
   - Cada importação gera um registro na tabela `import_batches` (arquivo original, hash SHA-256 do arquivo, data, contagem de linhas).
   - Toda transação gravada referencia seu `import_batch_id` para possibilitar desfazimento (*rollback*) de lote completo em caso de engano.

---

## 5. Fontes Consultadas

1. **Caixa Econômica Federal — Gerenciamento e Extrato por Período**:  
   [https://www.caixa.gov.br](https://www.caixa.gov.br) — Acessado em 05/10/2026.
2. **C6 Bank — Central de Ajuda: Exportação de Extrato e Fatura**:  
   [https://www.c6bank.com.br/ajuda](https://www.c6bank.com.br/ajuda) — Acessado em 05/10/2026.
3. **Mercado Pago — Relatórios de Movimentação e Extratos**:  
   [https://www.mercadopago.com.br/ajuda](https://www.mercadopago.com.br/ajuda) — Acessado em 05/10/2026.
4. **PicPay — Central de Ajuda: Como Baixar e Exportar Extrato**:  
   [https://meajuda.picpay.com/](https://meajuda.picpay.com/) — Acessado em 05/10/2026.
5. **Open Financial Exchange (OFX) — Specification 1.02 & 2.x**:  
   [https://financialdataexchange.org/ofx](https://financialdataexchange.org/ofx) — Acessado em 05/10/2026.
6. **Receita Federal / Banco Central do Brasil — Alíquotas e Regras de IOF em Operações de Câmbio**:  
   [https://www.gov.br/receitafederal](https://www.gov.br/receitafederal) — Acessado em 05/10/2026.

