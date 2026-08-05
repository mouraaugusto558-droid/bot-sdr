import type { Job, Queue } from 'bullmq';
import { createQueue, createWorker } from '../adapters/queue.adapter.js';
import { getRedisClient } from '../adapters/redis.adapter.js';
import { readBuffer, clearBuffer, concatenateBuffer } from '../buffer/message-buffer.service.js';
import { runAgentTurn } from './run-agent-turn.usecase.js';
import { logger } from '../shared/logger.js';

export const DEBOUNCE_QUEUE = 'debounce-flush';

export interface DebounceFlushJobData {
  conversationKey: string;
  conversationId: string;
  senderId: string;
  accountId: string;
}

let queue: Queue<DebounceFlushJobData> | null = null;
export function getDebounceQueue(): Queue<DebounceFlushJobData> {
  queue ??= createQueue<DebounceFlushJobData>(DEBOUNCE_QUEUE);
  return queue;
}

/**
 * Dispara quando a janela de silêncio (20s, ver buffer/debounce.service.ts) expira sem
 * reagendamento. Lock Redis curto é defesa-em-profundidade para a seção crítica
 * ler-então-apagar (docs/reverse-engineering.md Seção 6 documenta a corrida do original;
 * aqui ela é eliminada por construção pelo jobId único do BullMQ — o lock é só backstop).
 */
export function startDebounceWorker() {
  return createWorker<DebounceFlushJobData>(DEBOUNCE_QUEUE, async (job: Job<DebounceFlushJobData>) => {
    const { conversationKey, conversationId, senderId, accountId } = job.data;
    const redis = getRedisClient();
    const lockKey = `buffer-lock:${conversationKey}`;

    const acquired = await redis.set(lockKey, '1', 'PX', 5_000, 'NX');
    if (!acquired) {
      logger.debug({ conversationKey }, 'Outro worker já processa este flush — no-op');
      return;
    }

    const entries = await readBuffer(redis, conversationKey);
    if (entries.length === 0) {
      logger.debug({ conversationKey }, 'Buffer já vazio ao processar flush — no-op');
      return;
    }

    await clearBuffer(redis, conversationKey);
    const text = concatenateBuffer(entries);
    await runAgentTurn({ conversationId, senderId, accountId, text });
  });
}
