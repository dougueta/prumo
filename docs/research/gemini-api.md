# Research: Gemini API para o Prumo (R3)

> **Data da pesquisa**: 05 de outubro de 2026  
> **Autor**: Gemini (Deep Research)  
> **Alimenta as features**: `010 · importacao-pdf-fatura`, `014 · categorizacao-ia`, `030 · chat-financas`  
> **Formato de entrega**: Conforme padronizado em `docs/gemini-handoff.md`

---

## 1. Resumo (5 linhas)

A Gemini API oferece suporte nativo multimodal a PDFs (processados visualmente a ~258 tokens por página) e _Structured Outputs_ com validação estrita de JSON Schema via `response_schema`.
No **Free Tier**, os termos do Google estabelecem explicitamente que dados de entrada (prompts e arquivos) e saída podem ser usados para **treinamento de modelos e avaliados por revisores humanos**.
No **Paid Tier** (Pay-as-you-go com Cloud Billing), os dados **não são usados para treino** nem lidos por humanos, sendo regidos pelo Data Processing Addendum (DPA) do Google Cloud.
Para o volume estimado do Prumo (~500 transações categorizadas + ~3 PDFs de fatura por mês), o consumo é de ~0,16M tokens de entrada e ~0,035M de saída.
O custo financeiro no Paid Tier com modelos Flash/Flash-Lite é residual: entre **$0,14 e $0,25 USD/mês** (aprox. **R$ 0,80 a R$ 1,50/mês**).

---

## 2. Achados Detalhados

### 2.1 Modelos Disponíveis e Recomendados (2026)

| Modelo                                         | Contexto         | Preço Entrada (1M tokens) | Preço Saída (1M tokens) | Caso de uso no Prumo                                                                                               |
| ---------------------------------------------- | ---------------- | ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Gemini 3.5 Flash-Lite** / **3.1 Flash-Lite** | 1.000.000 tokens | $0,25 – $0,30             | $1,50 – $2,50           | **Categorização em lote (014)**: ultra-rápido, baixíssimo custo por transação.                                     |
| **Gemini 3.8 Flash**                           | 1.000.000 tokens | $0,75*                    | $3,75*                  | **Extração de PDF (010)** e **Chat Financeiro (030)**: alta fidelidade visual para faturas complexas e raciocínio. |

_\*Preço promocional introdutório até 31/12/2026; a partir de 01/01/2027 passa a $1,50 / $7,50._  
_(Nota: versões legadas como Gemini 2.0 Flash foram descontinuadas em junho de 2026)._

### 2.2 Entrada de Documentos (PDFs de Faturas)

1. **Processamento Multimodal Nativo**:
   - O Gemini não depende de OCR preliminar por software externo (`pdftotext`, `tesseract`). O motor interpreta as páginas diretamente como dados visuais.
   - Preserva alinhamento de colunas, tabelas de parcelas, datas, valores negativos/estornos e seções de faturas (como compras no exterior e encargos).
2. **Cálculo de Tokens por Página**:
   - Cada página de PDF convertida para análise visual consome **~258 tokens de entrada** (categorizados como modalidade `IMAGE` nos metadados de uso da API).
   - Uma fatura típica brasileira (C6 Bank ou Caixa) tem entre 2 e 6 páginas (~500 a 1.550 tokens por fatura apenas para as imagens das páginas).
3. **Mecanismo de Envio**:
   - **Upload Inline (base64)**: Suporta até 20 MB/50 MB por requisição. Adequado para envio imediato de faturas únicas no fluxo de importação do Next.js via Server Action/API Route.
   - **Files API**: Recomendado se o PDF tiver dezenas de páginas ou se for reutilizado em múltiplas perguntas de análise. Os arquivos ficam armazenados gratuitamente por 48 horas.
4. **Limites Técnicos**:
   - Suporte a até 1.000 páginas por requisição em um único documento PDF.

### 2.3 Saídas Estruturadas (Structured Outputs & JSON Schema)

- Configurado via parâmetros nativos do SDK:
  - `response_mime_type: "application/json"`
  - `response_schema`: Aceita esquema JSON nativo ou modelos de validação (como Pydantic ou schemas Zod compilados).
- **Garantia de Tipagem**: O modelo restringe a amostragem para garantir conformidade sintática estrita com o JSON Schema fornecido, eliminando regex frágeis e falhas de formatação de JSON. A validação semântica das regras de negócio permanece responsabilidade da aplicação (via Zod).
- **Exemplo de Contrato para Fatura (Feature 010)**:
  ```json
  {
    "type": "object",
    "properties": {
      "institution": { "type": "string" },
      "closingDate": { "type": "string" },
      "dueDate": { "type": "string" },
      "totalAmountCents": { "type": "integer" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "date": { "type": "string" },
            "description": { "type": "string" },
            "amountCents": { "type": "integer" },
            "installment": { "type": "string", "nullable": true },
            "categoryHint": { "type": "string", "nullable": true }
          },
          "required": ["date", "description", "amountCents"]
        }
      }
    },
    "required": ["institution", "dueDate", "totalAmountCents", "items"]
  }
  ```
  _(Alinhado com a Constitution III: `amountCents` como inteiro)._

