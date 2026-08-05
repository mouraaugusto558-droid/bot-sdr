# Engenharia Reversa — Workflow n8n "NandaChatwoot"

Fonte: `NandaChatwoot (1).json` (export n8n, 50 nós). Este documento é o contrato de comportamento que a Nanda 2.0 deve reproduzir fielmente. Toda decisão de implementação deve referenciar uma seção específica deste documento — nenhum comportamento deve ser inferido além do que está aqui descrito.

Decisão já validada com o usuário: onde o system prompt e o grafo divergem, **o grafo manda** (é o comportamento real de produção). Ver seção "Divergências prompt × grafo".

---

## 1. Visão geral do fluxo

```
Webhook (Chatwoot) → Normalização → Switch1 (AI on/off, sender type)
  → Date&Time → gate leads_noturnos/pré-agendamento → Switch (tipo de mídia)
  → [transcrição / visão / pdf / texto] → Organiza Texto
  → Redis (buffer push) → loop de debounce (Redis get + Switch4 + Wait 1s)
  → Deleta Buffer → Empacota Mensagens → Code (no-op, ver bug #3)
  → AI Agent (LangChain agent, gpt-4o, tools + RAG + memória Redis)
  → Parser Chain (gpt-4.1-mini, split/format em até 4 mensagens)
  → Split Out → Code in JavaScript (classifica texto/áudio/imagem por item)
  → Loop Over Items → Switch2 → [ElevenLabs TTS | texto | imagem] → sendChatWoot* → Wait(8-15s) → próximo item
```

Todo o pipeline roda por execução de webhook; o debounce funciona via polling em Redis (múltiplas execuções concorrentes por conversa, ver seção 4).

---

## 2. Entrada: Webhook + Normalização

**Webhook1**: `POST /novofluxo123asdad` — recebe qualquer evento do Chatwoot (mensagem recebida, mensagem enviada por agente, etc.) — não há filtro de evento no próprio webhook.

**Normalização** (Set node) extrai um payload achatado a partir de formatos variados de payload Chatwoot/WhatsApp:

| Campo | Origem (expressão) | Observação |
|---|---|---|
| `Kira.assignee` | `body.conversation.meta.assignee.name` | nome do agente humano atribuído, se houver |
| `Kira.agentType` | `body.conversation.meta.assignee.type` | |
| `Kira.status` | `body.conversation.status` | |
| `Kira.labels` | `body.conversation.labels` | array de labels da conversa no Chatwoot |
| `Message.id` | `conversation.messages[0].id` ou `body.data.key?.id` (fallback WhatsApp direto) | |
| `Message.timestamp` | `conversation.messages[0].created_at` convertido para ISO | |
| `Message.type` | cascata: `attachments[0].file_type` (`image`/`audio`/`file`→extensão) → `content_type=='text'` → `data.message.extendedTextMessage`/`conversation` → `audioMessage` → `imageMessage` → `null` | tipos possíveis observados: `text`, `image`, `audio`, `pdf` (extensão de `file`), `null` |
| `Client.channel` | `body.conversation.channel` | |
| `Client.conversationId` | `conversation.messages[0].conversation_id` | |
| `Client.senderName` | `body.sender.name` ou `body.data.pushName` | |
| `Client.senderType` | `conversation.messages[0].sender_type` | `"Contact"` (cliente) ou `"User"` (agente humano/Chatwoot) |
| `Client.senderID` | `sender.identifier` (antes do `@`) — **tipado como number** | telefone do cliente, sem DDI/`@s.whatsapp.net`. **Usado apenas como chave do buffer Redis de debounce** (seção 6) |
| `Client.sourceId` | `conversation.messages[0].source_id` | **Campo morto**: capturado pela Normalização mas nunca lido por nenhum outro nó do grafo. Não confundir com o próximo campo |
| *(não capturado pela Normalização — lido diretamente de `Webhook1` em cada nó downstream)* | `body.conversation.contact_inbox.source_id` | **Este é o identificador de cliente realmente usado em produção**: chave `userID`/`numero`/`telefone` em todas as tabelas Supabase (`leads_noturnos`, `"pré agendamentos"`, `"Interesse do cliente"`, `leads_quentes`, `atendimento_humano`) e a base da `sessionKey` da memória Redis do LangChain (`mensagens.{contact_inbox.source_id}_mem{accountID}`). **Diferente** de `Client.senderID` (telefone, usado só no buffer) e de `Client.sourceId` (campo morto acima) — os três podem ter valores distintos dependendo do payload. Reproduzir capturando este campo explicitamente como `client.contactInboxSourceId` no domínio da Nanda 2.0, já que ele é a chave de identidade real do cliente em todo o grafo |
| `Client.email` | `body.sender.email` | |
| `Message.content` | cascata: `body.content` → `extendedTextMessage.text` → `imageMessage.caption` → `conversation` → `message.text`/`message.caption` | |
| `Message.contentUrl` | `attachments[0].data_url` ou `data.message.mediaUrl` | usado para baixar mídia |
| `Kira.accountID` | constante `"1"` | **hardcoded** |
| `Kira.kirawootUrl` | constante `https://exclusiveodontologia-chatwoot.jv5sm0.easypanel.host/` | **hardcoded** |
| `Kira.kiraApiKey` | constante (valor em texto plano no JSON) | **SECRET hardcoded — ver seção 9** |
| `Kira.agenteId` | `conversation.messages[0].conversation.assignee_id` | |

