import type { Redis } from 'ioredis';
import { getRedisClient } from '../adapters/redis.adapter.js';
import { markProcessedIfNew } from '../services/idempotency.service.js';
import { bufferKey, clearBuffer, concatenateBuffer, pushToBuffer, readBuffer } from '../buffer/message-buffer.service.js';
import { bufferAndWait } from '../buffer/debounce-coordinator.js';
import { withConversationLock } from '../session/conversation-lock.js';
import { runAgentTurn } from './run-agent-turn.usecase.js';
import { DEBOUNCE_WINDOW_MS } from '../config/constants.js';
import { logger } from '../shared/logger.js';
import type { ProcessMessageBody } from '../api/schemas/process-message.schema.js';

export type ProcessMessageResult =
  | { status: 'duplicate'; conversationId: string; messageId: string | null }
  | { status: 'superseded'; conversationId: string; messageId: string | null }
  | { status: 'answered'; conversationId: string; messageId: string | null; messages: string[] };

/**
 * Único caso de uso desta API: bufferiza a mensagem (janela de silêncio de 20s,
 * `buffer/debounce-coordinator.ts`) e, quando a janela fecha sem nova mensagem, roda o
 * turno do agente (memória + RAG + tools + LLM + split/format) e devolve a resposta no
 * mesmo request HTTP que a originou. Chamadas superadas por uma mensagem mais nova
 * retornam na hora, sem esperar a janela inteira.
 */
export async function processIncomingMessage(body: ProcessMessageBody): Promise<ProcessMessageResult> {
  const redis = getRedisClient();
  const messageId = body.messageId ?? null;

  if (messageId) {
    const isNew = await markProcessedIfNew(redis, messageId);
    if (!isNew) {
      logger.debug({ messageId }, 'Mensagem duplicada ignorada (idempotência)');
      return { status: 'duplicate', conversationId: body.conversationId, messageId };
    }
  }

  const key = bufferKey(body.accountId, body.senderId);
  await pushToBuffer(redis, key, {
    message: body.text,
    messageId,
    timestamp: body.timestamp ?? new Date().toISOString(),
  });

  const outcome = await bufferAndWait(key, DEBOUNCE_WINDOW_MS, () => flushAndRunAgentTurn(redis, key, body));

  if (outcome.status === 'superseded') {
    return { status: 'superseded', conversationId: body.conversationId, messageId };
  }
  return { status: 'answered', conversationId: body.conversationId, messageId, messages: outcome.result };
}

async function flushAndRunAgentTurn(redis: Redis, key: string, body: ProcessMessageBody): Promise<string[]> {
  return withConversationLock(redis, key, async () => {
    const entries = await readBuffer(redis, key);
    await clearBuffer(redis, key);
    const text = entries.length > 0 ? concatenateBuffer(entries) : body.text;

    const result = await runAgentTurn({
      conversationId: body.conversationId,
      senderId: body.senderId,
      accountId: body.accountId,
      contactInboxSourceId: body.contactInboxSourceId,
      senderName: body.senderName ?? null,
      text,
    });
    return result.messages;
  });
}
