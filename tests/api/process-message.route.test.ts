import { describe, expect, it, vi, beforeEach } from 'vitest';

const processIncomingMessage = vi.fn();
vi.mock('../../src/application/process-message.usecase.js', () => ({ processIncomingMessage }));

const { buildServer } = await import('../../src/api/server.js');

const validPayload = {
  accountId: '1',
  conversationId: '10',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-abc',
  senderName: 'Fulano',
  messageId: 'msg-1',
  timestamp: new Date().toISOString(),
  text: 'quero saber sobre implante',
};

describe('POST /messages', () => {
  beforeEach(() => {
    processIncomingMessage.mockReset();
  });

  it('responde 200 com o resultado do caso de uso para um payload válido', async () => {
    processIncomingMessage.mockResolvedValue({
      status: 'answered',
      conversationId: '10',
      messageId: 'msg-1',
      messages: ['oi!'],
    });
    const app = buildServer();

    const response = await app.inject({ method: 'POST', url: '/messages', payload: validPayload });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'answered',
      conversationId: '10',
      messageId: 'msg-1',
      messages: ['oi!'],
    });
    expect(processIncomingMessage).toHaveBeenCalledWith(validPayload);
  });

  it('responde 400 quando falta um campo obrigatório', async () => {
    const app = buildServer();
    const invalidPayload: Record<string, unknown> = { ...validPayload };
    delete invalidPayload.text;

    const response = await app.inject({ method: 'POST', url: '/messages', payload: invalidPayload });

    expect(response.statusCode).toBe(400);
    expect(processIncomingMessage).not.toHaveBeenCalled();
  });
});
