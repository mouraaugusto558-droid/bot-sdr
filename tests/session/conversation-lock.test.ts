import { describe, expect, it } from 'vitest';
import {
  tryWithConversationLock,
  withConversationLock,
  type LockRedisClient,
} from '../../src/session/conversation-lock.js';

function createFakeLockRedis(): LockRedisClient {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    async set(key, value, _mode, durationMs, _flag) {
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expiresAt > now) {
        return null;
      }
      store.set(key, { value, expiresAt: now + durationMs });
      return 'OK';
    },
    async del(key) {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    },
  };
}

describe('tryWithConversationLock', () => {
  it('executa a função e libera o lock quando adquirido com sucesso', async () => {
    const redis = createFakeLockRedis();

    const result = await tryWithConversationLock(redis, 'buffer:1:5581999998888', async () => 'ok');

    expect(result).toBe('ok');
    // lock liberado: uma segunda chamada imediata também deve conseguir adquirir
    const second = await tryWithConversationLock(redis, 'buffer:1:5581999998888', async () => 'ok2');
    expect(second).toBe('ok2');
  });

  it('retorna "lock-held" sem executar a função quando o lock já está ocupado', async () => {
    const redis = createFakeLockRedis();
    let executions = 0;

    await tryWithConversationLock(
      redis,
      'buffer:1:5581999998888',
      async () => {
        executions += 1;
        // enquanto este ainda "segura" o lock (não liberou), uma segunda tentativa deve falhar
        const concurrent = await tryWithConversationLock(redis, 'buffer:1:5581999998888', async () => 'nunca deveria executar');
        expect(concurrent).toBe('lock-held');
        return 'primeiro';
      },
    );

    expect(executions).toBe(1);
  });

  it('libera o lock mesmo quando a função lança erro', async () => {
    const redis = createFakeLockRedis();

    await expect(
      tryWithConversationLock(redis, 'chave', async () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');

    const result = await tryWithConversationLock(redis, 'chave', async () => 'depois');
    expect(result).toBe('depois');
  });
});

describe('withConversationLock', () => {
  it('serializa duas execuções concorrentes para a mesma conversa (nenhuma sobreposição)', async () => {
    const redis = createFakeLockRedis();
    const events: string[] = [];

    async function slowCriticalSection(label: string) {
      events.push(`${label}:start`);
      await new Promise((resolve) => setTimeout(resolve, 30));
      events.push(`${label}:end`);
    }

    await Promise.all([
      withConversationLock(redis, 'buffer:1:5581999998888', () => slowCriticalSection('A')),
      withConversationLock(redis, 'buffer:1:5581999998888', () => slowCriticalSection('B')),
    ]);

    // Nunca deve haver "A:start"/"B:start" antes do "end" anterior — ou seja, um par
    // completo (start,end) sempre aparece antes do próximo par começar.
    const firstEndIndex = events.findIndex((e) => e.endsWith(':end'));
    const eventsBeforeFirstEnd = events.slice(0, firstEndIndex + 1);
    expect(eventsBeforeFirstEnd).toHaveLength(2);
    expect(eventsBeforeFirstEnd[0]?.split(':')[0]).toBe(eventsBeforeFirstEnd[1]?.split(':')[0]);
    expect(events).toHaveLength(4);
  });

  it('não serializa conversas diferentes (podem rodar em paralelo)', async () => {
    const redis = createFakeLockRedis();
    const events: string[] = [];

    async function section(label: string) {
      events.push(`${label}:start`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push(`${label}:end`);
    }

    await Promise.all([
      withConversationLock(redis, 'buffer:1:AAA', () => section('A')),
      withConversationLock(redis, 'buffer:1:BBB', () => section('B')),
    ]);

    expect(events[0]).toMatch(/:start$/);
    expect(events[1]).toMatch(/:start$/);
  });

  it('lança erro se não conseguir adquirir o lock dentro do maxWaitMs', async () => {
    const redis = createFakeLockRedis();

    await tryWithConversationLock(redis, 'chave-presa', async () => {
      await expect(
        withConversationLock(redis, 'chave-presa', async () => 'nunca', {
          maxWaitMs: 100,
          retryDelayMs: 20,
          ttlMs: 10_000,
        }),
      ).rejects.toThrow(/não foi possível adquirir/i);
    });
  });
});