### 2.4 Política de Privacidade: Free Tier vs. Paid Tier

| Critério                       | Free Tier (Unpaid Services)                                                                                                                              | Paid Tier (Pay-as-you-go com Billing ativo)                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Treinamento de Modelos**     | **SIM** — Google usa prompts, arquivos e saídas para treinar e aprimorar seus produtos e modelos.                                                        | **NÃO** — Dados de clientes não são usados para treinar nenhum modelo da Google.                                                                |
| **Revisão Humana**             | **SIM** — Funcionários e revisores contratados podem ler e anotar amostras de dados.                                                                     | **NÃO** — Nenhum acesso humano aos dados em operação regular.                                                                                   |
| **Retenção & Logs**            | Retidos conforme políticas padrão de produto.                                                                                                            | Logs mantidos por até 55 dias apenas para monitoramento automatizado de abuso (Prohibited Use Policy); descartados em seguida.                  |
| **Enquadramento Legal**        | Termos de Serviço de Consumidor / Developer não faturado.                                                                                                | Google Cloud Data Processing Addendum (DPA); Google atua como operador/processador de dados.                                                    |
| **Impacto na Constitution II** | **VIOLAÇÃO GRAVE** — Mesmo anonimizando nomes/CPFs, dados de estabelecimentos e valores reais de consumo seriam ingeridos pela infraestrutura de treino. | **Atende ao não-treinamento**; a minimização de dados continua obrigatória devido à retenção temporária de até 55 dias para auditoria de abuso. |

### 2.5 Limites de Taxa (Rate Limits)

