/**
 * Identificadores de cliente/conversa. Existem TRÊS campos de "source_id" no payload
 * original com usos completamente diferentes — não confundir (ver docs/reverse-engineering.md,
 * Seção 2):
 *  - senderId: telefone extraído de sender.identifier. Usado só como chave do buffer Redis (debounce).
 *  - sourceId: conversation.messages[0].source_id. Campo morto — nunca lido em produção.
 *  - contactInboxSourceId: conversation.contact_inbox.source_id. O identificador REAL do
 *    cliente, usado em todas as tabelas Supabase e na sessionKey da memória de conversa.
 */
export interface NormalizedClient {
  channel: string | null;
  conversationId: string | null;
  senderName: string | null;
  senderType: string | null;
  senderId: string | null;
  sourceId: string | null;
  contactInboxSourceId: string | null;
  email: string | null;
}
