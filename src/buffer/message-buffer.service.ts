/**
 * Buffer de mensagens por conversa (equivalente aos nós Redis/Redis1/Deleta Buffer/
 * Empacota Mensagens do original — docs/reverse-engineering.md, Seção 6).
 * Recebe o client Redis por parâmetro (nunca importa ioredis diretamente) para
 * permanecer testável com um fake em memória.
 */

import { logger } from '../shared/logger.js';

export interface BufferRedisClient {
  rpush(key: string, value: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  del(key: string): Promise<number>;
}

export interface BufferedMessage {
  message: string;
  messageId: string | null;
  timestamp: string;
}

export function bufferKey(accountId: string, senderId: string): string {
  return `buffer:${accountId}:${senderId}`;
}

export async function pushToBuffer(
  redis: BufferRedisClient,
  key: string,
  entry: BufferedMessage,
): Promise<void> {
  const size = await redis.rpush(key, JSON.stringify(entry));
  logger.info({ key, size, messageId: entry.messageId }, 'Redis: mensagem empilhada no buffer (RPUSH)');
}

export async function readBuffer(redis: BufferRedisClient, key: string): Promise<BufferedMessage[]> {
  const raw = await redis.lrange(key, 0, -1);
  logger.info({ key, count: raw.length }, 'Redis: buffer lido (LRANGE)');
  return raw.map((item) => JSON.parse(item) as BufferedMessage);
}

export async function clearBuffer(redis: BufferRedisClient, key: string): Promise<void> {
  const deleted = await redis.del(key);
  logger.info({ key, deleted: deleted > 0 }, 'Redis: buffer limpo (DEL)');
}

/**
 * Concatena na ordem de inserção da lista, SEM tentar reordenar por nenhum campo.
 * Replica o comportamento real observado (Seção 6.5): o node original tentava ordenar
 * por um campo inexistente (`messageTime`), então o sort nunca fazia nada — o resultado
 * sempre foi "ordem de chegada no Redis", que é exatamente o que RPUSH/LRANGE já dão.
 */
export function concatenateBuffer(entries: readonly BufferedMessage[]): string {
  return entries.map((entry) => entry.message).join(' ');
}
