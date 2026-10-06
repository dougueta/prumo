# Research: Leitura de Investimentos via Google Sheets API (R4)

> **Data da pesquisa**: 05 de outubro de 2026  
> **Autor**: Gemini (Deep Research)  
> **Alimenta as features**: `025 · carteira-investimentos`, `026 · import-google-sheets`, `027 · evolucao-patrimonial`  
> **Formato de entrega**: Conforme padronizado em `docs/gemini-handoff.md`

---

## 1. Resumo (5 linhas)

A Google Sheets API v4 permite acesso automatizado sem intervenção humana através de uma Conta de Serviço (_Service Account_) do Google Cloud com escopo restrito de somente leitura (`spreadsheets.readonly`).
O modelo de permissões é estritamente isolado: o Doug compartilha apenas a planilha de investimentos com o e-mail da Service Account como "Leitor", impedindo qualquer modificação acidental ou acesso a outros arquivos do Drive.
A cota gratuita é de 300 requisições/minuto por projeto a custo de **R$ 0/mês**, e o Prumo consumirá apenas ~1 a 3 requisições por dia (menos de 0,01% da cota).
Para detecção eficiente de alterações sem consumir leitura completa do grid, combina-se a verificação de `modifiedTime` (Drive API) com o hash criptográfico SHA-256 da matriz de células importadas.
O agendamento ideal utiliza um job diário no GitHub Actions ou Supabase Cron chamando um Route Handler autenticado do Next.js com token `CRON_SECRET`, além de disparo manual sob demanda na UI.

---

## 2. Achados Detalhados

### 2.1 Autenticação e Princípio do Menor Privilégio (_Least Privilege_)

Para respeitar a **Constitution II (Privacidade e Segurança)**:

1. **Conta de Serviço (GCP Service Account)**:
   - Criada no Google Cloud Console com nome representativo (ex.: `prumo-sheets-reader`).
   - Sem permissões em nível de projeto (zero papéis de IAM atribuídos no GCP).
2. **Escopo Restrito**:
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - Opcional: `https://www.googleapis.com/auth/drive.metadata.readonly` (para checar data de modificação sem ler o arquivo).
   - O token gerado **não possui permissão de escrita** nem consegue ler qualquer outro arquivo no Google Drive do Doug.
3. **Compartilhamento Alvo a Alvo**:
   - O Doug cria a planilha (ou utiliza a existente) e clica em _Compartilhar_, adicionando unicamente o e-mail da conta de serviço (`prumo-sheets-reader@<projeto>.iam.gserviceaccount.com`) com a função **Leitor (Viewer)**.
4. **Armazenamento de Credenciais**:
   - As credenciais da Service Account são injetadas exclusivamente no ambiente de servidor:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (chave RSA privada PEM)
     - `GOOGLE_INVESTMENTS_SHEET_ID` (ID alfanumérico contido na URL da planilha)
     - `GOOGLE_INVESTMENTS_SHEET_RANGE` (ex.: `'Carteira!A2:H'`)

### 2.2 Cotas, Limites e Custos

- **Limites da Google Sheets API v4**:
  - **Leitura**: 300 requisições por minuto por projeto (60 requisições por minuto por usuário).
  - **Escrita**: 300 requisições por minuto por projeto.
- **Custo Financeiro**:
  - **R$ 0,00 / mês**. O uso da API do Google Sheets é gratuito dentro das cotas padrão.
  - _Aviso de Política_: A Google anunciou a introdução de faturamento por uso acima das cotas gratuitas mais adiante em 2026 (_"later in 2026"_). Como o volume do Prumo é de apenas ~1 a 3 requisições por dia, o consumo permanecerá 100% dentro da faixa de isenção.
- **Consumo Real no Prumo**:
  - 1 execução diária programada + cliques manuais esporádicos do Doug = **1 a 3 requisições por dia**.
  - Risco de cota nulo em condições normais.

### 2.3 Estratégia de Detecção de Mudanças

Para evitar reprocessar a planilha caso não haja novos aportes ou atualizações de cotações:

```text
[Cron / Ação Manual]
         |
         v
1. Consulta Drive API (metadata): modifiedTime da planilha
         |
         +---> modifiedTime == last_modified_time? ---> SIM: Retorna 200 (sem alterações, 0 writes no banco)
         |
        NÃO
         v
2. GET /v4/spreadsheets/{id}/values/{range}
         v
3. Calcula SHA-256(JSON.stringify(rows))
         |
         +---> hash == last_content_hash? -------------> SIM: Atualiza last_modified_time e encerra
         |
        NÃO
         v
4. Parseia ativos/posições e grava lote com snapshot (Constitution IV)
```

1. **Camada 1 (Drive Metadata)**:
   - A chamada `drive.files.get(fileId, { fields: 'modifiedTime' })` retorna o timestamp UTC da última edição. Se o `modifiedTime` for idêntico ao `last_modified_time` guardado no banco no último processamento, encerra sem baixar a grade de células.
2. **Camada 2 (Hash de Conteúdo SHA-256)**:
   - Caso o `modifiedTime` tenha mudado (por exemplo, Doug abriu e fechou a planilha ou recalculou uma fórmula volátil como `=TODAY()`), calcula-se o hash SHA-256 do payload de valores. Se os dados financeiros forem idênticos, o processo não gera novos registros no banco de dados.

### 2.4 Agendamento: Supabase Cron vs. GitHub Actions vs. Route Handler

