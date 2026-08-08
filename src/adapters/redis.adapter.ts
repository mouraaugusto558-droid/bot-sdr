import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';
import { logger } from '../shared/logger.js';

let sharedClient: Redis | null = null;

/** Remove usuário/senha da URL antes de logar — mantém só host/porta/db, úteis para debugar. */
function redactRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '6379'}${parsed.pathname}`;
  } catch {
    return '(REDIS_URL inválida)';
  }
}

/** Cliente Redis único, compartilhado entre o buffer de mensagens, o lock de conversa e a memória de chat. */
export function getRedisClient(): Redis {
  if (!sharedClient) {
    const url = loadEnv().REDIS_URL;
    logger.info({ redisUrl: redactRedisUrl(url) }, 'Redis: criando cliente compartilhado');

    const client = new Redis(url);
    client.on('connect', () => logger.info('Redis: TCP conectado, autenticando/negociando'));
    client.on('ready', () => logger.info('Redis: pronto (comandos serão aceitos a partir de agora)'));
    client.on('error', (error) => logger.error({ error }, 'Redis: erro de conexão'));
    client.on('close', () => logger.warn('Redis: conexão fechada'));
    client.on('reconnecting', (delay: number) => logger.warn({ delay }, 'Redis: reconectando após queda'));
    client.on('end', () => logger.warn('Redis: conexão encerrada definitivamente (sem novas tentativas)'));

    sharedClient = client;
  }
  return sharedClient;
}

export async function closeRedisClient(): Promise<void> {
  if (sharedClient) {
    logger.info('Redis: encerrando cliente compartilhado (shutdown)');
    await sharedClient.quit();
    sharedClient = null;
  }
}
