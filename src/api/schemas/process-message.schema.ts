import { z } from 'zod';

/**
 * Contrato de entrada desta API: o n8n já resolveu o conteúdo para texto puro (áudio
 * transcrito, imagem/PDF descritos) e já decidiu que esta mensagem deve seguir para a
 * Nanda (gates de negócio ficam no próprio n8n — ver docs/reverse-engineering.md, Seção 8).
 */
export const processMessageBodySchema = z.object({
  accountId: z.string().min(1),
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  contactInboxSourceId: z.string().min(1),
  senderName: z.string().nullable().optional(),
  messageId: z.string().min(1).nullable().optional(),
  timestamp: z.string().nullable().optional(),
  text: z.string().min(1),
});

export type ProcessMessageBody = z.infer<typeof processMessageBodySchema>;
