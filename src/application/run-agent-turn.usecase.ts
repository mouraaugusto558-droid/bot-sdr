import { getRedisClient } from '../adapters/redis.adapter.js';
import { getDb } from '../adapters/postgres.adapter.js';
import { appendChatHistory, chatHistoryKey, readChatHistory } from '../memory/chat-history.service.js';
import { createAllToolSpecs } from '../tools/index.js';
import type { ToolExecutionContext } from '../tools/tool-registry.js';
import { runAgentTurnGraph } from '../graph/agent-turn.graph.js';
import { deliverReply } from './deliver-reply.usecase.js';
import { TraceCallbackHandler } from '../observability/trace-callback-handler.js';
import { summarizeTrace } from '../observability/trace-summary.js';
import { createAgentTracesRepository } from '../repositories/agent-traces.repository.js';
import { logger } from '../shared/logger.js';

export interface AgentTurnInput {
  conversationId: string;
  senderId: string;
  accountId: string;
  contactInboxSourceId: string;
  senderName: string | null;
  text: string;
}

/**
 * Caso de uso do "turno do agente": carrega memória (Redis) -> monta tools (Postgres) ->
 * invoca o grafo LangGraph (raciocínio + tools + format/split) -> persiste o delta de
 * memória -> entrega (classificação texto/áudio/imagem + waits sequenciais). Nenhuma dessas
 * etapas de I/O acontece dentro do grafo (Seção 0/3 do plano) — este usecase é quem as
 * orquestra ao redor dele.
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<void> {
  const redis = getRedisClient();
  const db = getDb();
  const historyKey = chatHistoryKey(input.contactInboxSourceId, input.accountId);

  const history = await readChatHistory(redis, historyKey);
  const toolSpecs = createAllToolSpecs(db);
  const ctx: ToolExecutionContext = {
    conversationId: input.conversationId,
    accountId: input.accountId,
    senderId: input.senderId,
    contactInboxSourceId: input.contactInboxSourceId,
    senderName: input.senderName,
  };

  const trace = new TraceCallbackHandler();
  const result = await runAgentTurnGraph({ text: input.text, history, toolSpecs, ctx, trace });

  const newMessages = result.updatedHistory.slice(history.length);
  await appendChatHistory(redis, historyKey, newMessages);

  const summary = summarizeTrace(trace.events);
  await createAgentTracesRepository(db)
    .record({
      conversationId: input.conversationId,
      contactInboxSourceId: input.contactInboxSourceId,
      events: trace.events,
      ...summary,
    })
    .catch((error: unknown) => {
      logger.error({ error, conversationId: input.conversationId }, 'Falha ao persistir trace do turno');
    });

  await deliverReply(input.conversationId, result.splitMessages);
}
