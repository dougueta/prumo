---
name: "revisar-pr"
description: "Revisão independente em contexto limpo de um PR autor:gemini (Constitution VIII): monta o pacote fechado, despacha o subagente revisor-limpo e orienta o Doug a publicar o veredito pelo app prumo-revisor."
argument-hint: "<número do PR>"
user-invocable: true
disable-model-invocation: true
---

# /revisar-pr <n>

Feature 002 · FR-017/FR-018. Você (sessão principal) **orquestra**, não revisa: **não leia** o
diff, a spec nem qualquer arquivo de `.review/<n>/` antes do veredito, e não resuma o PR para o
subagente.

## Passos

1. Rode `npm run review:bundle -- <n>`.
   - Exit 3 (`revisor e autor são o mesmo agente`, `este PR é revisado pelo Gemini`, rótulo
     ausente/ambíguo, autor externo) ou exit 1 (PR fechado, inexistente ou em rascunho): pare e
     mostre a mensagem ao Doug.
2. Despache o subagente **`revisor-limpo`** (ferramenta Agent, `subagent_type: "revisor-limpo"`)
   com **exatamente** este prompt, sem acrescentar contexto:

   > Revise o pacote em `.review/<n>/` seguindo `review-checklist.md` do pacote e devolva o
   > conteúdo de `veredito.md`.

3. Grave o texto que o subagente devolveu entre `--- veredito.md ---` e `--- fim ---` em
   `.review/<n>/veredito.md`, **sem alterar nada**.
4. Diga ao Doug para publicar **no terminal dele** (a publicação pede a senha da chave do app
   `prumo-revisor`; sessões de agente não têm TTY e são recusadas com exit 8):

   ```
   npm run review:publish -- <n>
   ```

   Exits: 2 = veredito fora do formato (refaça a partir do passo 2); 4 = o PR recebeu commits
   depois do pacote (refaça a partir do passo 1); 5 = configuração do app (`.env.review.local`,
   chave, instalação — ver `specs/002-revisor-pr/quickstart.md` §1.2); 9 = senha incorreta.

Nunca rode `npm run review:publish` você mesmo e nunca publique o veredito por outro meio
(comentário da conta do Doug não conta como veredito — FR-009).
