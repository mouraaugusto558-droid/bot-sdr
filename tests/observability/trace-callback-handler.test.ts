import { describe, expect, it } from 'vitest';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { TraceCallbackHandler } from '../../src/observability/trace-callback-handler.js';

function fakeSerialized(...idParts: string[]): Serialized {
  return { lc: 1, type: 'constructor', id: idParts, kwargs: {} };
}

describe('TraceCallbackHandler', () => {
  it('registra um evento LLM completo com tokens e modelKey vindo dos metadados', () => {
    const handler = new TraceCallbackHandler();
    const llmResult: LLMResult = {
      generations: [],
      llmOutput: { tokenUsage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 } },
    };

    handler.handleLLMStart(
      fakeSerialized('langchain', 'chat_models', 'openai', 'ChatOpenAI'),
      ['prompt'],
      'run-1',
      undefined,
      undefined,
      undefined,
      { modelKey: 'agent' },
    );
    handler.handleLLMEnd(llmResult, 'run-1');

    expect(handler.events).toHaveLength(1);
    expect(handler.events[0]).toMatchObject({
      type: 'llm',
      name: 'ChatOpenAI',
      modelKey: 'agent',
      inputTokens: 120,
      outputTokens: 40,
    });
    expect(handler.events[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('registra erro de LLM preservando a mensagem', () => {
    const handler = new TraceCallbackHandler();

    handler.handleLLMStart(fakeSerialized('ChatOpenAI'), ['prompt'], 'run-2');
    handler.handleLLMError(new Error('rate limit'), 'run-2');

    expect(handler.events[0]).toMatchObject({ type: 'llm', error: 'rate limit' });
  });

  it('registra início e fim de uma chamada de tool', () => {
    const handler = new TraceCallbackHandler();

    handler.handleToolStart(fakeSerialized('DynamicStructuredTool'), '{}', 'run-3');
    handler.handleToolEnd('resultado da tool', 'run-3');

    expect(handler.events[0]).toMatchObject({ type: 'tool', name: 'DynamicStructuredTool' });
  });

  it('registra erro de tool preservando a mensagem', () => {
    const handler = new TraceCallbackHandler();

    handler.handleToolStart(fakeSerialized('Procedimento'), '{}', 'run-4');
    handler.handleToolError(new Error('Postgres indisponível'), 'run-4');

    expect(handler.events[0]).toMatchObject({ type: 'tool', name: 'Procedimento', error: 'Postgres indisponível' });
  });

  it('ignora handleLLMEnd/handleToolEnd para um runId desconhecido (sem start correspondente)', () => {
    const handler = new TraceCallbackHandler();

    handler.handleLLMEnd({ generations: [] }, 'run-nunca-iniciado');
    handler.handleToolEnd('x', 'outro-run-nunca-iniciado');

    expect(handler.events).toHaveLength(0);
  });
});
