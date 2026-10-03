# Contrato — Trava provisória de produção (FR-013)

Aplica-se somente quando `APP_ENV=production`. Removida pela feature 006 (Login).

| Requisição | Resposta |
|---|---|
| Qualquer rota, sem header `Authorization` | `401` + `WWW-Authenticate: Basic realm="Prumo", charset="UTF-8"`, corpo sem detalhes |
| Credenciais inválidas | `401` idem (mesma resposta, tempo constante) |
| Credenciais válidas | segue normalmente |
| Rotas isentas: `/api/health`, `/manifest.webmanifest`, `/sw.js`, `/icons/*`, `/~offline` | seguem sem autenticação |

- Comparação em tempo constante; credenciais apenas em variáveis de ambiente de servidor.
- Não registra credenciais em logs. Em `local` e `preview` a trava não existe
  (preview é protegido pela Vercel Authentication).
