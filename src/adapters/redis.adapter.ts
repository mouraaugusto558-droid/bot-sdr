import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let sharedClient: Redis | null = null;

/**
 * Cliente Redis único, compartilhado entre buffer, memória e filas BullMQ.
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ para conexões que ele gerencia.
 */
export function getRedisClient(): Redis {
  sharedClient ??= new Redis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });
  return sharedClient;
}

export async function closeRedisClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}
