import { describe, expect, it, vi } from 'vitest';
import { bufferAndWait } from '../../src/buffer/debounce-coordinator.js';

describe('bufferAndWait', () => {
  it('resolve "flushed" após delayMs quando nenhuma nova mensagem chega', async () => {
    vi.useFakeTimers();
    const onFlush = vi.fn().mockResolvedValue('resultado-A');

    const promise = bufferAndWait('key-1', 1000, onFlush);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ status: 'flushed', result: 'resultado-A' });
    expect(onFlush).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('supera (supersede) uma chamada pendente quando uma nova chega antes da janela fechar', async () => {
    vi.useFakeTimers();
    const onFlushA = vi.fn().mockResolvedValue('A');
    const onFlushB = vi.fn().mockResolvedValue('B');

    const promiseA = bufferAndWait('key-2', 1000, onFlushA);
    await vi.advanceTimersByTimeAsync(500);
    const promiseB = bufferAndWait('key-2', 1000, onFlushB);

    await expect(promiseA).resolves.toEqual({ status: 'superseded' });
    expect(onFlushA).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promiseB).resolves.toEqual({ status: 'flushed', result: 'B' });
    vi.useRealTimers();
  });

  it('não interfere entre chaves diferentes', async () => {
    vi.useFakeTimers();
    const onFlushA = vi.fn().mockResolvedValue('A');
    const onFlushB = vi.fn().mockResolvedValue('B');

    const promiseA = bufferAndWait('key-3', 1000, onFlushA);
    const promiseB = bufferAndWait('key-4', 1000, onFlushB);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promiseA).resolves.toEqual({ status: 'flushed', result: 'A' });
    await expect(promiseB).resolves.toEqual({ status: 'flushed', result: 'B' });
    vi.useRealTimers();
  });
});
