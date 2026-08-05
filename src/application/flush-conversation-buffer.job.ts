import type { Job, Queue } from 'bullmq';
import { createQueue, createWorker } from '../adapters/queue.adapter.js';
import { getRedisClient } from '../adapters/redis.adapter.js';
import { readBuffer, clearBuffer, concatenateBuffer } from '../buffer/message-buffer.service.js';
import { tryWithConversationLock } from '../session/conversation-lock.js';
import { runAgentTurn } from './run-agent-turn.usecase.js';
import { logger } from '../shared/logger.js';

/** Mesmo tempo do `lockDuration` do BullMQ (adapters/queue.adapter.ts) — cobre o pior caso de um turno completo. */
const FLUSH_LOCK_TTL_MS = 5 * 60_000;

export const DEBOUNCE_QUEUE = 'debounce-flush';

export interface DebounceFlushJobData {
  conversationKey: string;
  conversationId: string;
  senderId: string;
  accountId: string;
  contactInboxSourceId: string;
  senderName: string | null;
}

let queue: Queue<DebounceFlushJobData> | null = null;
export function getDebounceQueue(): Queue<DebounceFlushJobData> {
  queue ??= createQueue<DebounceFlushJobData>(DEBOUNCE_QUEUE);
  return queue;
}

/**
 * Dispara quando a janela de silêncio (20s, ver buffer/debounce.service.ts) expira sem
 * reagendamento. Lock por conversa (Session Manager, `session/conversation-lock.ts`) cobre
 * a seção crítica inteira — ler+apagar buffer e rodar o turno do agente — eliminando por
 * construção a condição de corrida do polling original (docs/reverse-engineering.md, Seção 6)
 * mesmo sob múltiplos workers concorrentes, não só o jobId único do BullMQ.
 */
export function startDebounceWorker() {
  return createWorker<DebounceFlushJobData>(DEBOUNCE_QUEUE, async (job: Job<DebounceFlushJobData>) => {
    const { conversationKey, conversationId, senderId, accountId, contactInboxSourceId, senderName } = job.data;
    const redis = getRedisClient();

    const result = await tryWithConversationLock(
      redis,
      conversationKey,
      async () => {
        const entries = await readBuffer(redis, conversationKey);
        if (entries.length === 0) {
          logger.debug({ conversationKey }, 'Buffer já vazio ao processar flush — no-op');
          return;
        }

        await clearBuffer(redis, conversationKey);
        const text = concatenateBuffer(entries);
        await runAgentTurn({ conversationId, senderId, accountId, contactInboxSourceId, senderName, text });
      },
      FLUSH_LOCK_TTL_MS,
    );

    if (result === 'lock-held') {
      logger.debug({ conversationKey }, 'Outro worker já processa esta conversa — no-op');
    }
  });
}