- **Free Tier**:
  - Limites de taxa (RPM, TPM, RPD) variam dinamicamente por modelo e projeto. Devem ser sempre consultados diretamente na página de Rate Limits do [Google AI Studio](https://aistudio.google.com/).
  - Vulnerável a erros `429 RESOURCE_EXHAUSTED` em picos de categorização ou leitura concorrente.
- **Paid Tier**:
  - Limites escaláveis automaticamente (centenas/milhares de RPM e milhões de TPM).
  - Suporte a _Context Caching_ (para reduzir custos de prompts de sistema longos) e _Batch API_ (com 50% de desconto adicional).

### 2.6 Estimativa de Custo Mensal para o Prumo

**Premissas de Uso Mensal**:

- 500 transações/mês categorizadas.
- 3 faturas de cartão em PDF/mês (média de 4 páginas cada = 12 páginas/mês).

#### A. Categorização de Transações (Feature 014)

- **Estratégia**: Envio em lotes (ex.: 25 transações por requisição = 20 chamadas/mês).
  - Entrada por lote: ~1.000 tokens (regras de categorização + lista de transações).
  - Saída por lote: ~500 tokens (JSON com id da transação, categoria atribuída e confiança).
  - Total mensal: 20.000 tokens de entrada (~0,02M) + 10.000 tokens de saída (~0,01M).
- _No pior caso (chamada unitária, 500 requisições)_:
  - Total mensal: ~150.000 tokens de entrada (~0,15M) + 25.000 tokens de saída (~0,025M).

#### B. Extração de PDFs de Faturas (Feature 010)

- 3 faturas × 4 páginas = 12 páginas.
  - Imagens das páginas: 12 × 258 = 3.096 tokens de entrada.
  - Prompt + Schema JSON: ~3.000 tokens de entrada.
  - Saída JSON com itens das faturas (~100 transações por fatura): ~7.500 tokens de saída (~0,0075M).
  - Total mensal para faturas: ~6.100 tokens de entrada (~0,006M) + 7.500 tokens de saída (~0,0075M).

#### C. Totais e Custo Financeiro no Paid Tier

- **Volume total mensal**: ~0,16M tokens de entrada e ~0,035M tokens de saída.
- **Com Gemini 3.5 Flash-Lite**:
  - Entrada: $0,16M \times \$0,30 = \$0,048$
  - Saída: $0,035M \times \$2,50 = \$0,088$
  - **Total**: **~$0,14 USD / mês** (aprox. **R$ 0,80 BRL / mês**).
- **Com Gemini 3.8 Flash** (Preço introdutório até 31/12/2026):
  - Entrada: $0,16M \times \$0,75 = \$0,120$
  - Saída: $0,035M \times \$3,75 = \$0,131$
  - **Total**: **~$0,25 USD / mês** (aprox. **R$ 1,45 BRL / mês**).
- **Com Gemini 3.8 Flash após 01/01/2027** ($1,50 entrada / $7,50 saída):
  - Entrada: $0,16M \times \$1,50 = \$0,240$
  - Saída: $0,035M \times \$7,50 = \$0,263$
  - **Total projetado pós-2027**: **~$0,50 USD / mês** (aprox. **R$ 2,90 BRL / mês**).

---

## 3. Limitações e Riscos

1. **Risco de Vazamento no Free Tier**: Usar o Free Tier com transações reais viola o Princípio II da Constitution. Mesmo mascarando contas bancárias e CPFs, metadados de consumo podem identificar o titular.
2. **Minimização de Dados em PDFs**: Enviar a fatura integral expõe dados cadastrais. A conformidade com a Constitution II exige que cabeçalhos sejam redigidos ou omitidos antes do envio.
3. **Dependência de Formato de Fatura**: Faturas com layouts muito complexos (ex.: compras parceladas internacionais com conversão de câmbio na mesma linha) podem gerar ambiguidades se o prompt/schema não tiver exemplos de _few-shot_.
4. **Depreciação de Modelos**: O Google frequentemente descontinua versões legadas (como ocorreu com o Gemini 2.0 Flash em meados de 2026). A arquitetura do Prumo deve encapsular o modelo atrás do contrato `AiProvider` (Constitution VI e Restrições Técnicas), permitindo atualizar a string do modelo em um único arquivo de configuração.
5. **Prevenção de Gastos Acidentais (Spend Cap Budgets)**: Diferente dos alertas tradicionais de orçamento que apenas notificam por e-mail, o Google Cloud disponibiliza o recurso nativo de **Spend Cap Budgets** (ver `https://cloud.google.com/billing/docs/how-to/budgets-spend-caps`), que **pausa automaticamente o consumo do serviço** ao atingir o teto financeiro definido, e a Gemini API (`generativelanguage.googleapis.com`) está expressamente inclusa na lista de serviços suportados. Esta é a recomendação primária para estabelecer um teto rígido e seguro caso o Paid Tier seja aprovado pelo Doug. Alternativamente, limites rígidos de cota (RPM/RPD) no Cloud Console e desligamento de billing via automação Pub/Sub podem ser mantidos como proteções secundárias.

---

## 4. Recomendações

1. **Aprovação de Exceção de Custo para Produção (Doug / Gate)**:
   - A Constitution (seção Restrições Técnicas) define o "tier gratuito como padrão". Como o Paid Tier fura o teto de R$ 0, qualquer custo recorrente **MUST ser formalmente declarado e aprovado pelo Doug na spec da feature que o introduzir** (Features 010 e 014).
   - Para desenvolvimento local e CI, o custo permanece R$ 0 (usando fixtures e mocks).
2. **Definição da Interface `AiProvider`**:
   - Implementar em `src/lib/ai/provider.ts` uma interface desacoplada:
     ```ts
     export interface AiProvider {
       categorizeBatch(
         transactions: TransactionInput[],
       ): Promise<CategorizationResult[]>;
       extractInvoicePdf(pdfBuffer: Buffer): Promise<InvoiceExtractionResult>;
     }
     ```
   - Isso garante conformidade com a Constitution VI (IA é assistente e substituível).
3. **Utilizar `gemini-3.5-flash-lite` para categorização e `gemini-3.8-flash` para faturas**:
   - Flash-Lite oferece a menor latência e custo para texto puro em lote.
   - Flash normal oferece acurácia superior no entendimento das tabelas e layouts gráficos dos PDFs.
4. **Validação Semântica via Zod e Degradação Suave**:
   - Embora `response_schema` garanta que o formato sintático JSON retornado seja estritamente válido, a validação semântica das regras de negócio (datas no passado, valores positivos de despesa convertidos com sinal negativo) deve continuar sendo feita pelo Zod na aplicação. Falhas da IA devem degradar suavemente (transação sem categoria, fatura para revisão manual) conforme Constitution VI.

---

## 5. Fontes Consultadas

1. **Google AI for Developers — Terms of Service & Data Governance**:  
   [https://ai.google.dev/terms](https://ai.google.dev/terms) — Acessado em 05/10/2026.
2. **Google AI for Developers — Usage & Abuse Policies (Retenção de 55 dias)**:  
   [https://ai.google.dev/gemini-api/terms#usage-policies](https://ai.google.dev/gemini-api/terms#usage-policies) — Acessado em 05/10/2026.
3. **Google AI Studio — Pricing & Quotas**:  
   [https://ai.google.dev/pricing](https://ai.google.dev/pricing) — Acessado em 05/10/2026.
4. **Google Cloud — Vertex AI & Gemini Data Protection FAQ**:  
   [https://cloud.google.com/vertex-ai/docs/generative-ai/data-governance](https://cloud.google.com/vertex-ai/docs/generative-ai/data-governance) — Acessado em 05/10/2026.
5. **Gemini API Documentation — Document Understanding & PDF Input**:  
   [https://ai.google.dev/gemini-api/docs/document-processing](https://ai.google.dev/gemini-api/docs/document-processing) — Acessado em 05/10/2026.
6. **Gemini API Documentation — Structured Outputs (JSON)**:  
   [https://ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output) — Acessado em 05/10/2026.
