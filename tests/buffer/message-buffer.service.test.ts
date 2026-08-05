import { describe, expect, it } from 'vitest';
import {
  bufferKey,
  clearBuffer,
  concatenateBuffer,
  pushToBuffer,
  readBuffer,
  type BufferRedisClient,
} from '../../src/buffer/message-buffer.service.js';

function createFakeRedis(): BufferRedisClient {
  const store = new Map<string, string[]>();
  return {
    async rpush(key, value) {
      const list = store.get(key) ?? [];
      list.push(value);
      store.set(key, list);
      return list.length;
    },
    async lrange(key) {
      return store.get(key) ?? [];
    },
    async del(key) {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    },
  };
}

describe('message-buffer.service', () => {
  it('gera a chave no formato buffer:{accountId}:{senderId}', () => {
    expect(bufferKey('1', '5581999998888')).toBe('buffer:1:5581999998888');
  });

  it('empilha, lê na ordem de inserção e concatena sem reordenar', async () => {
    const redis = createFakeRedis();
    const key = bufferKey('1', '5581999998888');

    await pushToBuffer(redis, key, { message: 'oi', messageId: '1', timestamp: 't1' });
    await pushToBuffer(redis, key, { message: 'tudo bem?', messageId: '2', timestamp: 't2' });

    const entries = await readBuffer(redis, key);
    expect(entries.map((e) => e.message)).toEqual(['oi', 'tudo bem?']);
    expect(concatenateBuffer(entries)).toBe('oi tudo bem?');
  });

  it('limpa o buffer', async () => {
    const redis = createFakeRedis();
    const key = bufferKey('1', '5581999998888');
    await pushToBuffer(redis, key, { message: 'oi', messageId: '1', timestamp: 't1' });

    await clearBuffer(redis, key);

    expect(await readBuffer(redis, key)).toEqual([]);
  });
});
