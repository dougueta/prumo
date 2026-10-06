# Contrato — CLI do gerador de dados sintéticos (FR-014–FR-018)

```
npm run synthetic -- [--seed <int>=42] [--months <int>=12] [--anchor-date <YYYY-MM-DD>=2026-09-30]
                     [--out <dir>=tests/fixtures/synthetic] [--format json,csv,ofx]
```

| Situação | Saída | Exit code |
|---|---|---|
| Sucesso | grava `dataset.json`, `extrato-<conta>.csv`, `extrato-<conta>.ofx`; imprime resumo (contas, nº transações, período) | 0 |
| `APP_ENV=production` | `Recusado: o gerador não roda em produção.` | 2 |
| `--months < 12` ou argumento inválido | mensagem nomeando o argumento | 1 |

## CSV (`extrato-<conta>.csv`)
UTF-8 com BOM, separador `;`, decimal com vírgula (padrão de bancos brasileiros):
`data;descricao;valor` → `15/09/2026;Mercado Vila Fictícia;-123,45`

## OFX (`extrato-<conta>.ofx`)
OFX 2.x (XML), `<CURDEF>BRL`, `<DTPOSTED>` `YYYYMMDD`, `<TRNAMT>` decimal com ponto,
`<FITID>` = id determinístico da transação.

## API programática
`generateDataset({ seed, months, anchorDate }): SyntheticDataset` — pura, sem I/O, usada
também pelo modo demonstração em memória.
