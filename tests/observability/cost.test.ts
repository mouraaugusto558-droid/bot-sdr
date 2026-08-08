import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from '../../src/observability/cost.js';

describe('estimateCostUsd', () => {
  it('calcula o custo de gpt-4o a partir de tokens de entrada e saída', () => {
    const cost = estimateCostUsd('gpt-4o', 1_000_000, 1_000_000);

    expect(cost).toBeCloseTo(2.5 + 10, 6);
  });

  it('calcula o custo de gpt-4o-mini', () => {
    const cost = estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);

    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it('retorna 0 para um modelo desconhecido (sem preço cadastrado)', () => {
    expect(estimateCostUsd('modelo-desconhecido', 1_000, 1_000)).toBe(0);
  });

  it('retorna 0 quando não há tokens', () => {
    expect(estimateCostUsd('gpt-4o', 0, 0)).toBe(0);
  });
});
