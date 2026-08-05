import type { NormalizedIncomingMessage } from './message.js';
import type { NormalizedClient } from './client.js';
import type { ConversationMeta } from './conversation.js';

/** Resultado da normalização de um webhook cru do Chatwoot. Ver docs/reverse-engineering.md, Seção 2. */
export interface NormalizedWebhookEvent {
  message: NormalizedIncomingMessage;
  client: NormalizedClient;
  conversationMeta: ConversationMeta;
}
