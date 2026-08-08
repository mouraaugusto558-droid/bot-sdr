import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { logger } from '../shared/logger.js';

/**
 * Equivalente ao node "Redis Chat Memory" (`memoryRedisChat`) — histórico de conversa
 * completo (mensagens LangChain), separado do buffer de debounce (chave/formato diferentes,
 * ver docs/reverse-engineering.md Seção 7). É esta memória — não uma variável separada —
 * que cumpre a "REGRA 5" do prompt (lembrar nome/período já informados).
 *
 * Mesma chave (`sessionKey`) e mesmo formato de mensagem serializada do node original
 * (`{ type, data: { content } }`, lista Redis via RPUSH/LRANGE) — preserva o histórico de
 * conversas em andamento no cutover, já que a Nanda 2.0 pode apontar para o mesmo Redis.
 */
export interface MemoryRedisClient {
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

interface StoredMessage {
  type: 'human' | 'ai' | 'system';
  data: { content: string };
}

export function chatHistoryKey(contactInboxSourceId: string, accountId: string): string {
  return `mensagens.${contactInboxSourceId}_mem${accountId}`;
}

function serializeMessage(message: BaseMessage): string {
  const type = message.getType();
  const storedType: StoredMessage['type'] = type === 'human' ? 'human' : type === 'ai' ? 'ai' : 'system';
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  return JSON.stringify({ type: storedType, data: { content } } satisfies StoredMessage);
}

function deserializeMessage(raw: string): BaseMessage {
  const parsed = JSON.parse(raw) as StoredMessage;
  const content = parsed.data?.content ?? '';
  if (parsed.type === 'human') return new HumanMessage(content);
  if (parsed.type === 'ai') return new AIMessage(content);
  return new SystemMessage(content);
}

export async function readChatHistory(redis: MemoryRedisClient, key: string): Promise<BaseMessage[]> {
  const raw = await redis.lrange(key, 0, -1);
  logger.info({ key, count: raw.length }, 'Redis: histórico de chat lido (memória)');
  return raw.map(deserializeMessage);
}

export async function appendChatHistory(
  redis: MemoryRedisClient,
  key: string,
  messages: BaseMessage[],
): Promise<void> {
  if (messages.length === 0) {
    logger.info({ key }, 'Redis: nenhuma mensagem nova pra gravar no histórico');
    return;
  }
  await redis.rpush(key, ...messages.map(serializeMessage));
  logger.info({ key, added: messages.length }, 'Redis: histórico de chat atualizado (memória)');
}