---

## 3. Roteamento inicial — `Switch1`

Avalia em ordem (primeira que bater vence; sem fallback explícito):

1. `Kira.labels` contém `Kira.labels[0]` → saída **"IA Desligada"** → `No Operation, do nothing1` (fim, sem resposta). *Nota: condição sempre verdadeira quando há ao menos 1 label — na prática funciona como "há alguma label na conversa" e é usada para forçar desligar a IA via label do Chatwoot.*
2. `Client.senderType == 'Contact'` → saída **"Segue o Fluxo"** → `Date & Time` (continua pipeline — mensagem do cliente).
3. `Client.senderType == 'User'` → saída **"Debouncer"** (nome enganoso) → `No Operation, do nothing2` (fim — mensagens enviadas por agente humano no Chatwoot NÃO disparam a IA nem entram no buffer).

**Regra a reproduzir**: só mensagens de `Contact` seguem para o pipeline de IA. Labels na conversa desligam a IA incondicionalmente (kill-switch manual via Chatwoot).

---

## 4. Gate de leads noturnos + pré-agendamento já existente

Sequência (só para mensagens de `Contact`):

1. `Date & Time` → `Date & Time1` (extrai hora, resultado não usado adiante no grafo ativo — **dead value**, hora não gate nada hoje apesar do nome).
2. `Supabase1`: `getAll` em `leads_noturnos` where `numero_usuario = client.contactInboxSourceId` (`body.conversation.contact_inbox.source_id` — ver nota na seção 2 sobre este ser o identificador real, distinto de `Client.senderID`/`Client.sourceId`). `alwaysOutputData: true`, `onError: continueRegularOutput`.
3. `If15`: `$json` vazio?
   - **Vazio** (lead não registrado ainda) → `Supabase2`: insere em `leads_noturnos` (`numero_usuario`, `nome_usuario`, `data_envio`) → segue para `If3`.
   - **Não vazio** → segue direto para `If3`.
4. `If3`: `$json` vazio?
   - **Vazio** → **fim, sem saída** (nada acontece — caminho residual, praticamente nunca deveria ocorrer dado o passo anterior).
   - **Não vazio** → `Supabase3`.
5. `Supabase3`: `getAll` em `"pré agendamentos"` where `userID = client.contactInboxSourceId`. `alwaysOutputData: true`, `onError: continueRegularOutput`.
6. `If`: `$json` vazio?
   - **Vazio** (cliente NÃO tem pré-agendamento salvo) → `Switch` (segue pipeline normal de mídia/IA).
   - **Não vazio** (cliente JÁ tem pré-agendamento salvo) → `No Operation, do nothing` → **fim, silêncio total, para sempre, para esse contato.**

> **Confirmado com o usuário**: este silêncio total pós-agendamento é o comportamento real de produção e deve ser reproduzido exatamente assim na Nanda 2.0, mesmo divergindo do que o system prompt descreve (ver seção 8).

---

## 5. Dispatch por tipo de mídia — `Switch` (nó principal, alimentado por `Normalização`/`Message.type`)

