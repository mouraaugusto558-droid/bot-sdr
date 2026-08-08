# Nanda 2.0 — Guia Simples (como tudo funciona)

Este documento explica o funcionamento do sistema em linguagem simples, sem jargão técnico, e descreve a API para quem for testar ou integrar.

---

## 1. O que é isso, em uma frase

A Nanda é a atendente virtual que responde os clientes da Exclusive Odontologia no WhatsApp. Este projeto (Nanda 2.0) é só o **"cérebro"** dela: um serviço que recebe uma mensagem de texto, junta com o histórico da conversa, pensa usando IA (com acesso a uma base de perguntas frequentes e a algumas anotações) e devolve a(s) melhor(es) resposta(s). Tudo o mais — receber o webhook do Chatwoot, decidir se a IA deve responder, converter áudio/imagem/PDF em texto, e mandar a resposta final de volta pro cliente — continua sendo trabalho do n8n.

## 2. O caminho de uma mensagem, do jeito simples

Imagine que um cliente manda "Oi, quero saber sobre implante" no WhatsApp da clínica:

1. **WhatsApp → Chatwoot → n8n**: a mensagem chega no Chatwoot e o n8n é quem recebe o webhook. É o n8n quem decide se essa mensagem deve ir pra IA (por exemplo: ignora se um atendente humano já assumiu a conversa) e quem resolve mídia (transcreve áudio, descreve imagem, lê PDF) — tudo isso **antes** de chamar a Nanda 2.0.
2. **n8n → Nanda 2.0**: o n8n chama `POST /messages` desta API, já com o texto pronto.
3. **Buffer de 20 segundos**: se o cliente mandar mais de uma mensagem seguida (tipo "oi" e depois "quero saber sobre implante"), a Nanda espera 20 segundos de silêncio antes de responder — juntando tudo numa única resposta, em vez de responder cada mensagem picada. Na prática, isso significa que a chamada HTTP do n8n fica "pendurada" esperando: se chegar mensagem nova antes dos 20s, aquela chamada mais antiga volta na hora avisando que foi superada, e é a chamada mais recente que espera e recebe a resposta de verdade.
4. **A IA pensa**: passados os 20s de silêncio, o texto acumulado vai pro agente — um modelo de IA (GPT-4o) que já sabe o histórico da conversa, consulta uma base de perguntas frequentes quando precisa, e pode anotar informações do cliente (nome, procedimento de interesse, etc.).
5. **A resposta é organizada**: a resposta da IA é dividida em 1 a 4 mensagens curtas, do jeito que uma pessoa mandaria no WhatsApp (nada de textão).
6. **Nanda 2.0 → n8n**: a API devolve essas mensagens no corpo da resposta HTTP — a mesma chamada que o n8n fez lá no passo 2. É o n8n quem pega essas mensagens e manda de volta pro cliente via Chatwoot (e quem decide, se for o caso, transformar alguma em áudio).

```
Cliente (WhatsApp)
      │
      ▼
   Chatwoot ───► n8n (recebe webhook, decide, resolve mídia)
                  │
                  │  POST /messages { texto, ids da conversa }
                  ▼
         ┌────────────────────┐
         │     Nanda 2.0       │
         │  (esta API)         │
         │                      │
         │  1. buffer 20s       │
         │  2. IA pensa +       │
         │     consulta FAQ /   │
         │     anota dados      │
         │  3. organiza a       │
         │     resposta em      │
         │     1-4 mensagens    │
         └─────────┬───────────┘
                    │  200 OK { messages: [...] }
                    ▼
                  n8n ───► Chatwoot ───► Cliente (WhatsApp)
```

## 3. Regras de negócio importantes (o "bom senso" da Nanda)

- **Ela lembra da conversa**: nome do cliente, procedimento de interesse, período preferido — tudo fica guardado, então ela não repete perguntas já respondidas.
- **Ela só responde em texto** — não gera áudio nem imagem. Se o n8n decidir transformar alguma resposta em áudio, isso é feito depois, fora desta API.
- Decisões de "quando a IA deve ou não responder" (atendente humano já respondendo, cliente já com avaliação marcada, etc.) **não são desta API** — o n8n só chama `POST /messages` quando já decidiu que a Nanda deve responder.

## 4. As "ferramentas" que a IA pode usar

Pense nelas como gavetas que a Nanda pode abrir quando precisa:

