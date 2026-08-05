import { describe, expect, it, vi } from 'vitest';
import { scheduleDebounce, type DebounceQueueLike } from '../../src/buffer/debounce.service.js';

interface TestData {
  conversationKey: string;
}

function createFakeQueue() {
  const remove = vi.fn().mockResolvedValue(undefined);
  const getJob = vi.fn();
  const add = vi.fn().mockResolvedValue(undefined);
  const queue: DebounceQueueLike<TestData> = { getJob, add };
  return { queue, remove, getJob, add };
}

describe('scheduleDebounce', () => {
  it('agenda um novo job quando não existe job atrasado para a conversa', async () => {
    const { queue, getJob, add } = createFakeQueue();
    getJob.mockResolvedValue(undefined);

    await scheduleDebounce(queue, 'buffer:1:5581999998888', { conversationKey: 'buffer:1:5581999998888' }, 20_000);

    expect(add).toHaveBeenCalledWith(
      'flush',
      { conversationKey: 'buffer:1:5581999998888' },
      { jobId: 'buffer:1:5581999998888', delay: 20_000 },
    );
  });

  it('cancela o job atrasado anterior antes de agendar o novo (reseta a janela de silêncio)', async () => {
    const { queue, getJob, remove, add } = createFakeQueue();
    getJob.mockResolvedValue({ remove });

    await scheduleDebounce(queue, 'buffer:1:5581999998888', { conversationKey: 'buffer:1:5581999998888' }, 20_000);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('usa o delay padrão (20s) quando não especificado', async () => {
    const { queue, getJob, add } = createFakeQueue();
    getJob.mockResolvedValue(undefined);

    await scheduleDebounce(queue, 'k', { conversationKey: 'k' });

    expect(add).toHaveBeenCalledWith('flush', { conversationKey: 'k' }, { jobId: 'k', delay: 20_000 });
  });
});
