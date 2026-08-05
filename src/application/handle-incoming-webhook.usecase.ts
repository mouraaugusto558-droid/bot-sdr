import { normalizeChatwootWebhook } from '../services/normalization.service.js';
import { markProcessedIfNew } from '../services/idempotency.service.js';
import { getRedisClient } from '../adapters/redis.adapter.js';
import { enqueueIncomingMessage } from './process-incoming-message.job.js';
import { logger } from '../shared/logger.js';
import type { ChatwootWebhookBody } from '../api/schemas/chatwoot-webhook.schema.js';

export interface HandleWebhookResult {
  status: 'queued' | 'duplicate';
  messageId: string | null;
  conversationId: string | null;
}

/**
 * Único trabalho síncrono do handler HTTP: normalizar (função pura), checar idempotência
 * e enfileirar. Tudo o mais (gates, buffer/debounce, agente, entrega) roda depois, em
 * worker, nunca aqui — ver plano de implementação, Seção 2.
 */
export async function handleIncomingWebhook(body: ChatwootWebhookBody): Promise<HandleWebhookResult> {
  const normalized = normalizeChatwootWebhook(body);
  const { messageId, conversationId } = {
    messageId: normalized.message.id,
    conversationId: normalized.client.conversationId,
  };

  if (messageId) {
    const isNew = await markProcessedIfNew(getRedisClient(), messageId);
    if (!isNew) {
      logger.debug({ messageId }, 'Webhook duplicado ignorado (idempotência)');
      return { status: 'duplicate', messageId, conversationId };
    }
  }

  await enqueueIncomingMessage(normalized);
  return { status: 'queued', messageId, conversationId };
}
