import { describe, expect, it, vi, beforeEach } from 'vitest';

process.env.DEBOUNCE_WINDOW_MS = '20';

function createFakeRedis() {
  const lists = new Map<string, string[]>();
  const expiries = new Map<string, number>();
  return {
    async rpush(key: string, value: string) {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    },
    async lrange(key: string) {
      return lists.get(key) ?? [];
    },
    async del(key: string) {
      const existed = lists.delete(key);
      return existed ? 1 : 0;
    },
    async set(key: string, _value: string, mode: 'EX' | 'PX', duration: number) {
      const now = Date.now();
      const existing = expiries.get(key);
      if (existing !== undefined && existing > now) return null;
      expiries.set(key, now + (mode === 'EX' ? duration * 1000 : duration));
      return 'OK' as const;
    },
  };
}

const fakeRedis = createFakeRedis();
vi.mock('../../src/adapters/redis.adapter.js', () => ({
  getRedisClient: () => fakeRedis,
}));

const runAgentTurn = vi.fn();
vi.mock('../../src/application/run-agent-turn.usecase.js', () => ({ runAgentTurn }));

const { processIncomingMessage } = await import('../../src/application/process-message.usecase.js');

describe('processIncomingMessage', () => {
  beforeEach(() => {
    runAgentTurn.mockReset();
    runAgentTurn.mockResolvedValue({ messages: ['oi! como posso ajudar?'] });
  });

  const baseBody = {
    accountId: '1',
    conversationId: '10',
    senderName: 'Fulano',
  };

  it('bufferiza e responde "answered" com as mensagens da Nanda quando a janela de silêncio fecha', async () => {
    const result = await processIncomingMessage({
      ...baseBody,
      senderId: 'sender-single',
      contactInboxSourceId: 'contact-abc',
      messageId: 'msg-1',
      timestamp: new Date().toISOString(),
      text: 'quero saber sobre implante',
    });

    expect(result).toEqual({
      status: 'answered',
      conversationId: '10',
      messageId: 'msg-1',
      messages: ['oi! como posso ajudar?'],
    });
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
    expect(runAgentTurn).toHaveBeenCalledWith({
      conversationId: '10',
      senderId: 'sender-single',
      accountId: '1',
      contactInboxSourceId: 'contact-abc',
      senderName: 'Fulano',
      text: 'quero saber sobre implante',
    });
  });

  it('concatena mensagens bufferizadas quando chegam várias antes da janela fechar, respondendo "superseded" para as mais antigas', async () => {
    const senderId = 'sender-multi';
    const first = processIncomingMessage({
      ...baseBody,
      senderId,
      contactInboxSourceId: 'contact-abc',
      messageId: 'm1',
      text: 'oi',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = processIncomingMessage({
      ...baseBody,
      senderId,
      contactInboxSourceId: 'contact-abc',
      messageId: 'm2',
      text: 'tudo bem?',
    });

    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    expect(firstOutcome).toEqual({ status: 'superseded', conversationId: '10', messageId: 'm1' });
    expect(secondOutcome.status).toBe('answered');
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
    expect(runAgentTurn).toHaveBeenCalledWith(expect.objectContaining({ text: 'oi tudo bem?' }));
  });

  it('responde "duplicate" sem chamar o agente quando o messageId já foi processado', async () => {
    const dupBody = {
      ...baseBody,
      senderId: 'sender-dup',
      contactInboxSourceId: 'contact-abc',
      messageId: 'dup-1',
      text: 'oi',
    };

    const first = await processIncomingMessage(dupBody);
    expect(first.status).toBe('answered');

    runAgentTurn.mockClear();
    const second = await processIncomingMessage(dupBody);

    expect(second).toEqual({ status: 'duplicate', conversationId: '10', messageId: 'dup-1' });
    expect(runAgentTurn).not.toHaveBeenCalled();
  });
});
