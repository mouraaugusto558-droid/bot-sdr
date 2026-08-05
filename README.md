# Nanda 2.0

Backend TypeScript code-first do agente "Nanda" (recepção via WhatsApp/Chatwoot para a Exclusive Odontologia), com LangGraph como motor de orquestração do agente. Drop-in replacement do workflow n8n original — ver `docs/reverse-engineering.md` para o comportamento de referência que este backend deve reproduzir.

## Documentação

- `docs/reverse-engineering.md` — engenharia reversa completa do workflow n8n original (contrato de comportamento).
- `docs/system-prompt-original.md` — system prompt literal do agente.
- `docs/parser-chain-prompt.md` — prompt do formatador/splitter de mensagens.

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
