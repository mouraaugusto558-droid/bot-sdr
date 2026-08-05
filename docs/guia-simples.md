# Nanda 2.0 — Guia Simples (como tudo funciona)

Este documento explica o funcionamento do sistema em linguagem simples, sem jargão técnico, e descreve a API para quem for testar ou integrar.

---

## 1. O que é isso, em uma frase

A Nanda é a atendente virtual que responde os clientes da Exclusive Odontologia no WhatsApp. Este projeto (Nanda 2.0) é o "cérebro" dela — um serviço próprio que recebe as mensagens, decide o que responder (usando IA) e manda a resposta de volta, no lugar da lógica que antes vivia dentro do n8n.

## 2. O caminho de uma mensagem, do jeito simples

Imagine que um cliente manda "Oi, quero saber sobre implante" no WhatsApp da clínica:

1. **WhatsApp → Chatwoot**: a mensagem chega na central de atendimento (Chatwoot), onde a equipe também vê as conversas.
2. **Chatwoot → n8n → Nanda 2.0**: o Chatwoot avisa o n8n que chegou mensagem nova, e o n8n só repassa esse aviso pra cá, pra API da Nanda 2.0 (`POST /webhooks/chatwoot`).
3. **Nanda 2.0 responde na hora**: nossa API responde "recebido!" (`202 Accepted`) em milissegundos e guarda a mensagem numa fila. O n8n não fica esperando nada pesado acontecer.
4. **Espera de 20 segundos**: se o cliente mandar mais mensagens seguidas (tipo "oi" e depois "quero saber sobre implante" separado), a Nanda espera 20 segundos de silêncio antes de responder — assim ela junta tudo numa resposta só, em vez de responder cada mensagem picada.
5. **A IA pensa**: depois desses 20s, a mensagem (ou mensagens) vai pro "agente" — um modelo de IA (GPT-4o) que já sabe o histórico da conversa, consulta uma base de perguntas frequentes quando precisa, e pode anotar informações do cliente (nome, procedimento de interesse, etc.) num banco de dados.
6. **A resposta é organizada**: a resposta da IA é dividida em 1 a 4 mensagens curtas, do jeito que uma pessoa mandaria no WhatsApp (nada de textão).
7. **Entrega**: cada mensagem é enviada de volta pro cliente via Chatwoot — em texto, ou como imagem quando a resposta inclui uma foto. Entre cada envio, ela espera alguns segundos, pra não parecer um robô metralhando mensagens. (A conversão de texto para áudio, quando necessária, é feita pelo próprio n8n — fora desta API.)

```
Cliente (WhatsApp)
      │
      ▼
   Chatwoot  ──────────────►  n8n  ──────────────►  Nanda 2.0 (esta API)
      ▲                                                    │
      │                                             responde "ok" na hora
      │                                                    │
      │                                            ┌───────▼────────┐
      │                                            │  espera 20s     │
      │                                            │  (agrupa msgs)  │
      │                                            └───────┬────────┘
      │                                                    ▼
      │                                            ┌────────────────┐
      │                                            │  IA pensa +     │
      │                                            │  consulta FAQ / │
      │                                            │  anota dados    │
      │                                            └───────┬────────┘
      │                                                    ▼
      │                                            ┌────────────────┐
      │                                            │ organiza a      │
      │                                            │ resposta em     │
      │                                            │ 1-4 mensagens   │
      │                                            └───────┬────────┘
      └────────────── envia de volta (texto/imagem) ──┘
```

## 3. Regras de negócio importantes (o "bom senso" da Nanda)

- **Se um humano da equipe já está respondendo** aquela conversa, a Nanda fica quieta — não atropela o atendente.
- **Se o cliente já marcou uma avaliação** (pré-agendamento), a Nanda para de responder para sempre naquela conversa — o assunto passa a ser tratado por humanos.
- **Ela lembra da conversa**: nome do cliente, procedimento de interesse, período preferido — tudo fica guardado, então ela não repete perguntas já respondidas.
- **Ela só responde em texto** (com imagem quando fizer sentido) — a Nanda 2.0 não gera áudio; se algum dia precisar virar áudio, isso é feito pelo n8n, fora desta API.

## 4. As "ferramentas" que a IA pode usar

Pense nelas como gavetas que a Nanda pode abrir quando precisa:

