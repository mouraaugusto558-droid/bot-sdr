import type { ChatwootWebhookBody } from '../api/schemas/chatwoot-webhook.schema.js';
import type { NormalizedWebhookEvent } from '../domain/normalized-message.js';

/**
 * Reproduz exatamente as cascatas de extração de campo do node "Normalização" do
 * workflow original. Ver docs/reverse-engineering.md, Seção 2, para a origem de cada
 * expressão — não alterar sem atualizar aquele documento primeiro.
 *
 * Função pura: sem I/O, sem side effects.
 */
export function normalizeChatwootWebhook(body: ChatwootWebhookBody): NormalizedWebhookEvent {
  const firstMessage = body.conversation?.messages?.[0];
  const firstAttachment = firstMessage?.attachments?.[0];

  return {
    message: {
      id: firstMessage?.id != null ? String(firstMessage.id) : (body.data?.key?.id != null ? String(body.data.key.id) : null),
      timestamp: toIsoTimestamp(firstMessage?.created_at),
      type: resolveMessageType(body, firstAttachment),
      content: resolveMessageContent(body),
      contentUrl: body.attachments?.[0]?.data_url ?? body.data?.mediaUrl ?? null,
    },
    client: {
      channel: body.conversation?.channel ?? null,
      conversationId: firstMessage?.conversation_id != null ? String(firstMessage.conversation_id) : null,
      senderName: body.sender?.name ?? body.data?.pushName ?? null,
      senderType: firstMessage?.sender_type ?? null,
      senderId: extractPhoneFromIdentifier(firstMessage?.sender?.identifier),
      sourceId: firstMessage?.source_id ?? null,
      contactInboxSourceId: body.conversation?.contact_inbox?.source_id ?? null,
      email: body.sender?.email ?? null,
    },
    conversationMeta: {
      assigneeName: body.conversation?.meta?.assignee?.name ?? '',
      assigneeType: body.conversation?.meta?.assignee?.type ?? null,
      status: body.conversation?.status ?? null,
      labels: body.conversation?.labels ?? [],
    },
  };
}

function resolveMessageType(
  body: ChatwootWebhookBody,
  firstAttachment: { file_type?: string | undefined; data_url?: string | undefined } | undefined,
): string | null {
  if (firstAttachment?.file_type === 'image') return 'image';
  if (firstAttachment?.file_type === 'audio') return 'audio';
  if (firstAttachment?.file_type === 'file') return fileExtension(firstAttachment.data_url) ?? '';
  if (body.content_type === 'text' && body.content) return 'text';
  if (body.data?.message?.extendedTextMessage) return 'text';
  if (body.data?.message?.conversation) return 'text';
  if (body.data?.message?.audioMessage) return 'audio';
  if (body.data?.message?.imageMessage) return 'image';
  return null;
}

function resolveMessageContent(body: ChatwootWebhookBody): string | null {
  return (
    body.content ??
    body.data?.message?.extendedTextMessage?.text ??
    body.data?.message?.imageMessage?.caption ??
    body.data?.message?.conversation ??
    // Fallback do node original (`$json.message.text/caption`, fora de `body`) — no n8n,
    // referenciava um item irmão de `body`. Como nossa API recebe o corpo do webhook
    // diretamente (sem o wrapper `{headers, body}` do n8n), o equivalente mais fiel é
    // reconsultar o próprio corpo; mantido como último fallback por paridade documental.
    body.message?.text ??
    body.message?.caption ??
    null
  );
}

function extractPhoneFromIdentifier(identifier: string | undefined): string | null {
  if (!identifier) return null;
  return identifier.split('@')[0] ?? null;
}

function fileExtension(dataUrl: string | undefined): string | null {
  if (!dataUrl) return null;
  const parts = dataUrl.split('.');
  return parts.length > 1 ? (parts.pop() ?? null) : null;
}

function toIsoTimestamp(createdAt: number | string | undefined): string | null {
  if (createdAt == null) return null;
  const seconds = typeof createdAt === 'string' ? Number(createdAt) : createdAt;
  if (Number.isNaN(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
