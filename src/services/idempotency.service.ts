/**
 * Idempotência de webhook duplicado (M12 — Hardening). O dedup por `jobId = message.id`
 * no BullMQ (`process-incoming-message.job.ts`) só protege enquanto o job original ainda
 * está na fila — como usamos `removeOnComplete: true`, um retry do webhook que chegue
 * DEPOIS do processamento original já ter terminado não seria mais pego por aquele
 * mecanismo. Este ledger em Redis, com TTL, cobre essa janela também.
 */
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
  return result === 'OK';
}