| Ferramenta | Pra que serve |
|---|---|
| Perguntas (preço/voucher) | Responder dúvidas sobre valores e formas de pagamento |
| Preocupações | Responder quando o cliente está inseguro/com medo |
| Procedimentos odontológicos | Explicar quais tratamentos a clínica oferece |
| Dúvidas gerais | Endereço, convênio, logística |
| Anotar interesse | Guardar qual procedimento o cliente quer |
| Anotar pré-agendamento | Guardar nome + período combinado (ativa o "silêncio" da regra acima) |
| Lead quente | Avisar a equipe que esse cliente está perto de fechar |
| Chamar humano | Avisar a equipe quando o cliente insiste muito em saber preço exato |

---

## 5. API — o que existe e como usar

Hoje a API tem **dois endpoints**. É só isso que o n8n (ou você, testando) precisa chamar.

### `GET /health`

Só pra checar se o serviço está de pé.

**Resposta (`200 OK`):**
```json
{ "status": "ok" }
```

### `POST /webhooks/chatwoot`

É o único endpoint "de verdade". Recebe o payload que o Chatwoot/n8n manda quando chega mensagem nova. Aceita tanto o formato nativo do Chatwoot quanto o formato "cru" do WhatsApp (o serviço entende os dois).

**Corpo esperado:** um objeto JSON (o schema é intencionalmente flexível — ver `src/api/schemas/chatwoot-webhook.schema.ts` e `docs/reverse-engineering.md` Seção 2 para todos os formatos aceitos). Exemplos completos estão na coleção do Postman (`postman/Nanda-2.0.postman_collection.json`).

**Respostas possíveis:**

| Status | Quando acontece | Corpo |
|---|---|---|
| `202 Accepted` | Payload válido, mensagem aceita e enfileirada | `{ "status": "queued", "messageId": "...", "conversationId": "..." }` |
| `202 Accepted` | Mensagem já tinha sido recebida antes (webhook duplicado) | `{ "status": "duplicate", "messageId": "...", "conversationId": "..." }` |
| `400 Bad Request` | O corpo não é um JSON válido/objeto | mensagem de erro de validação |

Importante: a resposta desse endpoint **não é a resposta da IA**. Ela só confirma "recebi e vou processar". A resposta de verdade (texto/imagem) é enviada depois, de forma assíncrona, direto para a conversa no Chatwoot — por isso, ao testar no Postman, você não vai ver a resposta da Nanda ali; ela aparece no Chatwoot (ou nos logs do servidor, se você não tiver credenciais reais configuradas).

### O que precisa estar rodando para testar de verdade

- Redis (fila + buffer + memória de conversa)
- Postgres (gates de negócio + tools de escrita + trace)
- Variáveis de ambiente preenchidas (`.env`, ver `.env.example`) — incluindo chaves da OpenAI, Pinecone e Chatwoot, senão o servidor recusa subir.

Sem essas credenciais reais, o `202 Accepted` ainda funciona (a mensagem entra na fila), mas o processamento vai falhar mais adiante (por exemplo, ao tentar chamar a OpenAI) — isso fica registrado nos logs do servidor, não trava nem derruba o resto.

---

## 6. Como testar com o Postman

1. Importe o arquivo `postman/Nanda-2.0.postman_collection.json` no Postman.
2. Ajuste a variável de coleção `baseUrl` se seu servidor não estiver em `http://localhost:3000`.
3. Rode `npm run dev` no projeto (com `.env` preenchido).
4. Use as requisições da coleção, na ordem que preferir:
   - **Health Check** — confirma que o servidor está de pé.
   - **Mensagem de texto simples** — o caminho mais comum.
   - **Mensagem de áudio** — simula um áudio recebido (dispara transcrição).
   - **Mensagem de imagem** — simula uma foto recebida (dispara análise de imagem).
   - **Mensagem de PDF** — simula um documento recebido.
   - **Conversa com label (IA desligada)** — mostra a Nanda ficando em silêncio quando tem atendimento humano.
   - **Mensagem de agente humano (ignorada)** — mostra que mensagens da própria equipe não disparam a IA.
   - **Webhook inválido (400)** — mostra a validação rejeitando lixo.
   - **Webhook duplicado** — mande a mesma requisição de "Mensagem de texto simples" duas vezes seguidas e note a segunda vindo como `"status": "duplicate"`.
