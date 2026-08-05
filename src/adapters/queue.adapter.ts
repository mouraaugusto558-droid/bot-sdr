import { Queue, Worker, type Processor, type WorkerOptions } from 'bullmq';
import { getRedisClient } from './redis.adapter.js';
import { logger } from '../shared/logger.js';

/** Única camada que importa BullMQ diretamente — casos de uso não conhecem a lib de fila. */
export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, { connection: getRedisClient() });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  options: Partial<WorkerOptions> = {},
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection: getRedisClient(),
    // Pipeline pode levar minutos (debounce + entrega sequencial) — lock generoso evita
    // que o BullMQ considere o job "travado" e o redistribua, o que arriscaria mensagens
    // duplicadas no Chatwoot. Ver docs/reverse-engineering.md Seção 11 / plano M2.
    lockDuration: 5 * 60_000,
    ...options,
  });

  // Falha de job nunca deve virar mensagem de erro pro cliente (mesmo comportamento
  // "silencioso" do n8n original) — mas precisa ficar logada/alertável internamente
  // (M12 — Hardening). Sem este listener, o BullMQ não loga falhas por conta própria.
  worker.on('failed', (job, error) => {
    logger.error({ queue: name, jobId: job?.id, jobData: job?.data, error }, 'Job de fila falhou');
  });

  return worker;
}
