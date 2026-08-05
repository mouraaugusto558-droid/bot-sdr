import { DEBOUNCE_WINDOW_MS } from '../config/constants.js';

/**
 * Substitui o loop de polling (Redis1/Switch4/Wait1, 1s) do original por debounce real:
 * cada nova mensagem cancela o job atrasado anterior e agenda um novo com o delay
 * completo, carregando os dados necessários para o worker de flush processar sem
 * precisar reconsultar nada. O job só dispara quando ninguém reagenda por `delayMs` —
 * mesma janela de 20s observável, sem polling e sem a condição de corrida documentada
 * (Seção 6, plano Seção 5).
 *
 * Recebe uma fila mínima por parâmetro para permanecer testável sem Redis real.
 */
export interface DebounceQueueLike<TData> {
  getJob(jobId: string): Promise<{ remove(): Promise<unknown> } | undefined>;
  add(name: string, data: TData, opts: { jobId: string; delay: number }): Promise<unknown>;
}

export async function scheduleDebounce<TData>(
  queue: DebounceQueueLike<TData>,
  jobId: string,
  data: TData,
  delayMs: number = DEBOUNCE_WINDOW_MS,
): Promise<void> {
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    await existingJob.remove();
  }
  await queue.add('flush', data, { jobId, delay: delayMs });
}
