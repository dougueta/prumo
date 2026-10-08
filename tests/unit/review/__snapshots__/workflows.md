# Espelho dos workflows (Constitution VIII · feature 002, decisão C5)

Gerado por `npm run review:mirror`. Não edite à mão: o teste
`tests/unit/review/workflows-mirror.test.ts` exige o conteúdo exato de cada
`.github/workflows/*.yml`. Revisor: avalie estes blocos como se fossem os próprios workflows.

## .github/workflows/ci.yml

````yaml
# Feature 001 · FR-006/FR-007/FR-008 — verificações obrigatórias de todo PR e da main.
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  # Feature 002: na main nenhum run é cancelado — todo commit passa pela Guarda da main.
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

permissions:
  contents: read

env:
  NODE_VERSION: "24"
  SUPABASE_CLI_VERSION: "2.119.0"
  # Serviços do Supabase que a 001 não usa — sobem mais rápido sem eles.
  SUPABASE_EXCLUDE: studio,imgproxy,mailpit,realtime,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta

jobs:
  quality:
    name: Qualidade (lint, formato, tipos)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "${{ env.NODE_VERSION }}", cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck

  unit:
    name: Testes unitários
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "${{ env.NODE_VERSION }}", cache: npm }
      - run: npm ci
      - run: npm run test:unit

  integration:
    name: Testes de integração (Supabase efêmero)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "${{ env.NODE_VERSION }}", cache: npm }
      - uses: supabase/setup-cli@v3
        with: { version: "${{ env.SUPABASE_CLI_VERSION }}" }
      - run: npm ci
      - name: Supabase local (aplica migrações)
        run: supabase start -x "$SUPABASE_EXCLUDE"
      - name: Exporta credenciais locais do Supabase
        run: node scripts/ci-supabase-env.mjs
      - run: npm run test:integration
        env: { APP_ENV: local }

  e2e:
    name: Testes ponta a ponta (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "${{ env.NODE_VERSION }}", cache: npm }
      - uses: supabase/setup-cli@v3
        with: { version: "${{ env.SUPABASE_CLI_VERSION }}" }
      - run: npm ci
      - name: Cache dos navegadores do Playwright
        uses: actions/cache@v6
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
      - name: Supabase local (aplica migrações)
        run: supabase start -x "$SUPABASE_EXCLUDE"
      - name: Exporta credenciais locais do Supabase
        run: node scripts/ci-supabase-env.mjs
      - run: npm run test:e2e
        env: { APP_ENV: local }
      - name: Relatório do Playwright
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

  # Feature 002 · FR-004(c)/FR-024 — audita todo commit da main recalculando o portão
  # (squash de PR, checks do GitHub Actions verdes, revisão independente válida). Sem checkout do
  # PR e sem segredos além do GITHUB_TOKEN. Espelho: tests/unit/review/__snapshots__/workflows.md.
  main-guard:
    name: Guarda da main
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      pull-requests: read
      issues: write
      checks: read
    steps:
      - uses: actions/checkout@v7
        with:
          ref: main
          persist-credentials: false
      - uses: actions/setup-node@v7
        with: { node-version: "${{ env.NODE_VERSION }}", cache: npm }
      - run: npm ci --ignore-scripts
      - name: Audita o commit
        run: npm run review:main-guard -- --mode=push
        env:
          COMMIT_SHA: ${{ github.sha }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  deploy-db:
    name: Migrações de produção
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [quality, unit, integration, e2e, main-guard]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: production
    steps:
      - uses: actions/checkout@v7
      - uses: supabase/setup-cli@v3
        with: { version: "${{ env.SUPABASE_CLI_VERSION }}" }
      - name: Aplica migrações no Supabase de produção
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        run: |
          for name in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_PROJECT_REF; do
            if [ -z "${!name}" ]; then echo "::error::Segredo $name não configurado (ver README#custos)"; exit 1; fi
          done
          supabase link --project-ref "$SUPABASE_PROJECT_REF"
          supabase db push

````

## .github/workflows/keepalive.yml

````yaml
# Feature 001 · FR-023 — evita a pausa do Supabase gratuito e avisa (e-mail do GitHub) se a
# produção estiver fora. Roda todo dia às 09:00 de Brasília (12:00 UTC).
name: Keepalive da produção

on:
  schedule:
    - cron: "0 12 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  keepalive:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "24" }
      - name: Verifica a saúde da produção
        run: node scripts/keepalive-check.mjs
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}

````

## .github/workflows/review-gate.yml

````yaml
# Feature 002 · FR-006/FR-008/FR-010/FR-026 — verificação "Revisão independente".
# Repositório público: este workflow roda sempre o código da main (pull_request_target,
# issue_comment, workflow_dispatch), nunca faz checkout nem executa código do PR, não usa
# segredos além do GITHUB_TOKEN e só passa o NÚMERO do PR ao script (via env).
# Contrato: specs/002-revisor-pr/contracts/review-gate.md. Espelho revisável:
# tests/unit/review/__snapshots__/workflows.md (atualize com `npm run review:mirror`).
name: Revisão independente

on:
  pull_request_target:
    types:
      [
        opened,
        reopened,
        synchronize,
        edited,
        labeled,
        unlabeled,
        ready_for_review,
        converted_to_draft,
      ]
  issue_comment:
    types: [created, edited, deleted]
  # Roda a versão do PR: o job "redispatch" só reencaminha a avaliação para a main.
  pull_request_review:
    types: [submitted, edited, dismissed]
  workflow_dispatch:
    inputs:
      pr:
        description: Número do PR
        required: true
        type: string

permissions: {}

concurrency:
  group: review-gate-${{ github.event.pull_request.number || github.event.issue.number || inputs.pr }}
  cancel-in-progress: true

jobs:
  gate:
    name: Avaliação
    if: >-
      github.event_name != 'pull_request_review' &&
      (github.event_name != 'issue_comment' || github.event.issue.pull_request)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      pull-requests: write
      issues: write
      statuses: write
      checks: read
    steps:
      - uses: actions/checkout@v7
        with:
          ref: main
          persist-credentials: false
      - uses: actions/setup-node@v7
        with: { node-version: "24", cache: npm }
      - run: npm ci --ignore-scripts
      - name: Avalia o PR e publica o status
        run: npm run review:gate
        env:
          PR_NUMBER: ${{ github.event.pull_request.number || github.event.issue.number || inputs.pr }}
          RUN_ID: ${{ github.run_id }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  redispatch:
    name: Reavaliação após review
    if: github.event_name == 'pull_request_review'
    runs-on: ubuntu-latest
    timeout-minutes: 2
    permissions:
      actions: write
    steps:
      - name: Dispara a avaliação a partir da main
        run: gh workflow run review-gate.yml --repo "$REPO" --ref main -f pr="$PR_NUMBER"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REPO: ${{ github.repository }}

````
