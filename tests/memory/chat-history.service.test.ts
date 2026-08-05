import { describe, expect, it, vi } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  appendChatHistory,
  chatHistoryKey,
  readChatHistory,
  type MemoryRedisClient,
} from '../../src/memory/chat-history.service.js';

function createFakeRedis(initial: string[] = []): MemoryRedisClient & { store: string[] } {
  const store = [...initial];
  return {
    store,
    async rpush(_key, ...values) {
      store.push(...values);
      return store.length;
    },
    async lrange(_key, start, stop) {
      const end = stop === -1 ? store.length : stop + 1;
      return store.slice(start, end);
    },
  };
}

describe('chatHistoryKey', () => {
  it('reproduz o padrão de sessionKey do node "Redis Chat Memory" original', () => {
    expect(chatHistoryKey('contact-inbox-123', '1')).toBe('mensagens.contact-inbox-123_mem1');
  });
});

describe('readChatHistory / appendChatHistory', () => {
  it('lê uma lista vazia quando não há histórico', async () => {
    const redis = createFakeRedis();

    const history = await readChatHistory(redis, 'chave');

    expect(history).toEqual([]);
  });

  it('grava mensagens human/ai e as recupera na mesma ordem, como as classes corretas', async () => {
    const redis = createFakeRedis();
    const key = 'mensagens.contact-inbox-123_mem1';

    await appendChatHistory(redis, key, [new HumanMessage('oi'), new AIMessage('olá, tudo bem?')]);
    const history = await readChatHistory(redis, key);

    expect(history).toHaveLength(2);
    expect(history[0]).toBeInstanceOf(HumanMessage);
    expect(history[0]?.content).toBe('oi');
    expect(history[1]).toBeInstanceOf(AIMessage);
    expect(history[1]?.content).toBe('olá, tudo bem?');
  });

  it('não escreve nada quando a lista de mensagens está vazia', async () => {
    const redis = createFakeRedis();
    const rpushSpy = vi.spyOn(redis, 'rpush');

    await appendChatHistory(redis, 'chave', []);

    expect(rpushSpy).not.toHaveBeenCalled();
  });

  it('acumula histórico entre chamadas sucessivas (turnos consecutivos)', async () => {
    const redis = createFakeRedis();
    const key = 'chave';

    await appendChatHistory(redis, key, [new HumanMessage('primeira mensagem')]);
    await appendChatHistory(redis, key, [new AIMessage('resposta 1'), new HumanMessage('segunda mensagem')]);
    const history = await readChatHistory(redis, key);

    expect(history.map((m) => m.content)).toEqual(['primeira mensagem', 'resposta 1', 'segunda mensagem']);
  });
});