| Condição | Saída | Caminho |
|---|---|---|
| `Message.type == 'audio'` | `audioMessage` | `GetMidia` (baixa `Message.contentUrl`) → `Transcrição` (OpenAI Whisper, `language: pt`) → `Organiza Texto` |
| `Message.type == 'image'` | `imageMessage` | `GetMidia1` → `OpenAI` (`gpt-4o-mini`, resource `image`/`analyze`, prompt fixo `"Descreva essa imagem, oque tem nela?"`) → `Organiza Texto` |
| `Message.content` não vazio | `conversation ` (nome com espaço à direita) | `Filta Msg App` (Set: `telefone=Client.senderID`, `mensagem=Message.content`) → `Organiza Texto` |
| `Message.type == 'pdf'` | `documentMessage` | `GetMidia2` → `Extrair Dados` (`extractFromFile`, operation `pdf`) → `Organiza Texto` |
| nenhuma bateu | fallback `"none"` | **fim, sem saída** |

Nó órfão não conectado: `Converter Arquivo1` (`convertToFile`, monta nome/mimetype de um documentMessage) — presente no JSON mas sem uso no grafo ativo. **Não reproduzir**, é resíduo.

**Organiza Texto** (Set): consolida em um único item:
- `Mídia_Tratada` = `mensagem + text + content` (concatenação simples dos 3 possíveis campos vindos dos ramos acima — só um deles normalmente tem valor)
- `message_Id` = `Normalização.Message.id`
- `Timestamp` = `Normalização.Message.timestamp`

---

## 6. Buffer / debounce (Redis)

Objetivo: agrupar mensagens rápidas consecutivas do mesmo cliente numa única chamada ao agente, com janela de silêncio de 20s.

1. **Redis** (push): `list = senderID + accountID` (ex.: `"558199999999" + "1"`), `messageData = JSON.stringify({message: Mídia_Tratada, message_id, timestamp: $now})`, `tail: true` (mantém ordem cronológica de inserção).
2. **Redis1** (get): busca a lista inteira (`propertyName: messages`) na mesma chave.
3. **Switch4** avalia (nesta ordem):
   - regra `"faz nada"`: `Normalização.Message.id != Organiza Texto.message_Id` → `No Operation, do nothing3`. **Bug confirmado**: dentro de uma mesma execução esses dois valores são sempre iguais (ambos derivam do mesmo Message.id desta execução) — esta branch nunca dispara na prática. Não é um guard funcional; é código morto.
   - regra `"prosseguir"`: `JSON.parse(lista.last()).timestamp < now - 20s` (a última mensagem no buffer tem mais de 20s) → `Deleta Buffer` → `Empacota Mensagens` → `Code` → `AI Agent`.
   - fallback `"esperar"`: → `Wait1` (1s) → volta para `Redis1` (poll loop).

**Mecanismo real do debounce**: cada nova mensagem do cliente dispara uma nova execução do webhook, que entra neste mesmo loop de polling. A execução que, ao reler o Redis, encontrar "a última mensagem do buffer tem >20s" é quem processa. Não há lock — é uma condição de corrida (baixo risco na prática porque o polling de 1s tende a convergir para uma única execução vencedora, mas tecnicamente múltiplas execuções podem coincidir). **Isto é candidato a melhoria interna** (ex. lock Redis) sem alterar o comportamento observável (mesma janela de 20s, mesmo agrupamento).

**Nanda 2.0 (M10 — Session Manager, `src/session/conversation-lock.ts`)**: a melhoria interna sugerida acima foi implementada — um lock Redis distribuído por `conversationKey` (`buffer:{accountId}:{senderId}`) serializa toda seção crítica que toca o estado de uma conversa: push no buffer + reagendamento do debounce (`process-incoming-message.job.ts`, espera se ocupado) e leitura+limpeza do buffer + turno do agente (`flush-conversation-buffer.job.ts`, desiste se ocupado — outro worker já está processando). Elimina por construção a condição de corrida mesmo sob múltiplos workers concorrentes, sem alterar nenhum comportamento observável.

