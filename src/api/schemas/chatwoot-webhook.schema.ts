import { z } from 'zod';

/**
 * Schema propositalmente permissivo: o payload real cascata por múltiplos formatos
 * possíveis (Chatwoot nativo vs. payload "cru" estilo WhatsApp). Ver
 * docs/reverse-engineering.md, Seção 2. Só valida que é um objeto JSON com os campos
 * que a normalização eventualmente consulta — nunca rejeita por campo ausente.
 */
const attachmentSchema = z
  .object({
    file_type: z.string().optional(),
    data_url: z.string().optional(),
  })
  .partial();

const messageItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    created_at: z.union([z.number(), z.string()]).optional(),
    conversation_id: z.union([z.number(), z.string()]).optional(),
    source_id: z.string().optional(),
    sender_type: z.string().optional(),
    sender: z
      .object({
        identifier: z.string().optional(),
        name: z.string().optional(),
      })
      .partial()
      .optional(),
    attachments: z.array(attachmentSchema).optional(),
  })
  .partial();

const conversationSchema = z
  .object({
    channel: z.string().optional(),
    status: z.string().optional(),
    labels: z.array(z.unknown()).optional(),
    meta: z
      .object({
        assignee: z
          .object({
            name: z.string().optional(),
            type: z.string().optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    messages: z.array(messageItemSchema).optional(),
    contact_inbox: z
      .object({
        source_id: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

const whatsappMessageSchema = z
  .object({
    extendedTextMessage: z.object({ text: z.string().optional() }).partial().optional(),
    conversation: z.string().optional(),
    audioMessage: z.unknown().optional(),
    imageMessage: z.object({ caption: z.string().optional() }).partial().optional(),
    documentMessage: z
      .object({ fileName: z.string().optional(), mimetype: z.string().optional() })
      .partial()
      .optional(),
  })
  .partial();

const whatsappDataSchema = z
  .object({
    pushName: z.string().optional(),
    key: z.object({ id: z.union([z.string(), z.number()]).optional() }).partial().optional(),
    message: whatsappMessageSchema.optional(),
    mediaUrl: z.string().optional(),
  })
  .partial();

export const chatwootWebhookBodySchema = z
  .object({
    content: z.string().optional(),
    content_type: z.string().optional(),
    sender: z
      .object({
        name: z.string().optional(),
        email: z.string().optional(),
      })
      .partial()
      .optional(),
    attachments: z.array(attachmentSchema).optional(),
    conversation: conversationSchema.optional(),
    data: whatsappDataSchema.optional(),
    message: z
      .object({
        text: z.string().optional(),
        caption: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export type ChatwootWebhookBody = z.infer<typeof chatwootWebhookBodySchema>;
