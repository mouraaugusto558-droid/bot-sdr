import { describe, expect, it } from 'vitest';
import { markProcessedIfNew, type IdempotencyRedisClient } from '../../src/services/idempotency.service.js';

function createFakeRedis(): IdempotencyRedisClient {
  const store = new Set<string>();
  return {
    async set(key, _value, _mode, _ttlSeconds, _flag) {
      if (store.has(key)) return null;
      store.add(key);
      return 'OK';
    },
  };
}

describe('markProcessedIfNew', () => {
  it('retorna true na primeira vez que vê um messageId', async () => {
    const redis = createFakeRedis();

    expect(await markProcessedIfNew(redis, 'msg-1')).toBe(true);
  });

  it('retorna false para o mesmo messageId numa segunda chamada (duplicado)', async () => {
    const redis = createFakeRedis();

    await markProcessedIfNew(redis, 'msg-1');
    const result = await markProcessedIfNew(redis, 'msg-1');

    expect(result).toBe(false);
  });

  it('trata messageIds diferentes de forma independente', async () => {
    const redis = createFakeRedis();

    expect(await markProcessedIfNew(redis, 'msg-1')).toBe(true);
    expect(await markProcessedIfNew(redis, 'msg-2')).toBe(true);
  });
});