4. **Deleta Buffer**: `DEL` na chave do buffer.
5. **Empacota Mensagens** (Set): `messages = lista.map(JSON.parse).sort(by messageTime).map(m => m.message).join(' ')`. **Bug confirmado**: o campo salvo no push é `timestamp`, não `messageTime` — o sort não tem efeito real (compara `undefined`), mas como o Redis já mantém ordem de inserção (`tail: true`) o resultado final é equivalente a "ordem cronológica de chegada". Reproduzir como: concatenar mensagens do buffer na ordem de inserção, sem reordenação adicional.
6. **Code**: função `limparMensagem`/`processarMensagens` que tenta limpar metadados de serialização LangChain (`response_metadata`, `tool_calls`, etc.) de `item.json.mensagem`. **Bug confirmado**: o campo produzido por `Empacota Mensagens` chama-se `messages`, não `mensagem` — a condição `if (!item?.json?.mensagem) return item` sempre é verdadeira, então este nó **é um no-op garantido** no pipeline atual: o texto que chega ao AI Agent é exatamente a concatenação bruta do passo anterior, sem limpeza nenhuma. **Reproduzir como no-op** (não implementar a lógica de limpeza — ela nunca roda hoje).

---

## 7. AI Agent (núcleo do agente)

Nó `AI Agent` (`@n8n/n8n-nodes-langchain.agent`), `promptType: define`, `text = {{ $json.messages }}` (a string empacotada do passo 6).

**Modelo**: `OpenAI Chat Model6` — `gpt-4o`, `temperature: 0.8`, `topP: 0.9`, `frequencyPenalty: 0.3`. (Demais modelos de chat no canvas — `OpenAI Chat Model1`, `OpenRouter Chat Model`, `OpenAI Chat Model5 (gpt-5)` — estão **disabled** e desconectados; são experimentos não usados em produção. Ignorar.)

**Memória**: `Redis Chat Memory` (`memoryRedisChat`), `sessionKey = "mensagens.{contact_inbox.source_id}_mem{accountID}"`. Esta é uma chave Redis **diferente** da usada pelo buffer de debounce (seção 6) — o histórico de conversa completo (formato LangChain messages) fica persistido aqui e é isso que dá à IA memória de longo prazo da conversa (nome já informado, período já escolhido, etc. — é assim que a "REGRA 5" do prompt é cumprida na prática: por recall do próprio histórico, não por um lookup de variável separado).

**System prompt**: ver arquivo íntegro em `docs/system-prompt-original.md` (extraído literalmente do node, ~500 linhas) — copiado sem alteração para a Nanda 2.0. Resumo estrutural (a reproduzir 1:1 no Prompt Engine):
- Persona "Nanda", recepcionista SDR da "Exclusive Odontologia", WhatsApp, sotaque de Recife.
- 7 `critical_rules` (foco em agendamento, proibição da palavra "grátis", estrutura de resposta, proibição de encerrar sem CTA, gate de memória Redis nome/período, regra de uso único da tool Procedimento, proibições gerais).
- `conversation_priority_rule`: sempre responder à intenção real do cliente antes de retomar o fluxo.
- Saudação por faixa de horário (madrugada/manhã/tarde/noite).
- Fluxo de 7 etapas invioláveis (saudação → acolhimento → apresentação do voucher 48h/R$350 → confirmação+nome completo → conclusão com números de contato → endereço → encerramento), mais etapa extra de "dúvidas sobre preço" com 1ª resposta vs. resposta repetida.
- Catálogo de quando usar cada tool (descrito em linguagem natural dentro do próprio prompt, redundante com a `description` das tools no n8n — ambos devem bater no Prompt Engine).
- 6 exemplos few-shot de redirecionamento de assunto.

**Tools conectadas ao AI Agent** (todas via `ai_tool`):