| Abordagem                                      | Vantagens                                                                                                                                               | Desvantagens                                                                                                                                        | Recomendação                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A. Next.js API Route + GitHub Actions Cron** | • Todo o código TypeScript de domínio reside no Next.js (`src/`).<br>• Zero infraestrutura extra (mesmo mecanismo do `keepalive.yml`).<br>• Custo R$ 0. | Disparo depende do scheduler do GitHub Actions.<br>• _Risco_: Workflows agendados são desativados automaticamente após 60 dias sem commits no repo. | **Altamente Recomendada** (com keepalive ativo)         |
| **B. Supabase Edge Function (Deno) + pg_cron** | • Execução interna próxima ao banco de dados Postgres.<br>• Precisão de segundos via `pg_cron`.                                                         | • Exige duplicar tipos e SDKs em ambiente Deno / TypeScript separado.<br>• Edge Functions têm limite de 500k invocações/mês no plano Free.          | Alternativa viável, mas adiciona complexidade.          |
| **C. Disparo Manual pela Interface (UI)**      | • Imediato: Doug atualizou a planilha e clica em "Sincronizar Agora" na tela de Investimentos.                                                          | Não é automático.                                                                                                                                   | **Obrigatório como complemento do agendamento diário**. |

**Desenho Recomendado**:

1. Criar endpoint seguro no Next.js: `POST /api/sync/investments/sheets`.
2. Proteger a rota com verificação de cabeçalho `Authorization: Bearer <CRON_SECRET>` para chamadas automatizadas, ou validação da sessão do usuário logado (Feature 006) para cliques manuais na UI.
3. Adicionar workflow `.github/workflows/sync-sheets.yml` executando 1x ao dia (ex.: 08:00 UTC) ou configurar `pg_cron` no Supabase com extensão `pg_net`.

---

## 3. Limitações e Riscos

1. **Alteração Estrutural de Colunas pelo Doug**:
   - Se o usuário renomear ou trocar a ordem das colunas na planilha (ex.: inverter "Ativo" com "Quantidade"), um parser posicional cego extrairá dados incorretos.
   - _Mitigação_: Mapear por **nomes de cabeçalho na linha 1** (ex.: coluna que contenha "Ticker", "Ativo", "Classe", "Qtd", "Preço Médio", "Posição Atual"), em vez de índice fixo de array (`row[0]`, `row[1]`).
2. **Formatação de Moeda e Números na Planilha**:
   - O Google Sheets pode formatar números como `R$ 1.500,00` ou como float cru `1500`.
   - _Mitigação_: Usar o parâmetro `valueRenderOption: 'UNFORMATTED_VALUE'` ou sanitizar strings com o utilitário `parseMonetaryToCents()` a ser introduzido na Feature 009, convertendo para centavos inteiros (`BIGINT`).
3. **Quebra de Quebra de Linha da Chave Privada (`\n`)**:
   - Um erro clássico em variáveis de ambiente na Vercel/Node é a conversão dos caracteres `\n` da chave privada RSA em literais `\\n`.
   - _Mitigação_: No carregador de credenciais (`src/lib/sheets.ts`), normalizar com `.replace(/\\n/g, '\n')`.
4. **Desativação Automática de Crons do GitHub Actions**:
   - O GitHub suspende crons agendados em repositórios sem novos commits por mais de 60 dias. Manter commits periódicos ou utilizar `pg_cron` no Supabase como garantia secundária.

---

## 4. Recomendações Técnicas para a Spec 026

1. **Biblioteca de Conexão no Node.js**:
   - Utilizar a biblioteca leve oficial `google-auth-library` associada a requisições `fetch` nativas aos endpoints REST da Google Sheets API v4, evitando o pacote pesado monolítico `googleapis` (que aumentaria o tamanho do bundle do Next.js).
   - Alternativamente, usar o pacote `googleapis` restrito ao módulo `sheets_v4`.
2. **Modelagem de Dados (Feature 004/025)**:
   - Tabela `investment_snapshots` registrando:
     - `id` (UUID).
     - `source` (`'sheets'`).
     - `synced_at` (TIMESTAMPTZ UTC).
     - `content_hash` (TEXT SHA-256).
     - `raw_payload` (JSONB com auditoria do que foi lido da planilha).
   - Tabela `investment_positions` com cada ativo, classe (`renda_fixa`, `acoes`, `fiis`, `cripto`, `exterior`), quantidade e valor total em centavos (`BIGINT`).
3. **Idempotência e Histórico (Constitution IV)**:
   - Cada sincronização bem-sucedida grava um novo snapshot patrimonial sem sobrescrever destrutivamente o histórico anterior, viabilizando o gráfico da Feature 027 (Evolução Patrimonial).

---

## 5. Fontes Consultadas

1. **Google Sheets API v4 — Official Documentation**:  
   [https://developers.google.com/sheets/api/guides/concepts](https://developers.google.com/sheets/api/guides/concepts) — Acessado em 05/10/2026.
2. **Google Cloud — Service Accounts & IAM Overview**:  
   [https://cloud.google.com/iam/docs/service-accounts](https://cloud.google.com/iam/docs/service-accounts) — Acessado em 05/10/2026.
3. **Google Sheets API — Usage Limits & Quotas**:  
   [https://developers.google.com/sheets/api/limits](https://developers.google.com/sheets/api/limits) — Acessado em 05/10/2026.
4. **Google Drive API v3 — Track Changes & Modified Time**:  
   [https://developers.google.com/drive/api/guides/manage-changes](https://developers.google.com/drive/api/guides/manage-changes) — Acessado em 05/10/2026.
5. **Google Auth Library for Node.js (GitHub)**:  
   [https://github.com/googleapis/google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs) — Acessado em 05/10/2026.
