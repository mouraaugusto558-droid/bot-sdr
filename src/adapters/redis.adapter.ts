import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let sharedClient: Redis | null = null;

/** Cliente Redis único, compartilhado entre o buffer de mensagens, o lock de conversa e a memória de chat. */
export function getRedisClient(): Redis {
  sharedClient ??= new Redis(loadEnv().REDIS_URL);
  return sharedClient;
}

export async function closeRedisClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}