| Tool (nome no grafo) | Tipo | Efeito |
|---|---|---|
| `pergunta` | `toolVectorStore` → Pinecone index `nandafaq1` (embeddings OpenAI default, chat model `gpt-4o-mini`) | RAG — dúvidas sobre preço/voucher/pagamento |
| `preocupacoes` | `toolVectorStore` → Pinecone `nandafaq2` (modelo próprio) | RAG — objeções de confiança/dor/medo |
| `faqProcedimentosOdonto` | `toolVectorStore` → Pinecone `nandafaq3` | RAG — catálogo de tratamentos oferecidos |
| `duvidas` | `toolVectorStore` → Pinecone `nandafaq4` | RAG — localização, convênio, logística |
| `Procedimento` | `supabaseTool` → tabela `"Interesse do cliente"` | grava `userID` (source_id), `Procedimento` (via `$fromAI`), `Data_envio`. Regra de negócio (só no prompt, não reforçada no grafo): usar 1x por conversa, só o 1º procedimento mencionado |
| `Anotar` | `supabaseTool` → tabela `"pré agendamentos"` | grava `userID`, `NomeCompleto` (`$fromAI`), `período_do_dia` (`$fromAI`), `Data_envio`. É o gatilho que, na próxima mensagem, ativa o silêncio total da seção 4 |
| `leadsQuentes` | `supabaseTool` → tabela `leads_quentes` | grava `nome` (`Client.senderName`), `numero` (source_id), `criado_em` |
| `AtendimentoHumano` | `supabaseTool` → tabela `atendimento_humano` | grava `telefone` (source_id), `nome`, `data_envio` — acionada quando cliente insiste em preço |

Cada índice Pinecone tem seu próprio par `Embeddings OpenAI` + `OpenAI Chat Model` dedicado (modelo de embeddings não sobrescrito — usa o default do node `embeddingsOpenAi` da versão n8n instalada; **confirmar o model id exato, provavelmente `text-embedding-3-small`, antes de migrar** — não documentado explicitamente no JSON).

**Descrições exatas das tools (`descriptionType: manual` → `toolDescription`, usadas literalmente como `description` no function-calling)**, confirmadas por leitura direta dos 8 nós no JSON:
- As 4 tools RAG usam a descrição do respectivo node `toolVectorStore` (texto longo listando as perguntas-gatilho — reproduzido verbatim em `src/tools/rag/rag-tools.ts`).
- `Procedimento`: `"Acione essa ferramenta quando o cliente falar o procedimento que ele tem interesse e informe: \"Seu {userID} \" e o \"{procedimento}\""`.
- `leadsQuentes`: `"Use esta ferramenta somente para registrar leads quentes, ou seja, aqueles que demonstrem interesse claro, intenção de agendamento/compra e mereçam atenção prioritária da equipe humana"`.
- `AtendimentoHumano`: `"Acione essa ferramenta quando o cliente perguntar o preço de qualquer procedimento"`.
- `Anotar`: **não tem `toolDescription` manual no node original** (nenhum `descriptionType`/`toolDescription` nos parameters — usa a descrição auto-gerada padrão do n8n para `supabaseTool`, não capturada no export). `src/tools/write/anotar.tool.ts` usa uma descrição funcionalmente equivalente escrita à mão; o comportamento de quando chamar continua vindo do system prompt (seção "## FERRAMENTA: Anotar"), como no original.

**Fonte de cada campo gravado** (confirmado lendo `fieldsUi.fieldValues` de cada node — nenhuma tool grava um campo que não estava aqui):
- `Procedimento`: `userID` = `Webhook1.body.conversation.contact_inbox.source_id` (contexto) · `Procedimento` = `$fromAI` · `Data_envio` = `Date & Time.currentDate` (contexto).
- `Anotar`: `userID` = contexto · `NomeCompleto` = `$fromAI("nome_completo", ...)` · `período_do_dia` = `$fromAI("Periodo_do_dia", ...)` · `Data_envio` = contexto.
- `leadsQuentes`: **nenhum campo vem do LLM** — `nome` = `Normalização.Client.senderName`, `numero` = `contact_inbox.source_id`, `criado_em` = contexto. A tool é chamada sem parâmetros (o LLM só decide *quando*).
- `AtendimentoHumano`: **nenhum campo vem do LLM** — `telefone` = `contact_inbox.source_id`, `nome` = `Client.senderName`, `data_envio` = contexto. Mesma observação de `leadsQuentes`.

---

## 8. Divergências prompt × grafo (catalogadas, decisão registrada)

