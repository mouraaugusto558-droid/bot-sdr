import { describe, expect, it, vi, beforeEach } from 'vitest';

const enqueueIncomingMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/application/process-incoming-message.job.js', () => ({
  enqueueIncomingMessage,
  startIncomingMessageWorker: vi.fn(),
}));

// Idempotência (M12) chama getRedisClient()/loadEnv() de verdade — mockados aqui para o
// handler HTTP continuar testável sem Redis/env reais (mesma razão do mock acima).
vi.mock('../../src/adapters/redis.adapter.js', () => ({
  getRedisClient: vi.fn(),
}));
const markProcessedIfNew = vi.fn().mockResolvedValue(true);
vi.mock('../../src/services/idempotency.service.js', () => ({
  markProcessedIfNew,
}));

const { buildServer } = await import('../../src/api/server.js');

describe('POST /webhooks/chatwoot', () => {
  beforeEach(() => {
    enqueueIncomingMessage.mockClear();
    markProcessedIfNew.mockClear();
    markProcessedIfNew.mockResolvedValue(true);
  });

  it('normaliza, enfileira e responde 202 imediatamente para um payload válido', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/chatwoot',
      payload: {
        content: 'Olá',
        content_type: 'text',
        conversation: {
          contact_inbox: { source_id: 'abc' },
          messages: [{ id: 1, conversation_id: 10, sender_type: 'Contact' }],
        },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'queued', messageId: '1', conversationId: '10' });
    expect(enqueueIncomingMessage).toHaveBeenCalledTimes(1);
  });

  it('não enfileira novamente um webhook duplicado (idempotência) e responde status "duplicate"', async () => {
    markProcessedIfNew.mockResolvedValue(false);
    const app = buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/chatwoot',
      payload: {
        content: 'Olá',
        content_type: 'text',
        conversation: {
          contact_inbox: { source_id: 'abc' },
          messages: [{ id: 1, conversation_id: 10, sender_type: 'Contact' }],
        },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'duplicate', messageId: '1', conversationId: '10' });
    expect(enqueueIncomingMessage).not.toHaveBeenCalled();
  });

  it('responde 400 quando o corpo JSON não é um objeto', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/chatwoot',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify('isso não é um objeto'),
    });

    expect(response.statusCode).toBe(400);
    expect(enqueueIncomingMessage).not.toHaveBeenCalled();
  });
});
