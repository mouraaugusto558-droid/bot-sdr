import { describe, expect, it } from 'vitest';
import { summarizeTrace } from '../../src/observability/trace-summary.js';
import { AGENT_MODEL, PARSER_CHAIN_MODEL } from '../../src/config/models.js';
import type { TraceEvent } from '../../src/observability/trace-callback-handler.js';

describe('summarizeTrace', () => {
  it('retorna um resumo zerado quando não há eventos', () => {
    const summary = summarizeTrace([]);

    expect(summary.durationMs).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.toolCallCount).toBe(0);
    expect(summary.errorCount).toBe(0);
  });

  it('soma tokens e calcula o custo de eventos LLM por modelKey', () => {
    const events: TraceEvent[] = [
      { type: 'llm', name: 'ChatOpenAI', modelKey: 'agent', startedAt: 1000, endedAt: 1500, durationMs: 500, inputTokens: 1000, outputTokens: 200 },
      { type: 'llm', name: 'ChatOpenAI', modelKey: 'parser', startedAt: 1500, endedAt: 1800, durationMs: 300, inputTokens: 500, outputTokens: 100 },
    ];

    const summary = summarizeTrace(events);

    expect(summary.totalInputTokens).toBe(1500);
    expect(summary.totalOutputTokens).toBe(300);

    const expectedCost =
      (1000 / 1_000_000) * 2.5 + (200 / 1_000_000) * 10 + (500 / 1_000_000) * 0.4 + (100 / 1_000_000) * 1.6;
    expect(summary.estimatedCostUsd).toBeCloseTo(expectedCost, 8);
  });

  it('conta chamadas de tool separadamente e não soma tokens delas', () => {
    const events: TraceEvent[] = [
      { type: 'tool', name: 'pergunta', startedAt: 1000, endedAt: 1100, durationMs: 100 },
      { type: 'tool', name: 'Procedimento', startedAt: 1100, endedAt: 1150, durationMs: 50 },
      { type: 'llm', name: 'ChatOpenAI', modelKey: 'agent', startedAt: 1150, endedAt: 1400, durationMs: 250, inputTokens: 100, outputTokens: 50 },
    ];

    const summary = summarizeTrace(events);

    expect(summary.toolCallCount).toBe(2);
    expect(summary.totalInputTokens).toBe(100);
  });

  it('conta erros de qualquer tipo de evento', () => {
    const events: TraceEvent[] = [
      { type: 'llm', name: 'ChatOpenAI', startedAt: 1000, endedAt: 1100, durationMs: 100, error: 'timeout' },
      { type: 'tool', name: 'Procedimento', startedAt: 1100, endedAt: 1150, durationMs: 50, error: 'falha na tool' },
      { type: 'tool', name: 'Anotar', startedAt: 1150, endedAt: 1200, durationMs: 50 },
    ];

    const summary = summarizeTrace(events);

    expect(summary.errorCount).toBe(2);
  });

  it('calcula startedAt/finishedAt/durationMs a partir do menor e maior timestamp entre os eventos', () => {
    const events: TraceEvent[] = [
      { type: 'llm', name: 'a', startedAt: 2000, endedAt: 2500, durationMs: 500 },
      { type: 'tool', name: 'b', startedAt: 1000, endedAt: 1200, durationMs: 200 },
      { type: 'llm', name: 'c', startedAt: 2500, endedAt: 3000, durationMs: 500 },
    ];

    const summary = summarizeTrace(events);

    expect(summary.startedAt.getTime()).toBe(1000);
    expect(summary.finishedAt.getTime()).toBe(3000);
    expect(summary.durationMs).toBe(2000);
  });

  it('não estima custo para evento LLM sem modelKey reconhecido', () => {
    const events: TraceEvent[] = [
      { type: 'llm', name: 'ChatOpenAI', startedAt: 1000, endedAt: 1100, durationMs: 100, inputTokens: 1000, outputTokens: 1000 },
    ];

    const summary = summarizeTrace(events);

    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.totalInputTokens).toBe(1000);
  });

  it('usa os mesmos modelos configurados em config/models.ts para agent e parser', () => {
    expect(AGENT_MODEL.model).toBeTruthy();
    expect(PARSER_CHAIN_MODEL.model).toBeTruthy();
  });
});