| Ferramenta | Pra que serve |
|---|---|
| Perguntas (preço/voucher) | Responder dúvidas sobre valores e formas de pagamento |
| Preocupações | Responder quando o cliente está inseguro/com medo |
| Procedimentos odontológicos | Explicar quais tratamentos a clínica oferece |
| Dúvidas gerais | Endereço, convênio, logística |
| Anotar interesse | Guardar qual procedimento o cliente quer |
| Anotar pré-agendamento | Guardar nome + período combinado |
| Lead quente | Avisar a equipe que esse cliente está perto de fechar |
| Chamar humano | Avisar a equipe quando o cliente insiste muito em saber preço exato |

As 4 primeiras são de consulta (RAG, buscam em uma base de conhecimento); as 4 últimas são de escrita (salvam algo num banco de dados para a equipe humana ver depois).

---

## 5. API — o que existe e como usar

A API tem **dois endpoints**.

### `GET /health`

Só pra checar se o serviço está de pé.

**Resposta (`200 OK`):**
```json
{ "status": "ok" }
```

### `POST /messages`

O único endpoint "de verdade". Recebe uma mensagem já resolvida para texto e devolve a resposta da Nanda no mesmo request — **não** há callback, fila ou webhook de saída: a chamada HTTP fica esperando até a janela de 20s de silêncio fechar.

**Corpo esperado:**
```json
{
  "accountId": "1",
  "conversationId": "501",
  "senderId": "5581999998888",
  "contactInboxSourceId": "5581999998888",
  "senderName": "Maria Souza",
  "messageId": "1001",
  "timestamp": "2026-08-05T12:00:00.000Z",
  "text": "Oi, quero saber sobre implante dentário"
}
```

| Campo | Obrigatório | Pra que serve |
|---|---|---|
| `accountId` | sim | identifica a conta/clínica (junto com `senderId`, forma a chave do buffer) |
| `conversationId` | sim | id da conversa — devolvido na resposta, para o n8n saber a quem responder |
| `senderId` | sim | telefone/id do cliente — chave do buffer de 20s |
| `contactInboxSourceId` | sim | identidade real do cliente nas tabelas/memória (pode ser igual a `senderId`, dependendo do canal) |
| `senderName` | não | nome do cliente, usado pelas tools de escrita |
| `messageId` | não | id da mensagem — usado para idempotência (evita processar a mesma mensagem duas vezes) |
| `timestamp` | não | horário da mensagem; se omitido, usa o horário de chegada |
| `text` | sim | o texto já resolvido (áudio/imagem/PDF já convertidos pelo n8n antes de chamar esta API) |

**Respostas possíveis:**

| Status HTTP | `status` no corpo | Quando acontece |
|---|---|---|
| `200` | `"answered"` | A janela de silêncio fechou sem nova mensagem — vem junto `"messages": [...]`, a resposta pronta da Nanda |
| `200` | `"superseded"` | Chegou uma mensagem mais nova do mesmo cliente antes da janela fechar — esta chamada não vai ter resposta (quem responde é a chamada mais recente) |
| `200` | `"duplicate"` | Mesmo `messageId` já tinha sido processado antes (proteção contra retry do n8n) |
| `400` | — | Corpo inválido (faltou campo obrigatório) |

### O que precisa estar rodando para testar de verdade

- Redis (buffer de mensagens + memória de conversa)
- Postgres (tools de escrita + trace)
- Variáveis de ambiente preenchidas (`.env`, ver `.env.example`) — incluindo chaves da OpenAI e Pinecone, senão o servidor recusa subir.

---

## 6. Como testar com o Postman

1. Importe o arquivo `postman/Nanda-2.0.postman_collection.json` no Postman.
2. Ajuste a variável de coleção `baseUrl` se seu servidor não estiver em `http://localhost:3000`.
3. Rode `npm run dev` no projeto (com `.env` preenchido).
4. Use as requisições da coleção, na ordem que preferir:
   - **Health Check** — confirma que o servidor está de pé.
   - **Mensagem única — resposta imediata** — o caminho mais comum: dispara, espera ~20s, recebe a resposta.
   - **Duas mensagens seguidas (1/2 e 2/2)** — dispare a 1/2, espere alguns segundos e dispare a 2/2 (mesmo `senderId`/`accountId`): a 1/2 volta rápido como `"superseded"`, a 2/2 espera e recebe a resposta combinada das duas mensagens.
   - **Payload inválido (400)** — mostra a validação rejeitando um corpo incompleto.
   - **Mensagem duplicada** — rode "Mensagem única" até o fim e depois esta: mesmo `messageId`, deve responder `"duplicate"` na hora.
