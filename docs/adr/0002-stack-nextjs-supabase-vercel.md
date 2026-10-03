# ADR 0002 — Stack: Next.js + Supabase + Vercel, PWA

- **Status**: Aceita · **Data**: 2026-10-02 · **Decisor**: Doug

## Contexto
App pessoal usado no celular e no computador; um único desenvolvedor-humano aprovador;
integrações Supabase e Vercel já disponíveis no ambiente do Doug.

## Decisão
Web app responsivo/PWA em Next.js (App Router, TypeScript), Supabase (Postgres, Auth,
Storage, Edge Functions, Cron) e Vercel. UI com shadcn/ui + Tailwind.

## Alternativas rejeitadas
- App nativo iOS/Android: custo de construção e publicação alto para 1 usuário.
- Google Sheets + Looker Studio: rápido, mas não entrega experiência de app.

## Consequências
Possível evoluir para nativo no futuro reaproveitando backend e contratos.
