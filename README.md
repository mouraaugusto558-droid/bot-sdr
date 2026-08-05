# Nanda 2.0

Backend TypeScript code-first do agente "Nanda" (recepção via WhatsApp/Chatwoot para a Exclusive Odontologia), com LangGraph como motor de orquestração do agente. Drop-in replacement do workflow n8n original — ver `docs/reverse-engineering.md` para o comportamento de referência que este backend deve reproduzir.

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

## Checklist antes de cortar o n8n para produção

- [ ] **Rotacionar as credenciais expostas** no export n8n original (`NandaChatwoot (1).json`, nunca commitado): token da API do Chatwoot e chave da ElevenLabs — ambas estavam em texto plano (`docs/reverse-engineering.md`, Seção 9).
- [ ] Confirmar o schema real das 5 tabelas Supabase existentes (`src/adapters/postgres.schema.ts` documenta suposições de tipo/PK) via `drizzle-kit introspect` antes de rodar qualquer migration.
- [ ] Confirmar o modelo de embeddings real dos índices Pinecone `nandafaq1-4` (dimensão precisa bater — `src/config/models.ts`).
- [ ] Confirmar alcançabilidade da conexão direta Postgres do Supabase (Session Pooler / IPv6).
- [ ] Reconferir o timezone real da instância n8n original contra `TIMEZONE` (`src/config/constants.ts`) — usado para preencher "Data/hora atual" no prompt.
- [ ] Fazer um replay de conversa ponta a ponta em ambiente de staging antes do cutover final (webhook → gates → buffer/debounce → agente → classificação → entrega), comparando lado a lado com o comportamento do n8n.
- [ ] Depois de validado: reduzir o workflow n8n a só receber o webhook do Chatwoot e fazer um único HTTP Request para `POST /webhooks/chatwoot` desta API.
