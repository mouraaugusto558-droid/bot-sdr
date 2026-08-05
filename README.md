# Nanda 2.0

Motor de raciocínio do agente "Nanda" (recepção via WhatsApp/Chatwoot para a Exclusive Odontologia), com LangGraph como motor de orquestração. Esta API cuida só de **buffer de mensagens (janela de 20s) + agente (RAG + tools + prompt) + resposta** — chamada pelo n8n, que continua responsável por Chatwoot, mídia (áudio/imagem/PDF) e entrega da resposta ao cliente. Ver `docs/reverse-engineering.md` para o comportamento de referência do workflow n8n original e a Seção 0 daquele documento para o escopo real que este backend reproduz.

## Documentação

- `docs/guia-simples.md` — explicação do fluxo em linguagem simples + design da API (comece por aqui).
- `docs/reverse-engineering.md` — engenharia reversa completa do workflow n8n original (contrato de comportamento).
- `docs/system-prompt-original.md` — system prompt literal do agente.
- `docs/parser-chain-prompt.md` — prompt do formatador/splitter de mensagens.
- `postman/Nanda-2.0.postman_collection.json` — coleção Postman pronta para testar a API (importar no Postman).

## Desenvolvimento

```bash
cp .env.example .env   # preencher com credenciais reais
npm install
npm run dev
```

Requer Redis e Postgres acessíveis (ver `.env.example`).

## Scripts

- `npm run dev` — servidor em modo watch
- `npm run build` / `npm start` — build de produção
- `npm test` — suíte Vitest
- `npm run lint` / `npm run format` — ESLint / Prettier
- `npm run typecheck` — verificação de tipos sem emitir

## Checklist antes de integrar com o n8n em produção

- [ ] **Rotacionar as credenciais expostas** no export n8n original (`NandaChatwoot (1).json`, nunca commitado): token da API do Chatwoot e chave da ElevenLabs — ambas estavam em texto plano (`docs/reverse-engineering.md`, Seção 9). Nenhuma das duas é usada por esta API, mas continuam vivas no n8n.
- [ ] Confirmar o schema real das tabelas Supabase usadas pelas tools (`src/adapters/postgres.schema.ts` documenta suposições de tipo/PK) via `drizzle-kit introspect` antes de rodar qualquer migration.
- [ ] Confirmar o modelo de embeddings real dos índices Pinecone `nandafaq1-4` (dimensão precisa bater — `src/config/models.ts`).
- [ ] Confirmar alcançabilidade da conexão direta Postgres do Supabase (Session Pooler / IPv6).
- [ ] Reconferir o timezone real da instância n8n original contra `TIMEZONE` (`src/config/constants.ts`) — usado para preencher "Data/hora atual" no prompt.
- [ ] Ajustar o workflow n8n para: (1) decidir se a mensagem deve seguir para a IA (gates/labels/sender type), (2) resolver mídia (transcrever áudio, descrever imagem, extrair PDF) e (3) chamar `POST /messages` desta API com o texto pronto, aguardando a resposta síncrona para então entregar ao Chatwoot.
- [ ] Fazer um replay de conversa ponta a ponta em ambiente de staging antes do cutover final, comparando lado a lado com o comportamento do agente original.
