import { Queue, Worker, type Processor, type WorkerOptions } from 'bullmq';
import { getRedisClient } from './redis.adapter.js';

/** Única camada que importa BullMQ diretamente — casos de uso não conhecem a lib de fila. */
export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, { connection: getRedisClient() });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  options: Partial<WorkerOptions> = {},
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: getRedisClient(),
    // Pipeline pode levar minutos (debounce + entrega sequencial) — lock generoso evita
    // que o BullMQ considere o job "travado" e o redistribua, o que arriscaria mensagens
    // duplicadas no Chatwoot. Ver docs/reverse-engineering.md Seção 11 / plano M2.
    lockDuration: 5 * 60_000,
    ...options,
  });
}
