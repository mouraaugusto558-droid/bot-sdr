/**
 * Idempotência de mensagem duplicada (M12 — Hardening). Se o n8n reenviar a mesma
 * mensagem (retry de rede, por exemplo), este ledger em Redis, com TTL, evita bufferizar
 * e processar o mesmo `messageId` duas vezes.
 */
import { logger } from '../shared/logger.js';

export interface IdempotencyRedisClient {
  set(key: string, value: string, mode: 'EX', ttlSeconds: number, flag: 'NX'): Promise<'OK' | null>;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function idempotencyKey(messageId: string): string {
  return `processed-message:${messageId}`;
}

/** Retorna `true` na primeira vez que vê este `messageId` (deve prosseguir); `false` se já foi processado (duplicado). */
export async function markProcessedIfNew(
  redis: IdempotencyRedisClient,
  messageId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const result = await redis.set(idempotencyKey(messageId), '1', 'EX', ttlSeconds, 'NX');
  const isNew = result === 'OK';
  logger.info({ messageId, isNew, ttlSeconds }, isNew ? 'Redis: messageId novo, marcado como processado' : 'Redis: messageId já processado (duplicado)');
  return isNew;
}
