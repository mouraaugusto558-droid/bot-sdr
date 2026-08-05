/**
 * Coordena a janela de silêncio de 20s de forma síncrona com o request HTTP que a
 * originou (ver docs/reverse-engineering.md, Seção 6, e Seção 8 para a mudança de
 * contrato). Substitui o polling do original (Redis1/Switch4/Wait1): cada nova mensagem
 * da mesma conversa "supera" (supersede) qualquer chamada ainda pendente, que retorna
 * na hora; só a última chamada da janela efetivamente espera os `delayMs` inteiros e
 * dispara o flush.
 *
 * Em memória, de propósito — esta API roda como processo único (buffer + agente no
 * mesmo request), sem necessidade de coordenação entre processos.
 */
export type DebounceOutcome<T> = { status: 'flushed'; result: T } | { status: 'superseded' };

interface PendingEntry {
  timer: ReturnType<typeof setTimeout>;
  resolve: (outcome: DebounceOutcome<never>) => void;
}

const pending = new Map<string, PendingEntry>();

export function bufferAndWait<T>(
  key: string,
  delayMs: number,
  onFlush: () => Promise<T>,
): Promise<DebounceOutcome<T>> {
  return new Promise((resolve, reject) => {
    const existing = pending.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.resolve({ status: 'superseded' });
    }

    const timer = setTimeout(() => {
      pending.delete(key);
      onFlush().then((result) => resolve({ status: 'flushed', result }), reject);
    }, delayMs);

    pending.set(key, {
      timer,
      resolve: resolve as (outcome: DebounceOutcome<never>) => void,
    });
  });
}
