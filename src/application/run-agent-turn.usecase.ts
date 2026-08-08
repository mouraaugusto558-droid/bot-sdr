import { getRedisClient } from '../adapters/redis.adapter.js';
import { getDb } from '../adapters/postgres.adapter.js';
import { appendChatHistory, chatHistoryKey, readChatHistory } from '../memory/chat-history.service.js';
import { createAllToolSpecs } from '../tools/index.js';
import type { ToolExecutionContext } from '../tools/tool-registry.js';
import { runAgentTurnGraph } from '../graph/agent-turn.graph.js';
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

export interface AgentTurnResult {
  /** Mensagens já divididas pelo nó format-split (equivalente ao array final da Parser Chain). */
  messages: string[];
}

/**
 * Caso de uso do "turno do agente": carrega memória (Redis) -> monta tools (Postgres) ->
 * invoca o grafo LangGraph (raciocínio + tools + format/split) -> persiste o delta de
 * memória -> devolve as mensagens já divididas para quem chamou responder ao request HTTP.
 * Esta API não entrega nada a nenhum canal (Chatwoot/WhatsApp) — isso é responsabilidade
 * do n8n (decisão do usuário, ver docs/reverse-engineering.md Seção 8).
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const redis = getRedisClient();
  const db = getDb();
  const historyKey = chatHistoryKey(input.contactInboxSourceId, input.accountId);
  const startedAt = Date.now();

  const history = await readChatHistory(redis, historyKey);
  const toolSpecs = createAllToolSpecs(db);
  const ctx: ToolExecutionContext = {
    conversationId: input.conversationId,
    accountId: input.accountId,
    senderId: input.senderId,
    contactInboxSourceId: input.contactInboxSourceId,
    senderName: input.senderName,
  };

  logger.info({ conversationId: input.conversationId, historyLength: history.length }, 'Grafo do agente iniciado');
  const trace = new TraceCallbackHandler();
  const result = await runAgentTurnGraph({ text: input.text, history, toolSpecs, ctx, trace });
  logger.info(
    { conversationId: input.conversationId, durationMs: Date.now() - startedAt, toolCalls: trace.events.filter((e) => e.type === 'tool').length },
    'Grafo do agente concluído',
  );

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
    .then(() => {
      logger.info(
        { conversationId: input.conversationId, ...summary },
        'Postgres/Supabase: trace do turno persistido (agent_traces)',
      );
    })
    .catch((error: unknown) => {
      logger.error({ error, conversationId: input.conversationId }, 'Falha ao persistir trace do turno');
    });

  return { messages: result.splitMessages };
}
