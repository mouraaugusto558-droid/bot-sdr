/**
 * Lock distribuído por conversa (Session Manager) — serializa qualquer seção crítica que
 * toque o estado de uma conversa (buffer + debounce + memória), eliminando por construção
 * a condição de corrida do polling original (docs/reverse-engineering.md, Seção 6) mesmo
 * sob múltiplos processos/workers concorrentes, não só dentro de um único processo Node.
 */
import { logger } from '../shared/logger.js';

export interface LockRedisClient {
  set(key: string, value: string, mode: 'PX', durationMs: number, flag: 'NX'): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

const DEFAULT_TTL_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 50;
const DEFAULT_MAX_WAIT_MS = 5_000;

function lockKeyFor(conversationKey: string): string {
  return `session-lock:${conversationKey}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tenta adquirir o lock uma única vez; se já estiver ocupado, retorna `'lock-held'` sem esperar. */
export async function tryWithConversationLock<T>(
  redis: LockRedisClient,
  conversationKey: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T | 'lock-held'> {
  const lockKey = lockKeyFor(conversationKey);
  const acquired = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
  if (!acquired) {
    logger.info({ lockKey }, 'Redis: lock ocupado por outro processo');
    return 'lock-held';
  }
  logger.info({ lockKey, ttlMs }, 'Redis: lock adquirido (SET NX)');
  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
    logger.info({ lockKey }, 'Redis: lock liberado');
  }
}

export interface WithConversationLockOptions {
  ttlMs?: number;
  retryDelayMs?: number;
  maxWaitMs?: number;
}

/** Adquire o lock, esperando/retentando se necessário — usar quando o trabalho não pode ser simplesmente descartado. */
export async function withConversationLock<T>(
  redis: LockRedisClient,
  conversationKey: string,
  fn: () => Promise<T>,
  options: WithConversationLockOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const deadline = Date.now() + maxWaitMs;

  for (;;) {
    const result = await tryWithConversationLock(redis, conversationKey, fn, ttlMs);
    if (result !== 'lock-held') {
      return result;
    }
    if (Date.now() >= deadline) {
      logger.error({ conversationKey, maxWaitMs }, 'Redis: timeout esperando o lock da conversa');
      throw new Error(`Não foi possível adquirir o lock da conversa "${conversationKey}" a tempo`);
    }
    await sleep(retryDelayMs);
  }
}
