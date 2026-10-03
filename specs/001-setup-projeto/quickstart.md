# Quickstart — Prumo (após a implementação da 001)

Pré-requisitos: Git, Node 24 LTS, Docker Desktop **aberto**, Supabase CLI ≥ 2.119.
Windows: use Git Bash.

```bash
git clone https://github.com/dougueta/prumo.git && cd prumo
npm ci
cp .env.example .env.local          # valores locais já vêm preenchidos pelo passo abaixo
npm run dev:setup                   # supabase start + aplica migrações + escreve .env.local
npm run dev                         # http://localhost:3000
```

Verificações:
```bash
curl -s localhost:3000/api/health   # {"status":"ok","environment":"local","data":{"status":"ok",...}}
npm run synthetic -- --seed 42      # gera tests/fixtures/synthetic/
npm run check                       # lint + format + typecheck + unit
npm run test:integration            # requer Supabase local rodando
npm run test:e2e                    # build + Playwright (inclui cenário preview/demo)
```

Simular uma pré-visualização (modo demonstração) localmente:
```bash
APP_ENV=preview npm run dev:demo    # sobe sem variáveis SUPABASE_*; selo "Demonstração"
```

Problemas comuns:
- `Configuração inválida: NEXT_PUBLIC_SUPABASE_URL` → rode `npm run dev:setup`.
- `/api/health` com `unreachable` → Docker Desktop fechado ou `supabase stop` foi executado.
