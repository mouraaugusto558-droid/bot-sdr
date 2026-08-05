import { ChatOpenAI } from '@langchain/openai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { loadEnv } from '../../config/env.js';
import { PARSER_CHAIN_MODEL } from '../../config/models.js';
import { getParserChainPrompt } from '../../prompt/prompt-registry.js';
import type { AgentTurnState } from '../state.js';

/**
 * Equivalente à "Parser Chain" original (`chainLlm`, `gpt-4.1-mini` + structured output
 * `{ messages: string[] }`) — docs/reverse-engineering.md, Seção 10. Único node que fala
 * com um modelo OpenAI diferente do agente principal; nunca toca Redis/Postgres/Chatwoot
 * (mantém a regra de "sem infra dentro do grafo").
 */
const outputSchema = z.object({ messages: z.array(z.string()) });

let parserBaseModel: ChatOpenAI | null = null;

function getParserBaseModel(): ChatOpenAI {
  parserBaseModel ??= new ChatOpenAI({ apiKey: loadEnv().OPENAI_API_KEY, model: PARSER_CHAIN_MODEL.model });
  return parserBaseModel;
}

export async function formatSplitNode(
  state: AgentTurnState,
  config?: RunnableConfig,
): Promise<Partial<AgentTurnState>> {
  const lastMessage = state.messages.at(-1);
  const text = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

  const result = await getParserBaseModel()
    .withStructuredOutput(outputSchema)
    .invoke(
      [
        { role: 'system', content: getParserChainPrompt() },
        { role: 'user', content: text },
      ],
      { ...config, metadata: { ...config?.metadata, modelKey: 'parser' } },
    );

  return { splitMessages: result.messages };
}