1. **Pós-agendamento**: prompt promete "Modo Suporte" (continua respondendo); grafo implementa silêncio total (seção 4, passo 6). **Decisão do usuário: reproduzir o silêncio total.**
2. **REGRA 5 do prompt** ("verificar no Redis nome_completo/periodo_dia") não corresponde a nenhum nó real de leitura dessas duas chaves — o efeito equivalente vem do histórico de conversa completo na memória LangChain (seção 7). Reproduzir via memória de conversa, não via lookup de chave dedicada.
3. Demais regras do prompt (voucher 48h, proibição de "grátis", estrutura de resposta, etc.) não têm contraparte estrutural no grafo — são inteiramente responsabilidade do LLM seguir o system prompt. Reproduzir apenas transportando o prompt integralmente (Prompt Engine), sem tentar codificar essas regras em lógica de aplicação.
4. **Conversão texto→áudio (ElevenLabs)**: o original converte parágrafos elegíveis (≥350 chars, sem URL/telefone/endereço/menção a contato humano) em áudio via ElevenLabs antes de enviar ao Chatwoot (seção 10). **Decisão do usuário: a Nanda 2.0 não faz essa conversão** — `src/services/message-classifier.service.ts` só distingui texto de imagem; a lógica de elegibilidade/limiar/`cleanForAudio` foi removida (não apenas desativada). Se a conversão para áudio ainda for necessária em produção, ela passa a ser responsabilidade do próprio n8n, fora do escopo desta API — a Nanda 2.0 sempre entrega texto (ou imagem).

## 9. Segurança — credenciais em texto plano encontradas no export

O JSON exportado contém, em texto plano:
- API key do Chatwoot (`Kira.kiraApiKey`, no node `Normalização`)
- API key da ElevenLabs (`xi-api-key`, no node `ElevenLabs`)
- URL da instância Chatwoot

Credenciais de Redis/Supabase/OpenAI/Pinecone/OpenRouter estão referenciadas só por ID de credencial n8n (não expostas no JSON).

**Ação obrigatória antes de qualquer commit público**: nenhuma dessas chaves deve entrar no repositório da Nanda 2.0 — todas via variável de ambiente / secret manager desde o primeiro commit. Recomenda-se rotacionar a API key do Chatwoot e da ElevenLabs já que estiveram em texto plano neste arquivo.

## 10. Pós-processamento e formatação de saída

**Parser Chain** (`chainLlm`, modelo `OpenAI3` = `gpt-4.1-mini`, `OutputParser1` = structured parser com schema `{ messages: string[] }`): recebe `AI Agent.output` inteiro e reformata em 1 a 4 mensagens estilo WhatsApp, com regras fixas no prompt do parser:
- Preferir 2 mensagens; máx. 300 caracteres cada; só separar por tópicos realmente diferentes.
- Nunca separar mensagem vazia.
- Link sempre em mensagem própria, sem alteração.
- Markdown do WhatsApp: `*negrito*` (nunca `**`), `~tachado~`, `_itálico_` (raro), `` `link` `` (sempre entre crases).

**TEXT** (Set, **disabled** → atua como passthrough) → **Split Out** (`fieldToSplitOut: " output.messages"`, nota o espaço inicial — comportamento observado deve ser testado ao portar, mas resultado esperado é 1 item por mensagem do array) → **Code in JavaScript** (classifica cada item):

