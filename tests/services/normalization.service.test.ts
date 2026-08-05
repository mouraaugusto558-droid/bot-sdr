import { describe, expect, it } from 'vitest';
import { normalizeChatwootWebhook } from '../../src/services/normalization.service.js';
import type { ChatwootWebhookBody } from '../../src/api/schemas/chatwoot-webhook.schema.js';

function baseBody(overrides: ChatwootWebhookBody = {}): ChatwootWebhookBody {
  return {
    conversation: {
      channel: 'whatsapp',
      status: 'open',
      contact_inbox: { source_id: 'contact-inbox-123' },
      messages: [
        {
          id: 42,
          created_at: 1700000000,
          conversation_id: 999,
          source_id: 'dead-source-id',
          sender_type: 'Contact',
          sender: { identifier: '5581999998888@s.whatsapp.net', name: 'Fulano' },
        },
      ],
    },
    sender: { name: 'Fulano', email: 'fulano@example.com' },
    ...overrides,
  };
}

describe('normalizeChatwootWebhook', () => {
  it('extrai texto simples via content_type/content', () => {
    const result = normalizeChatwootWebhook(
      baseBody({ content: 'Olá, quero agendar', content_type: 'text' }),
    );
    expect(result.message.type).toBe('text');
    expect(result.message.content).toBe('Olá, quero agendar');
  });

  it('detecta imagem via attachment file_type', () => {
    const result = normalizeChatwootWebhook(
      baseBody({
        conversation: {
          ...baseBody().conversation,
          messages: [
            { ...baseBody().conversation!.messages![0]!, attachments: [{ file_type: 'image' }] },
          ],
        },
      }),
    );
    expect(result.message.type).toBe('image');
  });

  it('detecta áudio via attachment file_type', () => {
    const result = normalizeChatwootWebhook(
      baseBody({
        conversation: {
          ...baseBody().conversation,
          messages: [
            { ...baseBody().conversation!.messages![0]!, attachments: [{ file_type: 'audio' }] },
          ],
        },
      }),
    );
    expect(result.message.type).toBe('audio');
  });

  it('resolve extensão de arquivo (ex. pdf) via attachment file_type=file', () => {
    const result = normalizeChatwootWebhook(
      baseBody({
        conversation: {
          ...baseBody().conversation,
          messages: [
            {
              ...baseBody().conversation!.messages![0]!,
              attachments: [{ file_type: 'file', data_url: 'https://cdn.example.com/doc.pdf' }],
            },
          ],
        },
      }),
    );
    expect(result.message.type).toBe('pdf');
  });

  it('detecta texto via payload cru estilo WhatsApp (extendedTextMessage)', () => {
    const result = normalizeChatwootWebhook(
      baseBody({ data: { message: { extendedTextMessage: { text: 'oi' } } } }),
    );
    expect(result.message.type).toBe('text');
    expect(result.message.content).toBe('oi');
  });

  it('detecta texto via payload cru estilo WhatsApp (conversation)', () => {
    const result = normalizeChatwootWebhook(baseBody({ data: { message: { conversation: 'oi direto' } } }));
    expect(result.message.type).toBe('text');
  });

  it('detecta áudio via payload cru estilo WhatsApp (audioMessage)', () => {
    const result = normalizeChatwootWebhook(baseBody({ data: { message: { audioMessage: {} } } }));
    expect(result.message.type).toBe('audio');
  });

  it('detecta imagem via payload cru estilo WhatsApp (imageMessage) e usa a caption como conteúdo', () => {
    const result = normalizeChatwootWebhook(
      baseBody({ data: { message: { imageMessage: { caption: 'legenda' } } } }),
    );
    expect(result.message.type).toBe('image');
    expect(result.message.content).toBe('legenda');
  });

  it('retorna type null quando nada bate (equivalente ao fallback "none" do Switch original)', () => {
    const result = normalizeChatwootWebhook(baseBody());
    expect(result.message.type).toBeNull();
  });

  it('resolve contentUrl a partir de body.attachments (não do array aninhado em conversation.messages)', () => {
    const result = normalizeChatwootWebhook(
      baseBody({ attachments: [{ data_url: 'https://cdn.example.com/a.jpg' }] }),
    );
    expect(result.message.contentUrl).toBe('https://cdn.example.com/a.jpg');
  });

  it('resolve contentUrl via data.mediaUrl quando não há attachments no topo', () => {
    const result = normalizeChatwootWebhook(baseBody({ data: { mediaUrl: 'https://cdn.example.com/m.mp3' } }));
    expect(result.message.contentUrl).toBe('https://cdn.example.com/m.mp3');
  });

  it('mantém os três identificadores de cliente distintos e não os confunde', () => {
    const result = normalizeChatwootWebhook(baseBody());
    expect(result.client.senderId).toBe('5581999998888');
    expect(result.client.sourceId).toBe('dead-source-id');
    expect(result.client.contactInboxSourceId).toBe('contact-inbox-123');
  });

  it('converte created_at (epoch em segundos) para ISO 8601', () => {
    const result = normalizeChatwootWebhook(baseBody());
    expect(result.message.timestamp).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('assigneeName cai em string vazia (não null) quando ausente, igual ao node original', () => {
    const result = normalizeChatwootWebhook(baseBody());
    expect(result.conversationMeta.assigneeName).toBe('');
  });

  it('labels cai em array vazio quando ausente', () => {
    const result = normalizeChatwootWebhook(baseBody());
    expect(result.conversationMeta.labels).toEqual([]);
  });
});
