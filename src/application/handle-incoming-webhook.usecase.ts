import { normalizeChatwootWebhook } from '../services/normalization.service.js';
import { enqueueIncomingMessage } from './process-incoming-message.job.js';
import type { ChatwootWebhookBody } from '../api/schemas/chatwoot-webhook.schema.js';

export interface HandleWebhookResult {
  status: 'queued';
  messageId: string | null;
  conversationId: string | null;
}

/**
 * Único trabalho síncrono do handler HTTP: normalizar (função pura) e enfileirar.
 * Tudo o mais (gates, buffer/debounce, agente, entrega) roda depois, em worker,
 * nunca aqui — ver plano de implementação, Seção 2.
 */
export async function handleIncomingWebhook(body: ChatwootWebhookBody): Promise<HandleWebhookResult> {
  const normalized = normalizeChatwootWebhook(body);
  await enqueueIncomingMessage(normalized);
  return {
    status: 'queued',
    messageId: normalized.message.id,
    conversationId: normalized.client.conversationId,
  };
}