Regras de classificação (arquivo função íntegra no node, reproduzir 1:1):
- Detecta URL de imagem (markdown `![]()` ou URL com extensão de imagem / host de CDN conhecido) → força `sendAs: 'image'`.
- Detecta "bloqueado para áudio" (contém URL, telefone, endereço, ou palavras de contato humano) → força `sendAs: 'text'` mesmo se elegível por tamanho.
- Entre os parágrafos "elegíveis" (não forçados), soma caracteres; se o total ≥ 350 chars, o **primeiro** parágrafo elegível vira `sendAs: 'audio'`; os demais continuam texto.
- Caso contrário, tudo é `text`.
- `cleanForAudio`: remove `**`, `*`, `_`, `` ` `` e normaliza espaços antes de mandar pro TTS.

**Loop Over Items** (`splitInBatches`, tamanho 1) → **Switch2** por `sendAs`:
- `audio` → **ElevenLabs** (`POST /v1/text-to-speech/xI2gSeeWWvXGv1oUM2Ft`, `model_id: eleven_turbo_v2_5`, `voice_settings: {stability:0.4, similarity_boost:0.85, style:0.8, use_speaker_boost:true}`) → **sendChatWoot** (multipart, `file_type: "Áudio"`) → **Wait** (8s) → próximo item.
- `texto` → **sendChatWoot2** (multipart, `content` = texto) → **Wait2** (8s) → próximo item.
- `imagem` → **HTTP Request** (baixa a URL como arquivo binário) → **sendChatWoot1** (multipart, `attachments[]`, `file_type: "data"`) → **Wait3** (8s) → próximo item.

Todas as chamadas ao Chatwoot usam o mesmo endpoint: `POST {kirawootUrl}api/v1/accounts/{accountID}/conversations/{conversationId}/messages`, header `api_access_token`.

---

## 11. Catálogo de constantes a extrair para configuração

| Constante | Valor observado |
|---|---|
| Janela de debounce (silêncio) | 20s |
| Intervalo de polling do debounce | 1s |
| Limiar de caracteres p/ virar áudio | 350 chars (soma dos parágrafos elegíveis) |
| Limite de caracteres por mensagem no split | 300 chars |
| Preferência de quantidade de mensagens no split | 2 (podendo variar de 1 a 4) |
| Wait entre envios sequenciais (texto/áudio) | 8s |
| Wait entre envios sequenciais (imagem) | 15s (`Wait` node = 15) — **conferir**: node `Wait` (áudio) = 15s, `Wait2` (texto) = 8s, `Wait3` (imagem) = 8s. Ver nota abaixo. |
| accountID Chatwoot | `1` |
| Modelo do agente principal | `gpt-4o`, temp 0.8, topP 0.9, freqPenalty 0.3 |
| Modelo do parser de split | `gpt-4.1-mini` |
| Modelo de visão | `gpt-4o-mini` |
| Modelo de transcrição | Whisper (default do node, idioma `pt`) |
| Voz ElevenLabs | `xI2gSeeWWvXGv1oUM2Ft`, `eleven_turbo_v2_5` |
| Índices Pinecone | `nandafaq1` (preço/voucher), `nandafaq2` (objeções), `nandafaq3` (procedimentos), `nandafaq4` (dúvidas/logística) |

**Nota sobre os Waits**: reconferir ao portar — o node `Wait` (id `3130490c`, ligado a `sendChatWoot`→ áudio) tem `amount: 15`; `Wait2` (ligado a `sendChatWoot2`→ texto) e `Wait3` (ligado a `sendChatWoot1`→imagem) têm `amount: 8`. Ou seja: **áudio espera 15s, texto e imagem esperam 8s** entre um envio e o próximo item do loop.

**Nota Nanda 2.0**: as linhas "Limiar de caracteres p/ virar áudio", "Wait ... áudio" e "Voz ElevenLabs" acima documentam o comportamento **original do n8n**, mas não são implementadas na Nanda 2.0 (ver divergência 4 na Seção 8) — aqui só existem os waits de texto (8s) e imagem (8s).

---

## 12. Nós desabilitados/órfãos (não reproduzir)

- `OpenAI Chat Model1` (gpt-4o, disabled, desconectado)
- `Chat Memory Manager` (memoryManager delete-all, disabled — ferramenta manual de reset, não faz parte do fluxo automático)
- `OpenRouter Chat Model` (disabled, desconectado)
- `OpenAI Chat Model5` (gpt-5, disabled, desconectado)
- `Converter Arquivo1` (convertToFile, não conectado a nada)
- `TEXT` (disabled — atua como passthrough puro, ver seção 10)
- `Supabase` (node "Supabase", disabled, busca pré-agendamento por chave literal `"telefone"` — resíduo de versão antiga, substituído por `Supabase3`)

---

## 13. Tabelas Supabase usadas em produção

| Tabela | Escrita por | Leitura por | Campos |
|---|---|---|---|
| `leads_noturnos` | `Supabase2` | `Supabase1` | `numero_usuario`, `nome_usuario`, `data_envio` |
| `"pré agendamentos"` | `Anotar` (tool do agente) | `Supabase3` | `userID`, `NomeCompleto`, `período_do_dia`, `Data_envio` |
| `"Interesse do cliente"` | `Procedimento` (tool) | — | `userID`, `Procedimento`, `Data_envio` |
| `leads_quentes` | `leadsQuentes` (tool) | — | `nome`, `numero`, `criado_em` |
| `atendimento_humano` | `AtendimentoHumano` (tool) | — | `telefone`, `nome`, `data_envio` |

---

Este documento cobre a totalidade dos 50 nós do export. Qualquer comportamento não descrito aqui não deve ser assumido/inferido durante a implementação — voltar a este arquivo (ou ao JSON original) antes de decidir.
